import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { adTag, dolarBlue, fetchSpendByTag, metaAdsConfigured } from '@/lib/ads/meta-insights';
import { normalizeContactSource, SIN_ORIGEN } from '@/lib/contact-source';

/**
 * Atribución: qué trajo a cada cliente y qué devolvió.
 *
 * El cálculo vivía adentro del cron `/api/cron/ads-report` y solo se veía en el
 * email diario. Acá queda como service para que la pantalla
 * `/admin/analitica/atribucion` y el cron lean EXACTAMENTE el mismo número: si
 * el email dice 3,2× y la pantalla dice otra cosa, el dato deja de servir.
 *
 * Dos cruces distintos, a propósito:
 *  - POR ANUNCIO (`porAnuncio`): puente por etiqueta (`[metaFlor]` → `flor`). El
 *    texto pre-cargado que llega por WhatsApp trae la etiqueta, así que se sabe
 *    qué anuncio trajo cada conversación y qué compró después ese cliente. Es el
 *    único cruce que dice si la pauta se paga sola — Meta solo informa chats.
 *  - POR CANAL (`porCanal`): `Client.contactSource` normalizado con el
 *    vocabulario único (`lib/contact-source`). Responde "de dónde viene la
 *    gente" incluso donde no hay anuncio de por medio (calle, referidos, Maps).
 *
 * Todo acá es SOLO LECTURA: ninguna función de este archivo escribe en la base.
 */

/** Rangos que ofrece la pantalla. Meta no acepta días arbitrarios: van por preset. */
export const RANGOS_ATRIBUCION = [7, 30, 90] as const;
export type RangoAtribucion = (typeof RANGOS_ATRIBUCION)[number];

/** `date_preset` de la Marketing API por rango. */
const PRESET_META: Record<RangoAtribucion, string> = {
    7: 'last_7d',
    30: 'last_30d',
    90: 'last_90d',
};

export function esRangoAtribucion(n: number): n is RangoAtribucion {
    return (RANGOS_ATRIBUCION as readonly number[]).includes(n);
}

/**
 * Medianoche de hace `daysAgo` días en Argentina (sin DST, -03:00 fijo es seguro).
 * Vive acá y no en cada llamador porque la ventana del reporte y la de la
 * pantalla tienen que empezar y terminar en el mismo instante.
 */
export function arDayStart(daysAgo: number): Date {
    const dateStr = new Date(Date.now() - daysAgo * 864e5).toLocaleDateString('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
    });
    return new Date(`${dateStr}T00:00:00-03:00`);
}

/** El canónico de Meta sale del vocabulario único, nunca de un literal suelto. */
const CANAL_META = normalizeContactSource('Meta');

export interface AnuncioAtribucion {
    /** Apodo del anuncio: `[metaFlor]` se guarda como `flor` (Google va con prefijo `google:`). */
    tag: string;
    gasto: number;
    chats: number;
    /** Fichas creadas en el período con esta etiqueta (`Client.adTag`). */
    clientesNuevos: number;
    /** Clientes que recibieron al menos un presupuesto (orden en cualquier estado no borrado). */
    presupuestados: number;
    presupuestado: number;
    /** Clientes con al menos una venta REAL: plata cobrada o pedido en laboratorio. */
    cierres: number;
    facturadoReal: number;
    cobrado: number;
    /** gasto / chats. null si no hubo chats o no hay gasto medido. */
    costoPorChat: number | null;
    /** facturadoReal / gasto. null si falta alguno de los dos. */
    roas: number | null;
}

export interface CanalAtribucion {
    /** Canal ya normalizado. Los nulos y los desconocidos caen en 'Sin origen'. */
    canal: string;
    clientesNuevos: number;
    /** Órdenes con al menos un cobro registrado en el período (filas de Payment). */
    ventasCobradas: number;
    cobrado: number;
    /** Desglose de otra fila (hoy: el pedazo de Meta sin anuncio), no un canal aparte. */
    esSubfila?: boolean;
}

export interface TotalesAtribucion {
    gasto: number;
    chats: number;
    clientesNuevos: number;
    presupuestados: number;
    presupuestado: number;
    cierres: number;
    facturadoReal: number;
    cobrado: number;
    costoPorChat: number | null;
    roas: number | null;
}

export interface Atribucion {
    rango: { dias: RangoAtribucion; desde: string; hasta: string };
    anuncios: AnuncioAtribucion[];
    totales: TotalesAtribucion;
    canales: CanalAtribucion[];
    /** Clientes de canal Meta SIN etiqueta de anuncio: lo que no se pudo atribuir. */
    metaSinAnuncio: CanalAtribucion;
    /** Estado de la lectura de gasto en Meta (la pantalla avisa si no hay). */
    gasto: { disponible: boolean; aviso: string | null };
}

