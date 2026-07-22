// Repara los pagos cuya fecha quedó con el día y el año dados vuelta.
//
// Causa: los tickets de Payway/Naranja imprimen la fecha como dd/mm/aa y el OCR
// la devolvía leyendo el PRIMER número como año y el ÚLTIMO como día:
//   ticket 22/07/26  →  se guardó "2022-07-26"  (correcto: 2026-07-22)
// El monto siempre quedó bien imputado al pedido; lo que se rompe es todo reporte
// por rango de fechas (caja, cierre de mes, conciliación).
//
// Reconstrucción (determinística, es la inversa exacta del error):
//   día real  = últimos dos dígitos del año guardado
//   año real  = 2000 + día guardado
//   mes       = queda igual
//
// Uso:
//   node scripts/utils/fix_fechas_pago_invertidas.js          → simulacro (no escribe)
//   node scripts/utils/fix_fechas_pago_invertidas.js --aplicar → escribe en PRODUCCIÓN
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '/Users/ishtarpissano/proyectos/atelier/.env' });
const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });

const APLICAR = process.argv.includes('--aplicar');
const ACTOR = { id: null, name: 'Ishtar (vía Copilot)' };

const iso = (d) => d.toISOString().slice(0, 10);
const ar = (d) => { const [a, m, x] = iso(d).split('-'); return `${x}/${m}/${a}`; };

/** Da vuelta el error: 2022-07-26 → 2026-07-22. Devuelve null si no aplica. */
function reconstruir(fecha) {
    const [anio, mes, dia] = iso(fecha).split('-').map(Number);
    const diaReal = anio % 100;
    const anioReal = 2000 + dia;
    if (diaReal < 1 || diaReal > 31) return null;
    const cand = new Date(Date.UTC(anioReal, mes - 1, diaReal));
    // Tiene que dar un día real de ese mes (no un 31 de febrero corrido)
    if (cand.getUTCDate() !== diaReal || cand.getUTCMonth() !== mes - 1) return null;
    return cand;
}

async function main() {
    console.log(APLICAR ? '*** MODO ESCRITURA — base de PRODUCCIÓN ***\n' : '--- SIMULACRO (no se escribe nada) ---\n');

    const ahora = new Date();
    const PISO = new Date('2024-01-01T00:00:00Z');
    const TECHO = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

    const rotos = await prisma.payment.findMany({
        where: { OR: [{ date: { lt: PISO } }, { date: { gt: TECHO } }] },
        orderBy: { date: 'asc' },
        select: {
            id: true, date: true, amount: true, method: true, createdByName: true,
            order: { select: { id: true, clientId: true, createdAt: true, client: { select: { name: true } } } },
        },
    });

    console.log(`Pagos con fecha fuera de rango: ${rotos.length}\n`);

    let corregidos = 0, salteados = 0;
    for (const p of rotos) {
        const nueva = reconstruir(p.date);
        const etiqueta = `$${p.amount.toLocaleString('es-AR')} ${p.method} — ${p.order.client?.name} — pedido #${p.order.id.slice(-4).toUpperCase()}`;

        if (!nueva) {
            console.log(`SALTEADO  ${ar(p.date)} → no se puede reconstruir | ${etiqueta}`);
            salteados++;
            continue;
        }
        // La fecha reconstruida tiene que caer en un rango sensato y no ser
        // anterior al pedido (no se cobra antes de que exista la venta).
        const anteriorAlPedido = nueva < new Date(iso(p.order.createdAt));
        if (nueva < PISO || nueva > TECHO || anteriorAlPedido) {
            console.log(`SALTEADO  ${ar(p.date)} → ${ar(nueva)} (${anteriorAlPedido ? 'anterior al pedido ' + ar(p.order.createdAt) : 'fuera de rango'}) | ${etiqueta}`);
            salteados++;
            continue;
        }

        console.log(`${APLICAR ? 'CORRIGE  ' : 'CORREGIRÍA'} ${ar(p.date)} → ${ar(nueva)} | ${etiqueta}`);

        if (APLICAR) {
            await prisma.payment.update({ where: { id: p.id }, data: { date: nueva } });
            await prisma.auditLog.create({
                data: {
                    userId: ACTOR.id, userName: ACTOR.name,
                    action: 'UPDATE', entityType: 'PAYMENT', entityId: p.id,
                    details: {
                        motivo: 'La fecha del pago tenía el día y el año dados vuelta (OCR de ticket dd/mm/aa). Se reconstruyó la fecha real del comprobante.',
                        antes: ar(p.date), despues: ar(nueva),
                        amount: p.amount, method: p.method, orderId: p.order.id,
                    },
                },
            });
            await prisma.interaction.create({
                data: {
                    clientId: p.order.clientId,
                    type: 'SISTEMA',
                    content: `🗓️ Se corrigió la fecha del pago de $${p.amount.toLocaleString('es-AR')} (${p.method}): figuraba ${ar(p.date)} y pasó a ${ar(nueva)}. El comprobante venía en formato dd/mm/aa y se había guardado con el día y el año invertidos. El monto y su imputación al pedido no cambian.`,
                    userId: ACTOR.id, userName: ACTOR.name,
                },
            });
        }
        corregidos++;
    }

    console.log(`\n${APLICAR ? 'Corregidos' : 'Se corregirían'}: ${corregidos} | Salteados: ${salteados}`);
    if (!APLICAR && corregidos) console.log('Para aplicarlo: node scripts/utils/fix_fechas_pago_invertidas.js --aplicar');

    await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
