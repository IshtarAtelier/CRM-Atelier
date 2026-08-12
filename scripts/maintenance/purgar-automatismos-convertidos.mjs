// ────────────────────────────────────────────────────────────────────────────
// Aplica hacia atrás la regla del 12/8/2026: "cuando el pedido se convierte en
// venta, el cliente sale de todo lo automático; solo queda lo que el vendedor
// registró a mano". El hook nuevo en order.service.ts lo hace de acá en más;
// este script limpia a los YA convertidos (status CLIENT/active) que quedaron
// arrastrando automatismos de antes:
//   · ClientTask PENDING de origen sistema (type FOLLOWUP, o createdBy
//     'Sistema…'/'Bot') — las tareas creadas por humanos NO se tocan.
//   · Etiquetas SEGUIMIENTO_* en sus chats (alimentan los tiers del bot) y el
//     followUpPausedUntil, que ya no significan nada para un convertido.
//
// ⚠️ ESCRIBE en la base que diga PURGA_DB_URL (o DATABASE_URL). Por defecto
// SIMULA; solo ejecuta con --aplicar.
//
//   TAREAS: PURGA_DB_URL="$PROD_DATABASE_URL" node --env-file=.env \
//             scripts/maintenance/purgar-automatismos-convertidos.mjs [--aplicar]
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const url = process.env.PURGA_DB_URL || process.env.DATABASE_URL;
const esProd = !/localhost|127\.0\.0\.1/.test(url || '');
const aplicar = process.argv.includes('--aplicar');
const prisma = new PrismaClient({ datasources: { db: { url } } });

console.log(`\n— Purga de automatismos de clientes convertidos (base: ${esProd ? 'PRODUCCIÓN' : 'local'} · modo: ${aplicar ? 'APLICAR' : 'simulacro'}) —\n`);

const filtroTareas = {
    status: 'PENDING',
    client: { status: { in: ['CLIENT', 'active'] }, isDeleted: false },
    OR: [
        { type: 'FOLLOWUP' },
        { createdBy: { startsWith: 'Sistema' } },
        { createdBy: 'Bot' },
    ],
};

const tareas = await prisma.clientTask.findMany({
    where: filtroTareas,
    select: { id: true, type: true, createdBy: true, client: { select: { name: true } } },
});
const porTipo = {};
for (const t of tareas) {
    const k = t.type === 'FOLLOWUP' ? 'FOLLOWUP (tiers del bot)' : `TASK de ${t.createdBy}`;
    porTipo[k] = (porTipo[k] || 0) + 1;
}
console.log(`Tareas del sistema pendientes de clientes YA convertidos: ${tareas.length}`);
for (const [k, c] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(4)}  ${k}`);

const chats = await prisma.whatsAppChat.findMany({
    where: { client: { status: { in: ['CLIENT', 'active'] }, isDeleted: false } },
    select: { id: true, chatLabels: true, followUpPausedUntil: true },
});
const chatsConSeguimiento = chats.filter(c =>
    (c.chatLabels || []).some(l => l.startsWith('SEGUIMIENTO_')) || c.followUpPausedUntil
);
console.log(`Chats de convertidos con etiquetas SEGUIMIENTO_* o pausa colgada: ${chatsConSeguimiento.length}`);

if (aplicar) {
    const r = await prisma.clientTask.deleteMany({ where: filtroTareas });
    for (const c of chatsConSeguimiento) {
        await prisma.whatsAppChat.update({
            where: { id: c.id },
            data: {
                chatLabels: (c.chatLabels || []).filter(l => !l.startsWith('SEGUIMIENTO_')),
                followUpPausedUntil: null,
            },
        });
    }
    console.log(`\n✅ Borradas ${r.count} tareas del sistema y saneados ${chatsConSeguimiento.length} chats.`);
} else {
    console.log('\n(simulacro: nada se tocó — correr con --aplicar para ejecutar)');
}
await prisma.$disconnect();
console.log('');