/**
 * Retorno del anuncio: lo que facturaron sus ventas reales sobre lo que costó.
 * Una sola fórmula para el email y la pantalla.
 */
export function calcularRoas(gasto: number, facturadoReal: number): number | null {
    return gasto > 0 && facturadoReal > 0 ? facturadoReal / gasto : null;
}

/** Filas que le importan al reporte diario: gastaron plata o movieron plata. */
export function tieneMovimiento(f: AnuncioAtribucion): boolean {
    return f.gasto > 0 || f.presupuestado > 0 || f.facturadoReal > 0;
}

type MapaGasto = Map<string, { gasto: number; convMeta: number }>;

/**
 * Cruce anuncio ↔ conversaciones ↔ ventas para la ventana dada.
 * Recibe el gasto ya resuelto para que el llamador decida qué hacer si Meta no
 * responde (el cron falla, la pantalla sigue mostrando lo propio).
 */
async function cruzar(desde: Date, hasta: Date, gasto: MapaGasto): Promise<AnuncioAtribucion[]> {
    const chats = await prisma.whatsAppChat.findMany({
        where: { createdAt: { gte: desde, lt: hasta } },
        select: {
            clientId: true,
            adTag: true,
            messages: {
                where: { direction: 'INBOUND' },
                orderBy: { createdAt: 'asc' },
                take: 1,
                select: { content: true },
            },
        },
    });

    const porTag = new Map<string, { chats: number; clientes: Set<string> }>();
    for (const c of chats) {
        // La columna persistida manda; el parseo del primer mensaje queda como
        // respaldo para chats anteriores a la columna (o etiquetas deducidas por producto).
        const tag = c.adTag || adTag(c.messages[0]?.content);
        if (!tag) continue;
        const g = porTag.get(tag) || { chats: 0, clientes: new Set<string>() };
        g.chats++;
        if (c.clientId) g.clientes.add(c.clientId);
        porTag.set(tag, g);
    }

    // Fichas nuevas del período por etiqueta. Es una pregunta distinta de "chats":
    // un anuncio puede traer diez conversaciones y una sola ficha cargada.
    const nuevosPorTag = new Map<string, number>();
    for (const fila of await prisma.client.groupBy({
        by: ['adTag'],
        where: {
            createdAt: { gte: desde, lt: hasta },
            isDeleted: false,
            adTag: { not: null },
        },
        _count: { _all: true },
    })) {
        if (fila.adTag) nuevosPorTag.set(fila.adTag, fila._count._all);
    }

    const ids = [...new Set([...porTag.values()].flatMap((g) => [...g.clientes]))];
    // Órdenes vivas del período. OJO: acá conviven dos cosas MUY distintas —
    // presupuestos (PDF que manda el bot/vendedora, sin plata) y ventas reales.
    // Auditoría 28/7: contar Order.total a secas infló el "ROAS" contando
    // presupuestos LOST y PENDING sin un peso como facturación.
    const ordenes = ids.length
        ? await prisma.order.findMany({
              where: { clientId: { in: ids }, createdAt: { gte: desde, lt: hasta }, isDeleted: false },
              select: {
                  clientId: true,
                  total: true,
                  paid: true,
                  labStatus: true,
                  status: true,
                  payments: { select: { amount: true } },
              },
          })
        : [];

    const porCliente = new Map<string, { presupuesto: number; real: number; cobrado: number }>();
    for (const v of ordenes) {
        if (!v.clientId) continue;
        const p = porCliente.get(v.clientId) || { presupuesto: 0, real: 0, cobrado: 0 };
        p.presupuesto += Number(v.total || 0);
        // Solo cuentan los pagos REGISTRADOS. `Order.paid` no sirve como respaldo:
        // quedan filas con `paid` = total × 1,25 sin ninguna fila de pago detrás
        // (residuo del arreglo del ratchet, que baja `total` y no toca `paid`), y
        // usarlas como evidencia inventaba cierres. De 168 órdenes con pagos reales
        // en 90 días, 165 tienen `paid` coherente — no se pierde nada al exigir la fila.
        const cobrado = v.payments.reduce((s, pay) => s + Number(pay.amount || 0), 0);
        const esVentaReal =
            !['LOST', 'CANCELED'].includes(v.status || '') &&
            (cobrado > 0 || (v.labStatus && v.labStatus !== 'NONE'));
        if (esVentaReal) {
            p.real += Number(v.total || 0);
            p.cobrado += cobrado;
        }
        porCliente.set(v.clientId, p);
    }

    const tags = new Set([...gasto.keys(), ...porTag.keys(), ...nuevosPorTag.keys()]);
    const filas: AnuncioAtribucion[] = [];
    for (const tag of tags) {
        const g = porTag.get(tag);
        let presupuestados = 0, presupuestado = 0, cierres = 0, facturadoReal = 0, cobrado = 0;
        for (const cid of g?.clientes || []) {
            const v = porCliente.get(cid);
            if (!v) continue;
            if (v.presupuesto > 0) { presupuestados++; presupuestado += v.presupuesto; }
            if (v.real > 0 || v.cobrado > 0) { cierres++; facturadoReal += v.real; cobrado += v.cobrado; }
        }
        const gastoTag = gasto.get(tag)?.gasto || 0;
        const chatsTag = g?.chats || 0;
        filas.push({
            tag,
            gasto: gastoTag,
            chats: chatsTag,
            clientesNuevos: nuevosPorTag.get(tag) || 0,
            presupuestados, presupuestado, cierres, facturadoReal, cobrado,
            costoPorChat: gastoTag > 0 && chatsTag > 0 ? gastoTag / chatsTag : null,
            roas: calcularRoas(gastoTag, facturadoReal),
        });
    }
    return filas.sort((a, b) => b.facturadoReal - a.facturadoReal || b.presupuestado - a.presupuestado);
}

