// ────────────────────────────────────────────────────────────────────────────
// CIERRA EL SALDO de ventas puntuales con un DESCUENTO ESPECIAL igual al saldo
// de lista. ESCRIBE EN LA BASE (con --aplicar; sin él, solo muestra).
//
// Caso que lo originó (29/9/2026, Ishtar): cinco ventas donde el cliente pagó
// por transferencia el importe exacto del precio de efectivo. El sistema decía
// que debían el 5% de diferencia; decisión: descuento especial, que queden en
// cero. No se toca `paid` ni se inventan pagos: se hace lo mismo que haría el
// admin desde la pantalla al aplicar un descuento especial —
//   specialDiscount    += saldo de lista
//   subtotalWithMarkup −= saldo de lista
//   total               = subtotalWithMarkup × (1 − descuento efectivo)
// — y queda firmado en la ficha (Interaction) y en AuditLog.
//
// Correr (producción, solo mostrar):
//   node --env-file=.env --experimental-strip-types --import ./scripts/checks/_alias.mjs \
//        scripts/maintenance/cerrar-saldos-con-descuento-especial.mjs --prod --ids id1,id2 --actor Ishtar
// Aplicar de verdad: agregar --aplicar
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { PricingService } from '@/services/PricingService';
import { formatearPrecio } from '@/lib/format-precio';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const prod = args.includes('--prod');
const aplicar = args.includes('--aplicar');
const ids = (flag('--ids') || '').split(',').map(s => s.trim()).filter(Boolean);
const actorName = flag('--actor');
const motivo = flag('--motivo') || 'transferencia aceptada al precio de efectivo';
if (ids.length === 0 || !actorName) { console.error('Uso: --ids a,b,c --actor Nombre [--motivo "..."] [--prod] [--aplicar]'); process.exit(1); }

const url = prod ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error('Falta la URL de la base en .env'); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url } } });
const p = (n) => formatearPrecio(n);

const actor = await prisma.user.findFirst({ where: { name: { equals: actorName, mode: 'insensitive' }, role: 'ADMIN' }, select: { id: true, name: true } });
if (!actor) { console.error(`No hay un ADMIN llamado "${actorName}" en esta base.`); await prisma.$disconnect(); process.exit(1); }

const ventas = await prisma.order.findMany({
    where: { id: { in: ids }, isDeleted: false },
    select: {
        id: true, total: true, paid: true, subtotalWithMarkup: true, specialDiscount: true,
        discountCash: true, discountTransfer: true, orderType: true, labStatus: true,
        client: { select: { id: true, name: true } },
        payments: { select: { amount: true, method: true } },
    },
});
const faltan = ids.filter(id => !ventas.some(v => v.id === id));
if (faltan.length) console.log(`No encontradas (o borradas): ${faltan.join(', ')}`);

console.log(`\nBase: ${prod ? 'PRODUCCIÓN' : 'local'} · modo: ${aplicar ? 'APLICAR' : 'solo mostrar'} · actor: ${actor.name}\n`);
const cambios = [];
for (const v of ventas) {
    const antes = PricingService.calculateOrderFinancials(v);
    const nombre = (v.client?.name || '').trim();
    if (!antes.hasBalance) { console.log(`${nombre}: ya no tiene saldo, no se toca.`); continue; }
    const D = antes.remainingList;
    const discCash = v.discountCash ?? 20;
    const nuevo = {
        specialDiscount: Math.round((v.specialDiscount || 0) + D),
        subtotalWithMarkup: Math.round((v.subtotalWithMarkup || v.total) - D),
    };
    nuevo.total = Math.round(nuevo.subtotalWithMarkup * (1 - discCash / 100));
    const despues = PricingService.calculateOrderFinancials({ ...v, ...nuevo });
    const totalEsperadoAntes = Math.round((v.subtotalWithMarkup || 0) * (1 - discCash / 100));
    console.log(`${nombre} — ${v.labStatus} — ${v.id}`);
    console.log(`  antes:   lista ${p(v.subtotalWithMarkup)} · total(efvo) ${p(v.total)}${Math.abs(totalEsperadoAntes - v.total) > 1 ? ` (OJO: no es lista×(1−${discCash}%) = ${p(totalEsperadoAntes)})` : ''} · dto. especial ${p(v.specialDiscount || 0)} · saldo lista ${p(antes.remainingList)}`);
    console.log(`  después: lista ${p(nuevo.subtotalWithMarkup)} · total(efvo) ${p(nuevo.total)} · dto. especial ${p(nuevo.specialDiscount)} · saldo lista ${p(despues.remainingList)} → ${despues.hasBalance ? 'SIGUE CON SALDO (no se aplica)' : 'sin saldo'}`);
    if (!despues.hasBalance) cambios.push({ v, nuevo, D, nombre });
}

if (!aplicar) { console.log(`\n${cambios.length} venta(s) a cerrar. Nada escrito: falta --aplicar.`); await prisma.$disconnect(); process.exit(0); }

for (const { v, nuevo, D, nombre } of cambios) {
    await prisma.$transaction([
        prisma.order.update({ where: { id: v.id }, data: nuevo, select: { id: true } }),
        prisma.interaction.create({
            data: {
                clientId: v.client.id, type: 'NOTE', userId: actor.id, userName: actor.name,
                content: `💸 ${actor.name} aplicó un descuento especial de ${p(D)} sobre la venta #${v.id.slice(-4).toUpperCase()} para cerrar el saldo (${motivo}). La venta queda sin saldo.`,
            },
        }),
        prisma.auditLog.create({
            data: {
                userId: actor.id, userName: actor.name, action: 'UPDATE', entityType: 'ORDER', entityId: v.id,
                details: {
                    motivo: `Cierre de saldo con descuento especial: ${motivo}`,
                    antes: { specialDiscount: v.specialDiscount || 0, subtotalWithMarkup: v.subtotalWithMarkup, total: v.total },
                    despues: nuevo,
                    script: 'scripts/maintenance/cerrar-saldos-con-descuento-especial.mjs',
                },
            },
        }),
    ]);
    console.log(`✔ ${nombre}: cerrada con descuento especial de ${p(D)}.`);
}
await prisma.$disconnect();
