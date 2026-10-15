/**
 * Ruido de la analítica propia: lo que NO es un cliente y no debe contarse.
 *
 * Durante tres semanas (sep/oct 2026) el embudo de la tienda se leyó mal
 * porque entre las sesiones de clientes había tres cosas que no lo eran:
 *
 *  1. El robot de Google Merchant Center. Verifica la tienda recorriendo una
 *     ficha → carrito → checkout y deja un mail de `storebotmail.joonix.net`
 *     (src/lib/checkout/robots.ts lo marca como carrito BOT). Pero su recorrido
 *     TAMBIÉN quedaba en `AnalyticsEvent` y se espejaba a Meta como
 *     ViewContent / AddToCart / InitiateCheckout reales. En producción se lo ve
 *     siempre igual: `device = desktop`, sin referrer, sin UTM, y un
 *     `begin_checkout` a menos de 5 minutos del carrito con ese mail.
 *  2. Las pruebas internas del 25/9/2026 (15:30–16:00 y 21:00–23:59 ART),
 *     anteriores a la marca `ate_interno` (src/lib/trafico-interno.ts).
 *  3. Todo lo que toque el producto "PRUEBA de compra — no comprar"
 *     (`prueba-compra-un-peso`), que existe para ensayar el checkout real.
 *
 * Esta es la ÚNICA definición. La aplican, con las mismas funciones:
 *   - `/api/web/track` al ESCRIBIR (no guarda y no espeja a Meta),
 *   - `recordEvents` (src/lib/analytics.ts) para lo que entra por el server,
 *   - `/api/admin/analytics` (embudo y "Dónde se traban") y
 *     `GrowthService.getSaludMedicion` al LEER,
 *   - `scripts/checks/embudo-tienda-limpio.mjs`, la foto semanal.
 *
 * Las filas viejas de producción NO se borran: se filtran al leer. Filtrar es
 * reversible y auditable; borrar no.
 */
import { Prisma } from '@prisma/client';

/** Product.id de "PRUEBA de compra — no comprar" en producción. */
export const PRODUCTO_PRUEBA_ID = 'cmv09rphu0000132o2t14twbe';
export const SLUG_PRODUCTO_PRUEBA = 'prueba-compra-un-peso';

/** Dominio del mail que deja el robot de Google Merchant (ver checkout/robots.ts). */
export const DOMINIO_ROBOT_MERCHANT = 'storebotmail.joonix.net';

/**
 * Ventanas de pruebas internas, en UTC (ART = UTC−3). Son pasado: sirven para
 * leer, no para escribir. Agregar una ventana acá es la forma correcta de
 * descontar una sesión de prueba vieja; NUNCA borrar filas.
 */
export const VENTANAS_PRUEBA_INTERNA: ReadonlyArray<{ desde: Date; hasta: Date; motivo: string }> = [
  {
    desde: new Date('2026-09-25T18:30:00.000Z'),
    hasta: new Date('2026-09-25T19:00:00.000Z'),
    motivo: 'Pruebas del checkout del 25/9/2026, 15:30–16:00 ART',
  },
  {
    desde: new Date('2026-09-26T00:00:00.000Z'),
    hasta: new Date('2026-09-26T02:59:59.999Z'),
    motivo: 'Pruebas del checkout del 25/9/2026, 21:00–23:59 ART',
  },
];

/** Margen entre el carrito del robot y sus eventos de analítica. */
export const MINUTOS_ALREDEDOR_DEL_ROBOT = 5;

/**
 * User-agents que no son personas. `Storebot-Google` es el que documenta Google
 * para el robot de Merchant Center; `HeadlessChrome` es cualquier navegador
 * automático (los checks propios ya contestan el beacon ellos mismos, ver
 * scripts/checks/_sin-ruido-propio.mjs, así que esto es la segunda red).
 */
const UA_ROBOT = /Storebot-Google|Google-Shopping|HeadlessChrome|Lighthouse/i;

export function esUserAgentRobot(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent) && UA_ROBOT.test(String(userAgent));
}

