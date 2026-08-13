// ────────────────────────────────────────────────────────────────────────────
// Venta blindada: una venta ENVIADA A FÁBRICA no se modifica por ningún camino.
//
// Nace de dos incidentes reales del 12/8/2026:
//   · se editó la receta de una venta ya enviada desde la ficha del cliente y
//     la venta cambió retroactivamente, sin rastro en ningún lado;
//   · la pestaña Ventas dejaba editar y GUARDAR las medidas del armazón de una
//     venta enviada.
// Este check dispara CADA vía de mutación contra una venta bloqueada y exige el
// rechazo. Si mañana alguien agrega un endpoint que escribe sin mirar el
// candado, esto lo delata.
//
// Corre contra la base LOCAL. Crea y borra sus propios datos.
// Correr:  npm run check:venta
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { OrderService } from '../../src/services/order.service.ts';
import { ContactService } from '../../src/services/contact.service.ts';

const prisma = new PrismaClient();
let passed = 0;
const check = (name, cond) => { assert.ok(cond, `FALLÓ: ${name}`); passed++; console.log(`  ✓ ${name}`); };

/** Corre `fn` y devuelve el mensaje de error, o null si NO lanzó. */
const rechaza = async (fn) => { try { await fn(); return null; } catch (e) { return e.message || String(e); } };

const MARCA = 'CHECK_VENTA_BLINDADA';
async function limpiar() {
    const cs = await prisma.client.findMany({ where: { name: MARCA }, select: { id: true } });
    for (const c of cs) {
        await prisma.orderItem.deleteMany({ where: { order: { clientId: c.id } } });
        await prisma.order.deleteMany({ where: { clientId: c.id } });
        await prisma.interaction.deleteMany({ where: { clientId: c.id } });
        await prisma.clientTask.deleteMany({ where: { clientId: c.id } });
        await prisma.prescription.deleteMany({ where: { clientId: c.id } });
        await prisma.client.delete({ where: { id: c.id } }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { email: { startsWith: 'check-venta-' } } });
}

console.log('\n— Venta blindada: nada se modifica después de enviar a fábrica —\n');
await limpiar();

// Actores propios del check (así no depende de qué usuarios haya en la base).
const vendedor = await prisma.user.create({
    data: { email: 'check-venta-vendedor@local', name: 'Vendedor', password: 'x', role: 'STAFF' },
});
const admin = await prisma.user.create({
    data: { email: 'check-venta-admin@local', name: 'Jefa', password: 'x', role: 'ADMIN' },
});

const cliente = await prisma.client.create({
    data: { name: MARCA, phone: '5490000000000', dni: '00000000', address: 'Calle 1', birthDate: new Date('1990-01-01'), status: 'CLIENT' },
});
const receta = await prisma.prescription.create({
    data: { clientId: cliente.id, sphereOD: -1, sphereOI: -1, pd: 60, heightOD: 20, heightOI: 20, imageUrl: '/x.jpg' },
});
const venta = await prisma.order.create({
    data: {
        clientId: cliente.id, userId: vendedor.id,
        orderType: 'SALE', status: 'CONFIRMED', total: 100000, paid: 100000,
        isLocked: true, labStatus: 'SENT', labSentAt: new Date(),
        prescriptionId: receta.id, frameA: '52', frameB: '32', labFrameShape: 'CATEYE', labColor: 'Degrade Gris',
        // v1: lo que deja la conversión real al enviar a fábrica.
        prescriptionSnapshot: JSON.stringify({
            v: 1, frozenAt: new Date().toISOString(), frozenBy: 'Vendedor', rx: receta,
        }),
    },
});

// ── 1. Receta congelada ──────────────────────────────────────────────────────
const errRxStaff = await rechaza(() => ContactService.updatePrescription(receta.id, { sphereOD: -9 }, 'STAFF'));
check('receta de venta enviada: STAFF NO puede editarla', !!errRxStaff && /enviada a fábrica/i.test(errRxStaff));

const errRxAdmin = await rechaza(() => ContactService.updatePrescription(receta.id, { sphereOD: -9 }, 'ADMIN'));
check('receta de venta enviada: tampoco el ADMIN (su camino es REABRIR)', !!errRxAdmin);

const errDel = await rechaza(() => ContactService.deletePrescription(receta.id, 'ADMIN'));
check('receta de venta enviada: no se puede BORRAR', !!errDel);

const rxSinTocar = await prisma.prescription.findUnique({ where: { id: receta.id } });
check('la receta quedó intacta tras los intentos', rxSinTocar.sphereOD === -1);

