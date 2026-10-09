/**
 * Datos de PRUEBA para la carga asistida de Grupo Óptico, SOLO en una base local
 * (la de desarrollo o la copia local de producción, atelier_prodcopia):
 *   · un usuario ADMIN de pruebas (para entrar al CRM local),
 *   · un cliente "Prueba Grupo Óptico",
 *   · una COPIA de una venta real de Grupo Óptico (por defecto la 2x1 de Smart
 *     Free con el 2º par de sol, #L4AU), enviada a fábrica y SIN nº de pedido,
 *     lista para probar el bloque "Grupo Óptico" de la ficha.
 *
 * Fuera de producción el robot nunca crea pedidos reales (robot.ts →
 * puedeCrearPedidosReales): con esta venta se prueba preparar (que solo lee
 * el portal), revisar, aprobar y ver cómo el candado frena la carga.
 *
 *   DATABASE_URL=…/atelier_prodcopia node scripts/maintenance/grupo-optico-datos-de-prueba.mjs [idVentaOrigen]
 *   DATABASE_URL=…/atelier_prodcopia node scripts/maintenance/grupo-optico-datos-de-prueba.mjs --borrar
 *
 * Usuario de pruebas del CRM local: pruebas.go@atelier.local
 * Contraseña: la constante CLAVE de abajo (solo existe en la base local).
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';

config();
const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no apunta a localhost: estos datos son solo de prueba.');
    process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });

const EMAIL = 'pruebas.go@atelier.local';
const CLAVE = 'grupo-optico-local-2026';
const CLIENTE = 'Prueba Grupo Óptico';
const ORIGEN = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'cmu6zfb0e00g6oe07n4rbl4au';

try {
    const client = await prisma.client.findFirst({ where: { name: CLIENTE } });
    if (process.argv.includes('--borrar')) {
        if (client) {
            const ventas = await prisma.order.findMany({ where: { clientId: client.id }, select: { id: true } });
            const ids = ventas.map(v => v.id);
            await prisma.labOrderDraft.deleteMany({ where: { orderId: { in: ids } } });
            await prisma.labPortalOrder.updateMany({ where: { orderId: { in: ids } }, data: { orderId: null } });
            await prisma.notification.deleteMany({ where: { orderId: { in: ids } } });
            await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
            await prisma.orderFrame.deleteMany({ where: { orderId: { in: ids } } });
            await prisma.order.deleteMany({ where: { id: { in: ids } } });
            await prisma.interaction.deleteMany({ where: { clientId: client.id } });
            await prisma.client.delete({ where: { id: client.id } });
        }
        // Lo que el usuario de pruebas escribió por la mensajería interna (un extra
        // no cobrado le manda un mensaje a la dueña): sin esto, la FK no deja borrarlo.
        const u = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
        if (u) {
            const hilos = await prisma.internalThread.findMany({ where: { createdById: u.id }, select: { id: true } });
            await prisma.internalMessage.deleteMany({ where: { OR: [{ senderId: u.id }, { threadId: { in: hilos.map(h => h.id) } }] } });
            await prisma.internalThreadParticipant.deleteMany({ where: { OR: [{ userId: u.id }, { threadId: { in: hilos.map(h => h.id) } }] } });
            await prisma.internalThread.deleteMany({ where: { id: { in: hilos.map(h => h.id) } } });
            await prisma.auditLog.deleteMany({ where: { userId: u.id } }).catch(() => null);
        }
        await prisma.user.deleteMany({ where: { email: EMAIL } });
        console.log('✅ Datos de prueba de Grupo Óptico borrados.');
        process.exit(0);
    }

    const hash = await bcrypt.hash(CLAVE, 10);
    await prisma.user.upsert({
        where: { email: EMAIL },
        update: { password: hash, role: 'ADMIN' },
        create: { email: EMAIL, name: 'Pruebas Grupo Óptico', password: hash, role: 'ADMIN' },
    });
    const cliente = client ?? await prisma.client.create({ data: { name: CLIENTE, phone: '0000000000' } });

    const origen = await prisma.order.findUnique({ where: { id: ORIGEN }, include: { items: true, frames: true } });
    if (!origen) throw new Error(`No existe la venta ${ORIGEN} en esta base.`);
    const { id, items, frames, clientId, ...resto } = origen;
    const venta = await prisma.order.create({
        data: {
            ...resto,
            clientId: cliente.id,
            labStatus: 'SENT',
            labOrderNumber: null,
            smartLabSector: null, smartLabProgress: null, smartLabLastSync: null, smartLabDetails: null,
            createdAt: new Date(), updatedAt: new Date(),
        },
    });
    for (const it of items) {
        const { id: _i, orderId: _o, ...r } = it;
        await prisma.orderItem.create({ data: { ...r, orderId: venta.id } });
    }
    for (const f of frames) {
        const { id: _i, orderId: _o, ...r } = f;
        await prisma.orderFrame.create({ data: { ...r, orderId: venta.id } });
    }
    console.log(`✅ Venta de prueba #${venta.id.slice(-4).toUpperCase()} (${venta.id}) copiada de #${ORIGEN.slice(-4).toUpperCase()}, enviada a fábrica y sin nº.`);
    console.log(`   Entrar al CRM local con ${EMAIL} y abrir /admin/ventas?id=${venta.id}`);
} catch (e) {
    console.error('❌', e?.message || e);
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