/** ¿Es el producto de prueba? Vale para `productId` y para `path`. */
export function esProductoDePrueba(e: { productId?: string | null; path?: string | null }): boolean {
  if (e.productId === PRODUCTO_PRUEBA_ID) return true;
  return typeof e.path === 'string' && e.path.includes(SLUG_PRODUCTO_PRUEBA);
}

export function estaEnVentanaDePrueba(fecha: Date): boolean {
  const t = fecha.getTime();
  return VENTANAS_PRUEBA_INTERNA.some((v) => t >= v.desde.getTime() && t <= v.hasta.getTime());
}

/**
 * Regla para UN evento, sin base: lo que se puede decidir antes de guardar.
 * (El robot de Merchant se reconoce acá por user-agent; en la base, por su carrito.)
 */
export function esEventoDeRuido(
  e: { productId?: string | null; path?: string | null; createdAt?: Date | null },
  userAgent?: string | null,
): boolean {
  if (esUserAgentRobot(userAgent)) return true;
  if (esProductoDePrueba(e)) return true;
  if (e.createdAt && estaEnVentanaDePrueba(e.createdAt)) return true;
  return false;
}

/**
 * Sesiones de analítica del robot de Merchant: SQL, para usar como subconsulta.
 * Un `begin_checkout` de escritorio, sin referrer ni UTM, a ±5 minutos de un
 * carrito con el mail del robot. Verificado contra producción el 15/10/2026:
 * 20 sesiones, todas entre la 01:10 y las 02:00 ART, ninguna de un cliente.
 */
export function sqlSesionesRobot(): Prisma.Sql {
  const intervalo = `${MINUTOS_ALREDEDOR_DEL_ROBOT} minutes`;
  return Prisma.sql`
    SELECT DISTINCT e."sessionId"
    FROM "AnalyticsEvent" e
    JOIN "CheckoutSession" r
      ON r.email ILIKE ${'%@' + DOMINIO_ROBOT_MERCHANT}
     AND e."createdAt" BETWEEN r."createdAt" - ${intervalo}::interval
                           AND r."createdAt" + ${intervalo}::interval
    WHERE e.type = 'begin_checkout'
      AND e.device = 'desktop'
      AND e.referrer IS NULL
      AND e."utmSource" IS NULL`;
}

/**
 * Fragmento SQL para pegar con `AND` en cualquier consulta sobre
 * "AnalyticsEvent" (columnas sin alias). Deja afuera el robot, el producto de
 * prueba y las ventanas de pruebas internas.
 */
export function sqlSinRuido(): Prisma.Sql {
  const ventanas = VENTANAS_PRUEBA_INTERNA.map(
    (v) => Prisma.sql`NOT ("createdAt" BETWEEN ${v.desde} AND ${v.hasta})`,
  );
  return Prisma.sql`(
    "sessionId" NOT IN (${sqlSesionesRobot()})
    AND "productId" IS DISTINCT FROM ${PRODUCTO_PRUEBA_ID}
    AND (path IS NULL OR path NOT LIKE ${'%' + SLUG_PRODUCTO_PRUEBA + '%'})
    AND ${Prisma.join(ventanas, ' AND ')}
  )`;
}

type ClienteMinimo = { $queryRaw: (q: Prisma.Sql) => Promise<unknown> };

/** Ids de sesión del robot, para los `where` de Prisma (groupBy, findMany…). */
export async function sesionesRobot(prisma: ClienteMinimo): Promise<string[]> {
  const filas = (await prisma.$queryRaw(sqlSesionesRobot())) as Array<{ sessionId: string }>;
  return filas.map((f) => f.sessionId);
}

/**
 * `where` de Prisma equivalente a `sqlSinRuido()`. Se combina con el del lector:
 *   where: { createdAt: rango, ...whereSinRuido(await sesionesRobot(prisma)) }
 */
export function whereSinRuido(sesionesDelRobot: string[]): Prisma.AnalyticsEventWhereInput {
  return {
    sessionId: { notIn: sesionesDelRobot },
    NOT: [
      { productId: PRODUCTO_PRUEBA_ID },
      { path: { contains: SLUG_PRODUCTO_PRUEBA } },
      ...VENTANAS_PRUEBA_INTERNA.map((v) => ({ createdAt: { gte: v.desde, lte: v.hasta } })),
    ],
  };
}