const vacio = (canal: string): CanalAtribucion => ({
    canal,
    clientesNuevos: 0,
    ventasCobradas: 0,
    cobrado: 0,
});

export class AttributionService {
    /**
     * Retorno real por anuncio (lo que consume el reporte diario de ads).
     * Devuelve solo las filas con movimiento, ordenadas por facturación real.
     * Si Meta no responde, LANZA: un reporte de pauta sin el gasto miente.
     */
    static async porAnuncio(dias: RangoAtribucion, rate?: number): Promise<AnuncioAtribucion[]> {
        const r = rate ?? (await dolarBlue());
        const gasto = await fetchSpendByTag(PRESET_META[dias], r);
        const filas = await cruzar(arDayStart(dias), arDayStart(0), gasto);
        return filas.filter(tieneMovimiento);
    }

    /**
     * Origen de los clientes del período, por canal normalizado.
     *
     * - "Clientes nuevos": fichas creadas en la ventana (`Client.createdAt`).
     * - "Ventas cobradas": plata que ENTRÓ en la ventana (filas de `Payment`),
     *   imputada al canal del cliente de esa orden. Se mide por pagos porque
     *   `Order.paid` no prueba cobro (regla de negocio del proyecto).
     *
     * Devuelve además la fila de Meta sin etiqueta de anuncio: lo que la pauta
     * trajo pero no se pudo atribuir a un anuncio concreto.
     */
    static async porCanal(
        desde: Date,
        hasta: Date,
    ): Promise<{ canales: CanalAtribucion[]; metaSinAnuncio: CanalAtribucion }> {
        const [clientes, cobros] = await Promise.all([
            prisma.client.findMany({
                where: { createdAt: { gte: desde, lt: hasta }, isDeleted: false },
                select: { contactSource: true, adTag: true },
            }),
            // Agrupado en la base y no en JS: son todos los pagos del período.
            // El corte por `adTag IS NULL` es lo que permite separar la pauta de
            // Meta que sí quedó atribuida a un anuncio de la que no.
            prisma.$queryRaw<
                Array<{ canal: string | null; sinAnuncio: boolean; ventas: bigint; cobrado: number | null }>
            >(
                Prisma.sql`
                    SELECT c."contactSource"        AS canal,
                           (c."adTag" IS NULL)      AS "sinAnuncio",
                           count(DISTINCT p."orderId") AS ventas,
                           COALESCE(sum(p."amount"), 0) AS cobrado
                    FROM "Payment" p
                    JOIN "Order" o  ON o."id" = p."orderId"
                    JOIN "Client" c ON c."id" = o."clientId"
                    WHERE p."date" >= ${desde} AND p."date" < ${hasta}
                      AND o."isDeleted" = false AND c."isDeleted" = false
                    GROUP BY 1, 2`,
            ),
        ]);

        const porCanal = new Map<string, CanalAtribucion>();
        const fila = (canal: string): CanalAtribucion => {
            const existente = porCanal.get(canal);
            if (existente) return existente;
            const nueva = vacio(canal);
            porCanal.set(canal, nueva);
            return nueva;
        };
        const metaSinAnuncio: CanalAtribucion = {
            ...vacio(`${CANAL_META} (sin anuncio identificado)`),
            esSubfila: true,
        };

        for (const c of clientes) {
            const canal = normalizeContactSource(c.contactSource);
            fila(canal).clientesNuevos++;
            if (canal === CANAL_META && !c.adTag) metaSinAnuncio.clientesNuevos++;
        }

        for (const r of cobros) {
            const canal = normalizeContactSource(r.canal);
            const ventas = Number(r.ventas);
            const cobrado = Number(r.cobrado || 0);
            const f = fila(canal);
            f.ventasCobradas += ventas;
            f.cobrado += cobrado;
            if (canal === CANAL_META && r.sinAnuncio) {
                metaSinAnuncio.ventasCobradas += ventas;
                metaSinAnuncio.cobrado += cobrado;
            }
        }

        // 'Sin origen' va último: es el pendiente de carga, no un canal que compita.
        const canales = [...porCanal.values()].sort((a, b) => {
            if (a.canal === SIN_ORIGEN) return 1;
            if (b.canal === SIN_ORIGEN) return -1;
            return b.clientesNuevos - a.clientesNuevos || b.cobrado - a.cobrado;
        });

        // Lo que Meta trajo pero NO se pudo atribuir a un anuncio va como fila
        // propia debajo de Meta —incluso en cero—, para que se vea el tamaño del
        // agujero de medición en vez de tener que deducirlo.
        const iMeta = canales.findIndex((c) => c.canal === CANAL_META);
        if (iMeta >= 0) canales.splice(iMeta + 1, 0, metaSinAnuncio);

        return { canales, metaSinAnuncio };
    }

