import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { ADMIN_ALERT_EMAILS } from '@/lib/constants';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app').replace(/\/$/, '');

/**
 * Red de seguridad de costos: tras confirmar una VENTA, revisa si alguna línea con
 * precio > 0 quedó con costo resuelto en $0 (snapshot ?? producto vivo). Esa línea
 * entraría a los reportes como ganancia del 100% y el snapshot congela el cero.
 *
 * No bloquea nunca la venta (la ficha jamás frena una venta): detecta y avisa por
 * email al admin para corregir el costo mientras la factura del proveedor está fresca.
 * Fire-and-forget, nunca lanza. Complementa al guard de creación de productos
 * (product-cost-guard.ts) cubriendo lo que entre por scripts o SQL directo.
 */
export async function notifyZeroCostSale(orderId: string): Promise<void> {
    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                orderType: true,
                isDeleted: true,
                client: { select: { name: true } },
                items: {
                    select: {
                        price: true,
                        quantity: true,
                        eye: true,
                        productCostSnapshot: true,
                        productNameSnapshot: true,
                        product: { select: { name: true, cost: true } },
                    },
                },
            },
        });
        if (!order || order.orderType !== 'SALE' || order.isDeleted) return;

        const offenders = order.items.filter(it => {
            const cost = it.productCostSnapshot ?? it.product?.cost ?? 0;
            return it.price > 0 && !(cost > 0);
        });
        if (offenders.length === 0) return;

        const clientName = order.client?.name || 'Cliente desconocido';
        const money = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
        const rows = offenders.map(it => `
            <li style="margin-bottom: 4px;">
                <strong>${it.productNameSnapshot || it.product?.name || '(sin nombre)'}</strong>${it.eye ? ` (ojo ${it.eye})` : ''}
                — vendido a ${money(it.price * it.quantity)}, costo $0
            </li>
        `).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
                <h2 style="color: #dc2626;">⚠️ Venta con costo $0</h2>
                <p>La venta de <strong>${clientName}</strong> tiene ${offenders.length === 1 ? 'una línea' : `${offenders.length} líneas`} sin costo cargado.
                Los reportes van a contar esa plata como ganancia pura hasta que se corrija.</p>
                <ul style="line-height: 1.6;">${rows}</ul>
                <p>Cargale el costo real al producto en el catálogo (y corregí esta venta si hace falta).</p>
                <p style="margin-top: 16px;">
                    <a href="${APP_URL}/admin/ventas?orderId=${order.id}" style="display: inline-block; padding: 12px 24px; background-color: #d97706; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">Ver pedido en CRM</a>
                </p>
            </div>
        `;
        const text = `Venta de ${clientName} con ${offenders.length} línea(s) a costo $0: ` +
            offenders.map(it => `${it.productNameSnapshot || it.product?.name || '(sin nombre)'} (${money(it.price * it.quantity)})`).join(', ') +
            `. ${APP_URL}/admin/ventas?orderId=${order.id}`;

        await sendEmail({
            to: ADMIN_ALERT_EMAILS,
            subject: `⚠️ Venta con costo $0: ${clientName}`,
            html,
            text,
        });
        console.log(`[zero-cost] alerta enviada: pedido ${order.id} (${clientName}) con ${offenders.length} línea(s) a costo $0`);
    } catch (err) {
        console.error('[zero-cost] no se pudo procesar la alerta de venta sin costo:', err);
    }
}
