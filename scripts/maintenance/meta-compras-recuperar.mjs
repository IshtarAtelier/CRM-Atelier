/**
 * Recupera las ventas del local que NO le llegaron a Meta y las deja anotadas
 * en la outbox `MetaConversion` para que el cron de producción las mande.
 * ESCRIBE en la base (solo con `--aplicar`). NUNCA le habla a Meta desde acá.
 *
 * PARA QUÉ
 * Hasta el deploy del 25/9/2026 la venta del local viajaba a Meta con la fecha
 * del PRESUPUESTO (createdAt). Meta rechaza cualquier evento con más de 7 días,
 * así que toda venta cerrada sobre un presupuesto de más de una semana se
 * rechazó en silencio. Este script las encuentra y las anota con la fecha
 * correcta (labSentAt) para que entren, mientras sigan dentro de la ventana de
 * 7 días que Meta acepta.
 *
 * QUÉ RECUPERA (y qué no, para no contar doble)
 * - SÍ: ventas del local (orderType SALE, no borradas) enviadas a fábrica en
 *   los últimos --dias (default 7) cuyo presupuesto tenía MÁS de 7 días al
 *   convertirse: esas Meta seguro las rechazó, reenviarlas no duplica nada.
 * - NO: las que ya tienen fila en la outbox (anotadas por el sistema nuevo).
 * - NO: las compras web (ya salieron bien, con event_id, desde el checkout).
 * - NO: las que tenían el presupuesto dentro de los 7 días: lo más probable es
 *   que Meta las haya aceptado, y como iban sin event_id un reenvío contaría la
 *   venta dos veces. Con `--tambien-las-dudosas` se incluyen igual (a sabiendas).
 * - NO: las enviadas a fábrica hace más de 7 días: Meta ya no las acepta.
 *
 * POR QUÉ NO MANDA DESDE ACÁ
 * El token de conversiones del `.env` local no puede escribir (y conviene que
 * siga así: una Mac con token de escritura mandaría compras de prueba al píxel
 * real). Acá solo se ANOTAN como PENDING; el cron `/api/cron/meta-conversiones`
 * de producción las manda con su token en los próximos 10 minutos, con
 * reintentos y aviso. Requiere que el deploy con la tabla ya esté hecho.
 *
 * Uso:
 *   node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/maintenance/meta-compras-recuperar.mjs --produccion
 *   node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/maintenance/meta-compras-recuperar.mjs --produccion --aplicar
 * Después:  npm run check:meta-compras -- --prod
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { AdsService } from '../../src/services/ads.service.ts';
import { VENTANA_META_MS } from '../../src/services/meta-conversions.service.ts';

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const PRODUCCION = args.includes('--produccion') || args.includes('--prod');
const DUDOSAS = args.includes('--tambien-las-dudosas');
const iDias = args.indexOf('--dias');
const DIAS = iDias !== -1 ? Number(args[iDias + 1]) : 7;

const env = Object.fromEntries(
    readFileSync(new URL('../../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);
const url = PRODUCCION ? env.PROD_DATABASE_URL : env.DATABASE_URL;
if (!url) { console.error('Falta la URL de la base en .env'); process.exit(1); }

const DIA_MS = 24 * 3600_000;
const fecha = (d) => (d ? new Date(d).toLocaleString('es-AR', { timeZone: 'America/Argentina/Cordoba', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const plata = (n) => `$${Math.round(Number(n || 0)).toLocaleString('es-AR')}`;

console.log(`Base: ${PRODUCCION ? 'PRODUCCIÓN' : 'local'} · ventas enviadas a fábrica en los últimos ${DIAS} días · ${APLICAR ? 'APLICAR (anota en la outbox)' : 'solo mostrar (sin --aplicar no escribe nada)'}\n`);

const prisma = new PrismaClient({ datasourceUrl: url });
try {
    const tabla = await prisma.$queryRaw`SELECT to_regclass('"MetaConversion"')::text AS t`;
    if (!tabla?.[0]?.t) {
        console.error('La tabla MetaConversion todavía no existe en esta base: primero hay que deployar la rama con la migración 20260925_meta_conversion.');
        process.exit(1);
    }

    const ahora = Date.now();
    const desde = new Date(ahora - DIAS * DIA_MS);
    const ventas = await prisma.$queryRaw`
        SELECT o.id, o."createdAt", o."labSentAt", o.total,
               c.email, c.phone, c.name,
               EXISTS (SELECT 1 FROM "MetaConversion" m WHERE m."orderId" = o.id) AS "yaAnotada",
               EXISTS (SELECT 1 FROM "AnalyticsEvent" a WHERE a."orderId" = o.id AND a.type = 'purchase') AS "esWeb"
        FROM "Order" o
        JOIN "Client" c ON c.id = o."clientId"
        WHERE o."isDeleted" = false
          AND o."orderType" = 'SALE'
          AND o."labSentAt" IS NOT NULL
          AND o."labSentAt" >= ${desde}
        ORDER BY o."labSentAt" DESC`;

    const grupos = { recuperar: [], yaAnotadas: [], web: [], dudosas: [], vencidas: [] };
    for (const v of ventas) {
        const labSentAt = new Date(v.labSentAt);
        const gapDias = (labSentAt.getTime() - new Date(v.createdAt).getTime()) / DIA_MS;
        if (v.yaAnotada) grupos.yaAnotadas.push(v);
        else if (v.esWeb) grupos.web.push(v);
        else if (ahora - labSentAt.getTime() > VENTANA_META_MS) grupos.vencidas.push(v);
        else if (gapDias > 7 || DUDOSAS) grupos.recuperar.push({ ...v, gapDias });
        else grupos.dudosas.push({ ...v, gapDias });
    }

    console.log(`Ventas del local en la ventana: ${ventas.length}`);
    console.log(`  ya anotadas por el sistema nuevo:        ${grupos.yaAnotadas.length}`);
    console.log(`  compras web (salieron desde el checkout): ${grupos.web.length}`);
    console.log(`  vencidas (Meta ya no las acepta):         ${grupos.vencidas.length}`);
    console.log(`  dudosas (presupuesto ≤ 7 días, quizás ya entraron): ${grupos.dudosas.length}${grupos.dudosas.length && !DUDOSAS ? ' → se saltean; --tambien-las-dudosas para incluirlas' : ''}`);
    console.log(`  A RECUPERAR:                              ${grupos.recuperar.length}\n`);

    for (const v of grupos.recuperar) {
        console.log(`  · ${v.id} · venta ${fecha(v.labSentAt)} · presupuesto de hace ${Math.round(v.gapDias)} días · ${plata(v.total)} · ${v.email ? 'email' : 'sin email'}${v.phone ? ', tel' : ', sin tel'}`);
    }

    if (!APLICAR || !grupos.recuperar.length) {
        console.log(grupos.recuperar.length ? '\nNo se escribió nada. Para anotarlas: agregar --aplicar.' : '\nNada que recuperar.');
    } else {
        let anotadas = 0;
        for (const v of grupos.recuperar) {
            const eventTime = new Date(v.labSentAt);
            const payload = AdsService.buildPurchaseEvent(
                { id: v.id, total: Number(v.total || 0), client: { email: v.email, phone: v.phone, name: v.name }, createdAt: eventTime },
                'physical_store',
                { eventTime },
            );
            await prisma.metaConversion.create({
                data: { orderId: v.id, actionSource: 'physical_store', eventTime, value: Number(v.total || 0), payload },
                select: { id: true },
            });
            anotadas++;
        }
        console.log(`\n✅ ${anotadas} venta(s) anotadas como PENDING. El cron de producción las manda en los próximos 10 minutos.`);
        console.log('   Verificar con: npm run check:meta-compras -- --prod');
    }
} finally {
    await prisma.$disconnect();
}