// ── 2. Candado total del pedido ──────────────────────────────────────────────
const casos = [
    ['medidas del armazón', { frameA: '99' }],
    ['forma del armazón', { labFrameShape: 'REDONDO' }],
    ['teñido', { labColor: 'Verde total' }],
    ['receta asociada', { prescriptionId: 'otra-receta' }],
    ['total', { total: 1 }],
    ['origen del armazón', { frameSource: 'USUARIO' }],
];
for (const [etiqueta, patch] of casos) {
    const err = await rechaza(() => OrderService.updateOrder(venta.id, patch, vendedor.id, 'Vendedor', 'STAFF'));
    check(`venta enviada: rechaza cambiar ${etiqueta}`, !!err && /enviada a fábrica|bloqueada/i.test(err));
}
const errAdminEdit = await rechaza(() => OrderService.updateOrder(venta.id, { frameA: '77' }, admin.id, 'Jefa', 'ADMIN'));
check('venta enviada: ni el ADMIN edita sin reabrir', !!errAdminEdit);

// Lo que SÍ debe poder avanzar en una venta enviada
const errLab = await rechaza(() => OrderService.updateOrder(venta.id, { labOrderNumber: 'OP-123' }, vendedor.id, 'Vendedor', 'STAFF'));
check('venta enviada: el flujo de laboratorio SÍ avanza (nº de operación)', errLab === null);

// Reenviar el mismo valor sin cambios no debe romper (las pantallas reenvían todo)
const errIdem = await rechaza(() => OrderService.updateOrder(venta.id, { frameA: '52' }, vendedor.id, 'Vendedor', 'STAFF'));
check('venta enviada: reenviar un valor SIN cambios no rompe', errIdem === null);

// ── 3. Reapertura ────────────────────────────────────────────────────────────
const errStaffAbre = await rechaza(() => OrderService.updateOrder(venta.id, { isLocked: false, reopenReason: 'x' }, vendedor.id, 'Vendedor', 'STAFF'));
check('reapertura: un vendedor NO puede reabrir', !!errStaffAbre && /administrador/i.test(errStaffAbre));

const errSinMotivo = await rechaza(() => OrderService.updateOrder(venta.id, { isLocked: false }, admin.id, 'Jefa', 'ADMIN'));
check('reapertura: el ADMIN necesita MOTIVO', !!errSinMotivo && /motivo/i.test(errSinMotivo));

const errAbre = await rechaza(() => OrderService.updateOrder(venta.id, { isLocked: false, reopenReason: 'El cliente cambió el armazón' }, admin.id, 'Jefa', 'ADMIN'));
check('reapertura: el ADMIN con motivo SÍ reabre', errAbre === null);

const notaReapertura = await prisma.interaction.findFirst({
    where: { clientId: cliente.id, content: { startsWith: '🔓' } },
});
check('la reapertura quedó registrada en la ficha con su motivo',
    !!notaReapertura && notaReapertura.content.includes('El cliente cambió el armazón'));

// Reabierta: ahora sí se puede editar, y la receta se destraba
const errEditaAbierta = await rechaza(() => OrderService.updateOrder(venta.id, { frameA: '55' }, admin.id, 'Jefa', 'ADMIN'));
check('venta REABIERTA: ya se puede editar el pedido', errEditaAbierta === null);
const errRxAbierta = await rechaza(() => ContactService.updatePrescription(receta.id, { sphereOD: -2 }, 'ADMIN'));
check('venta REABIERTA: la receta también se destraba', errRxAbierta === null);

// ── 4. Re-confirmación versionada ────────────────────────────────────────────
const errCierra = await rechaza(() => OrderService.updateOrder(venta.id, { isLocked: true }, admin.id, 'Jefa', 'ADMIN'));
check('re-confirmación: vuelve a trabarse', errCierra === null);

const ventaFinal = await prisma.order.findUnique({ where: { id: venta.id } });
const snap = ventaFinal.prescriptionSnapshot ? JSON.parse(ventaFinal.prescriptionSnapshot) : null;
check('re-confirmación: el snapshot subió de versión', !!snap && snap.v >= 2);
check('re-confirmación: la versión anterior quedó en el historial del snapshot',
    Array.isArray(snap.history) && snap.history.length >= 1);
check('el snapshot congela la receta completa (con foto)', !!snap.rx && snap.rx.imageUrl === '/x.jpg');

const notaReconf = await prisma.interaction.findFirst({
    where: { clientId: cliente.id, content: { startsWith: '✅' } },
});
check('la re-confirmación quedó registrada en la ficha', !!notaReconf);

await limpiar();
await prisma.$disconnect();
console.log(`\n✅ ${passed} checks OK — la venta enviada es inmutable y todo cambio deja rastro\n`);