    /**
     * Todo lo que necesita la pantalla de atribución en una sola lectura.
     *
     * A diferencia de `porAnuncio`, acá NO se filtran las filas sin movimiento
     * (un anuncio que trajo diez chats y ninguna venta es justamente lo que hay
     * que ver) y una caída de Meta no rompe la pantalla: el gasto queda en cero
     * con un aviso, y lo propio —chats, clientes, ventas— se sigue mostrando.
     */
    static async getAtribucion(dias: RangoAtribucion): Promise<Atribucion> {
        const desde = arDayStart(dias);
        const hasta = arDayStart(0);

        let mapaGasto: MapaGasto = new Map();
        let disponible = false;
        let aviso: string | null = null;

        if (!metaAdsConfigured()) {
            aviso =
                'Este servidor no tiene cargadas las credenciales de lectura de Meta Ads, así que el gasto figura en cero. Los chats, clientes y ventas de abajo sí son reales.';
        } else {
            try {
                mapaGasto = await fetchSpendByTag(PRESET_META[dias]);
                disponible = true;
            } catch (e) {
                // El mensaje ya viene con los secretos tapados desde meta-insights.
                aviso = `No se pudo leer el gasto en Meta (${e instanceof Error ? e.message : 'error desconocido'}). El resto de la tabla es real; el gasto y el retorno quedan en cero.`;
            }
        }

        const [anuncios, canal] = await Promise.all([
            cruzar(desde, hasta, mapaGasto),
            AttributionService.porCanal(desde, hasta),
        ]);

        const totales = anuncios.reduce<TotalesAtribucion>(
            (a, f) => ({
                gasto: a.gasto + f.gasto,
                chats: a.chats + f.chats,
                clientesNuevos: a.clientesNuevos + f.clientesNuevos,
                presupuestados: a.presupuestados + f.presupuestados,
                presupuestado: a.presupuestado + f.presupuestado,
                cierres: a.cierres + f.cierres,
                facturadoReal: a.facturadoReal + f.facturadoReal,
                cobrado: a.cobrado + f.cobrado,
                costoPorChat: null,
                roas: null,
            }),
            {
                gasto: 0, chats: 0, clientesNuevos: 0, presupuestados: 0,
                presupuestado: 0, cierres: 0, facturadoReal: 0, cobrado: 0,
                costoPorChat: null, roas: null,
            },
        );
        totales.costoPorChat = totales.gasto > 0 && totales.chats > 0 ? totales.gasto / totales.chats : null;
        totales.roas = calcularRoas(totales.gasto, totales.facturadoReal);

        return {
            rango: { dias, desde: desde.toISOString(), hasta: hasta.toISOString() },
            anuncios,
            totales,
            canales: canal.canales,
            metaSinAnuncio: canal.metaSinAnuncio,
            gasto: { disponible, aviso },
        };
    }
}
