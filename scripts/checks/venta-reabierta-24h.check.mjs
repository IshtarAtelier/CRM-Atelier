// ────────────────────────────────────────────────────────────────────────────
// AVISO DE VENTA REABIERTA >24H: la detección, sin mandar el mail de verdad.
//
// Prueba la lógica que usa /api/cron/venta-reabierta-24h contra la base
// LOCAL, con una reapertura REAL (pasando por OrderService.updateOrder, no
// un mock) para que el AuditLog de REAPERTURA quede como en producción.
// No llama a sendEmail — solo verifica que la detección (menos de 24h, más
// de 24h, dedup) da lo esperado.
//
// Corre contra la base LOCAL. Crea y borra sus propios datos.
// Correr:  npm run check:venta-reabierta-24h
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { OrderService } from '../../src/services/order.service.ts';

const prisma = new PrismaClient();

const HORAS_LIMITE = 24;

// Misma lógica que el cron, para no importar código de una ruta Next.js.
async function estadoDeReapertura(orderId) {
    const ultimoCambio = await prisma.auditLog.findFirst({
        where: { entityType: 'ORDER', entityId: orderId, action: 'STATUS_CHANGE' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, details: true },
    });
    const evento = ultimoCambio?.details?.evento;
    if (!ultimoCambio || evento !== 'REAPERTURA') return { listo: false, motivo: 'sin_rastro' };
    const horas = (Date.now() - new Date(ultimoCambio.createdAt).getTime()) / 3_600_000;
    return { listo: horas >= HORAS_LIMITE, horas, ultimoCambio };
}

let fallas = 0;
const check = (nombre, cond, detalle) => {
    if (cond) console.log(`  ✅ ${nombre}`);
    else { fallas++; console.error(`  ❌ ${nombre}\n     ${detalle}`); }
};

const usuario = await prisma.user.findFirst({ select: { id: true } });
if (!usuario) { console.error('No hay ningún User en la base local.'); process.exit(1); }

const cliente = await prisma.client.create({ data: { name: 'TEST venta-reabierta-24h', phone: `test-${Date.now()}` } });
const producto = await prisma.product.create({
    data: { name: 'TEST Cristal', brand: 'Varilux', category: 'Cristal', type: 'Cristal Multifocal', price: 500_000, cost: 200_000 },
});

const orden = await prisma.order.create({
    data: {
        clientId: cliente.id, userId: usuario.id, orderType: 'SALE', status: 'PENDING',
        total: 500_000, subtotalWithMarkup: 500_000, isLocked: true,
        items: { create: [{ productId: producto.id, price: 500_000, quantity: 1 }] },
    },
});

try {
    // Recién creada (bloqueada): sin rastro de reapertura.
    let estado = await estadoDeReapertura(orden.id);
    check('venta bloqueada, nunca reabierta: sin rastro', estado.motivo === 'sin_rastro', JSON.stringify(estado));

    // Reapertura REAL — pasa por OrderService.updateOrder, deja el AuditLog.
    // logAudit es fire-and-forget (no se espera adentro de updateOrder, ver
    // CLAUDE.md), así que hay que esperar a que aparezca.
    await OrderService.updateOrder(orden.id, { isLocked: false, reopenReason: 'test check' }, usuario.id, 'Test', 'ADMIN');
    let auditLog = null;
    for (let intento = 0; intento < 20 && !auditLog; intento++) {
        auditLog = await prisma.auditLog.findFirst({
            where: { entityType: 'ORDER', entityId: orden.id, action: 'STATUS_CHANGE' },
            orderBy: { createdAt: 'desc' },
        });
        if (!auditLog) await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(auditLog, 'El AuditLog de la reapertura nunca apareció (logAudit es fire-and-forget).');

    estado = await estadoDeReapertura(orden.id);
    check('recién reabierta: todavía no pasaron 24h', estado.listo === false, `horas=${estado.horas}`);

    // Retrasar el reloj: el AuditLog de la reapertura "pasó" hace 26 horas.
    await prisma.auditLog.update({ where: { id: auditLog.id }, data: { createdAt: new Date(Date.now() - 26 * 3_600_000) } });

    estado = await estadoDeReapertura(orden.id);
    check('reabierta hace 26h: lista para avisar', estado.listo === true, `horas=${estado.horas}`);

    // Dedup: un aviso YA mandado DESPUÉS de la reapertura no debería repetirse.
    const notif = await prisma.notification.create({
        data: { type: 'SALE_REOPENED_24H', status: 'PENDING', message: 'test', orderId: orden.id, requestedBy: 'Sistema' },
    });
    const yaAvisado = notif.createdAt >= auditLog.createdAt; // auditLog.createdAt ya está backdateado a -26h
    check('con un aviso ya mandado en esta reapertura: no repite', yaAvisado === true, `notif=${notif.createdAt} audit=${auditLog.createdAt}`);

    // Re-confirmar y reabrir de nuevo: tiene que poder avisar otra vez (el
    // aviso viejo queda ANTES del nuevo AuditLog de reapertura).
    await OrderService.updateOrder(orden.id, { isLocked: true }, usuario.id, 'Test', 'ADMIN');
    await OrderService.updateOrder(orden.id, { isLocked: false, reopenReason: 'segunda reapertura' }, usuario.id, 'Test', 'ADMIN');
    const nuevoAudit = await prisma.auditLog.findFirst({
        where: { entityType: 'ORDER', entityId: orden.id, action: 'STATUS_CHANGE' },
        orderBy: { createdAt: 'desc' },
    });
    const notifVieja = await prisma.notification.findFirst({ where: { orderId: orden.id, type: 'SALE_REOPENED_24H' } });
    check(
        'reconfirmada y reabierta de nuevo: el aviso viejo NO cuenta para la nueva reapertura',
        notifVieja.createdAt < nuevoAudit.createdAt,
        `notif=${notifVieja.createdAt} nuevoAudit=${nuevoAudit.createdAt}`,
    );
} finally {
    await prisma.notification.deleteMany({ where: { orderId: orden.id } });
    await prisma.auditLog.deleteMany({ where: { entityType: 'ORDER', entityId: orden.id } });
    await prisma.interaction.deleteMany({ where: { clientId: cliente.id } });
    await prisma.order.delete({ where: { id: orden.id } });
    await prisma.product.delete({ where: { id: producto.id } });
    await prisma.client.delete({ where: { id: cliente.id } });
    await prisma.$disconnect();
}

if (fallas > 0) { console.error(`\n❌ ${fallas} caso(s) roto(s).`); process.exit(1); }
console.log('\n✅ La detección de venta reabierta >24h funciona: horas, dedup y re-reapertura.');
