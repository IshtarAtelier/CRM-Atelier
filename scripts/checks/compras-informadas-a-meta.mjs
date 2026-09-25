/**
 * ¿Cada compra le llegó a Meta? Cruza las ventas del CRM contra la outbox
 * `MetaConversion` (lo que el sistema anotó y lo que Meta aceptó).
 *
 *   node scripts/checks/compras-informadas-a-meta.mjs [--prod] [--dias 14]
 *   (o: npm run check:meta-compras -- --prod)
 *
 * SOLO LEE. Sin --prod pega a la base local (DATABASE_URL); con --prod, a
 * PROD_DATABASE_URL — pedir OK antes.
 *
 * Qué mirar:
 *   · "SIN ANOTAR" después de la fecha del primer registro = una venta que
 *     nunca pasó por la outbox: hay un camino de venta que no la llama. Eso
 *     es un bug, no un problema de Meta.
 *   · FAILED/PENDING viejas = Meta no las acepta; casi siempre es el token
 *     del Conversions API (META_ACCESS_TOKEN en Railway).
 *   · EXPIRED/REJECTED = ya no van a entrar; el mail del cron las avisó.
 *   · Las ventas anteriores al primer registro no tienen fila y es normal:
 *     el sistema empezó a anotar recién con el deploy del 25/9/2026.
 *   · Los pedidos MAYORISTAS no se informan a Meta a propósito (ver
 *     src/app/api/checkout/payway/route.ts) y acá no se listan.
 *
 * Sale con código 1 si hay ventas SIN ANOTAR posteriores al primer registro
 * o compras vencidas/rechazadas sin avisar: así sirve como guardián.
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const usarProd = args.includes('--prod');
const iDias = args.indexOf('--dias');
const DIAS = iDias !== -1 ? Number(args[iDias + 1]) : 14;

const env = Object.fromEntries(
    readFileSync(new URL('../../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);
const url = usarProd ? env.PROD_DATABASE_URL : env.DATABASE_URL;
if (!url) { console.error('Falta la URL de la base en .env'); process.exit(1); }
console.log(`Base: ${usarProd ? 'PRODUCCIÓN' : 'local'} — ventas de los últimos ${DIAS} días\n`);

const prisma = new PrismaClient({ datasourceUrl: url });
const fecha = (d) => (d ? new Date(d).toLocaleString('es-AR', { timeZone: 'America/Argentina/Cordoba', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const plata = (n) => `$${Math.round(Number(n || 0)).toLocaleString('es-AR')}`;

try {
    const desde = new Date(Date.now() - DIAS * 86400_000);
    const primerRegistro = await prisma.$queryRaw`SELECT MIN("createdAt") AS "desde" FROM "MetaConversion"`;
    const anotaDesde = primerRegistro?.[0]?.desde ? new Date(primerRegistro[0].desde) : null;
    console.log(`La outbox anota compras desde: ${anotaDesde ? fecha(anotaDesde) : 'NUNCA (todavía no hay filas: ¿se deployó?)'}\n`);

    const filas = await prisma.$queryRaw`
        SELECT o.id, o."labSentAt", o."createdAt", o.total, o.status,
               mc."actionSource", mc.status AS "mcStatus", mc.attempts, mc."lastError", mc."sentAt", mc."eventTime", mc."alertedAt"
        FROM "Order" o
        LEFT JOIN "MetaConversion" mc ON mc."orderId" = o.id
        WHERE o."isDeleted" = false
          AND o."orderType" = 'SALE'
          AND COALESCE(o."labSentAt", o."createdAt") >= ${desde}
        ORDER BY COALESCE(o."labSentAt", o."createdAt") DESC`;

    const resumen = { total: filas.length, SENT: 0, PENDING: 0, FAILED: 0, SENDING: 0, EXPIRED: 0, REJECTED: 0, sinAnotarPosteriores: 0, sinAnotarAnteriores: 0 };
    const problemas = [];
    for (const f of filas) {
        const momento = new Date(f.labSentAt || f.createdAt);
        if (!f.mcStatus) {
            if (anotaDesde && momento >= anotaDesde) { resumen.sinAnotarPosteriores++; problemas.push({ ...f, motivo: 'SIN ANOTAR (venta posterior al primer registro: falta un camino)' }); }
            else resumen.sinAnotarAnteriores++;
            continue;
        }
        resumen[f.mcStatus] = (resumen[f.mcStatus] || 0) + 1;
        if (f.mcStatus === 'EXPIRED' || f.mcStatus === 'REJECTED') problemas.push({ ...f, motivo: `${f.mcStatus}${f.alertedAt ? ' (ya avisada)' : ' (SIN AVISAR)'}` });
        if ((f.mcStatus === 'FAILED' || f.mcStatus === 'PENDING') && Date.now() - momento.getTime() > 3600_000) problemas.push({ ...f, motivo: `${f.mcStatus} hace más de 1 h (${f.attempts} intentos)` });
    }

    console.log(`Ventas en la ventana: ${resumen.total}`);
    console.log(`  llegaron a Meta (SENT):        ${resumen.SENT}`);
    console.log(`  en camino (PENDING/SENDING):   ${resumen.PENDING + resumen.SENDING}`);
    console.log(`  fallando (FAILED):             ${resumen.FAILED}`);
    console.log(`  vencidas / rechazadas:         ${resumen.EXPIRED} / ${resumen.REJECTED}`);
    console.log(`  sin anotar, anteriores al registro (normal): ${resumen.sinAnotarAnteriores}`);
    console.log(`  sin anotar, POSTERIORES al registro (BUG):   ${resumen.sinAnotarPosteriores}\n`);

    if (problemas.length) {
        console.log('Para mirar:');
        for (const p of problemas) {
            console.log(`  · ${p.id} · ${fecha(p.labSentAt || p.createdAt)} · ${plata(p.total)} · ${p.actionSource || '?'} · ${p.motivo}${p.lastError ? ` · ${String(p.lastError).slice(0, 120)}` : ''}`);
        }
        console.log('');
    }

    const grave = resumen.sinAnotarPosteriores > 0 || problemas.some((p) => /SIN AVISAR/.test(p.motivo));
    console.log(grave ? '❌ Hay compras que no se informaron a Meta y nadie avisó.' : '✅ Toda venta de la ventana está anotada, y lo que no entró está avisado.');
    process.exitCode = grave ? 1 : 0;
} finally {
    await prisma.$disconnect();
}
