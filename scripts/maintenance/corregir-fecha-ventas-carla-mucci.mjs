// ────────────────────────────────────────────────────────────────────────────
// Corrige la fecha de 3 ventas de Carla Mucci que quedaron en agosto.
//
// QUÉ PASÓ. Es un pedido viejo que hubo que volver a enviar al laboratorio. Al
// recargarlo, la ficha y las tres ventas se crearon el 15/8/2026, así que
// quedaron contadas en la facturación de agosto — pero la venta es del 2/7/2026,
// que es cuando la clienta pagó (las tres tienen su pago de esa fecha).
//
// QUÉ TOCA. Dos campos por venta:
//   · labSentAt — es el que decide en qué mes cae la venta. El cierre de mes
//     (src/app/api/cron/month-close/route.ts:95) filtra por labSentAt y solo cae
//     a createdAt cuando labSentAt es null. Sin tocar este, la venta sigue
//     sumando en agosto por más que se cambie la fecha de creación.
//   · createdAt — es la fecha que se ve en la ficha y en el listado de ventas.
//
// NO toca importes, ni pagos, ni el estado de laboratorio, ni nada más.
//
// RASTRO. Cada venta corregida deja una Interaction firmada en la ficha y una
// fila en AuditLog con los valores viejos, para poder revertir y para que
// alguien que mire la ficha en tres meses entienda por qué las fechas no
// coinciden con cuándo se cargó.
//
// CORRER (simulacro, no escribe nada):
//   node --env-file=.env scripts/maintenance/corregir-fecha-ventas-carla-mucci.mjs
// APLICAR de verdad:
//   node --env-file=.env scripts/maintenance/corregir-fecha-ventas-carla-mucci.mjs --aplicar
//
// Pega contra PROD_DATABASE_URL.
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const APLICAR = process.argv.includes('--aplicar');

const CLIENTE_ID = 'cmsujoide026clgbbk3kjrcea';
/** 2/7/2026 12:00 ART. Mediodía para que ningún huso lo corra de día. */
const FECHA_REAL = new Date('2026-07-02T15:00:00.000Z');
/** Las tres ventas, por los últimos 4 del id (como se ven en el panel). */
const VENTAS = ['FC1Z', 'CBTV', 'BM4D'];

const ACTOR = { userId: null, userName: 'Ishtar (corrección de fecha)' };

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.PROD_DATABASE_URL } },
});

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

async function main() {
    if (!process.env.PROD_DATABASE_URL) {
        console.error('Falta PROD_DATABASE_URL. Correr con: node --env-file=.env …');
        process.exit(1);
    }

    console.log(APLICAR ? '⚠️  MODO APLICAR — escribe en producción\n' : '🔍 SIMULACRO — no escribe nada (agregá --aplicar)\n');

    const ordenes = await prisma.order.findMany({
        where: { clientId: CLIENTE_ID, orderType: 'SALE', isDeleted: false },
        select: { id: true, total: true, createdAt: true, labSentAt: true, labOrderNumber: true },
    });

    const objetivo = ordenes.filter(o => VENTAS.includes(o.id.slice(-4).toUpperCase()));

    if (objetivo.length !== VENTAS.length) {
        console.error(`Se esperaban ${VENTAS.length} ventas y se encontraron ${objetivo.length}. Abortando por las dudas.`);
        console.error('Encontradas:', objetivo.map(o => o.id.slice(-4).toUpperCase()).join(', ') || '(ninguna)');
        process.exit(1);
    }

    let corregidas = 0;

    for (const o of objetivo) {
        const nro = o.id.slice(-4).toUpperCase();
        const yaEstaba = fmt(o.labSentAt) === fmt(FECHA_REAL) && fmt(o.createdAt) === fmt(FECHA_REAL);

        console.log(`#${nro} — $${o.total.toLocaleString('es-AR')} — lab#${o.labOrderNumber || '—'}`);
        console.log(`   creado:  ${fmt(o.createdAt)}  →  ${fmt(FECHA_REAL)}`);
        console.log(`   a lab:   ${fmt(o.labSentAt)}  →  ${fmt(FECHA_REAL)}`);

        if (yaEstaba) {
            console.log('   ya estaba corregida, se saltea\n');
            continue;
        }

        if (!APLICAR) { console.log('   (simulacro)\n'); continue; }

        const viejo = { createdAt: o.createdAt, labSentAt: o.labSentAt };

        await prisma.order.update({
            where: { id: o.id },
            // `select` explícito: contra producción, devolver la fila entera
            // revienta porque el schema local está adelantado.
            select: { id: true },
            data: { createdAt: FECHA_REAL, labSentAt: FECHA_REAL },
        });

        await prisma.interaction.create({
            data: {
                clientId: CLIENTE_ID,
                type: 'SISTEMA',
                content:
                    `📅 Se corrigió la fecha de la venta #${nro} ($${o.total.toLocaleString('es-AR')}): ` +
                    `pasa de ${fmt(viejo.createdAt)} a ${fmt(FECHA_REAL)}.\n` +
                    `Motivo: es un pedido viejo que hubo que volver a enviar al laboratorio; al recargarlo ` +
                    `quedó con fecha de agosto y sumaba en la facturación de ese mes. La fecha real es la ` +
                    `del pago de la clienta (2/7/2026).\n` +
                    `Valores anteriores — creado: ${fmt(viejo.createdAt)} · enviado a lab: ${fmt(viejo.labSentAt)}.`,
                userId: ACTOR.userId,
                userName: ACTOR.userName,
            },
        });

        await prisma.auditLog.create({
            data: {
                userId: ACTOR.userId,
                userName: ACTOR.userName,
                action: 'UPDATE',
                entityType: 'ORDER',
                entityId: o.id,
                details: {
                    motivo: 'corrección de fecha: pedido viejo reenviado, la venta es del mes anterior',
                    antes: { createdAt: viejo.createdAt, labSentAt: viejo.labSentAt },
                    despues: { createdAt: FECHA_REAL, labSentAt: FECHA_REAL },
                },
            },
        });

        console.log('   ✅ corregida\n');
        corregidas++;
    }

    console.log(APLICAR
        ? `Listo: ${corregidas} venta(s) corregida(s).`
        : 'Simulacro terminado. Para aplicarlo de verdad: agregá --aplicar');

    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error('ERROR:', e.message);
    await prisma.$disconnect();
    process.exit(1);
});
