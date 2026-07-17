import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { OrderService } from '@/services/order.service';

// PATCH /api/notifications/[id] — Approve, reject, or mark delivered
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';
        const adminId = headersList.get('x-user-id');
        const adminName = headersList.get('x-user-name') || 'Admin';

        const body = await request.json();
        const { action } = body; // "APPROVED", "REJECTED", "MARK_DELIVERED", or "REQUEST_DELETE_RECEIPT"

        const notification = await prisma.notification.findUnique({ where: { id } });
        if (!notification) {
            return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
        }

        if (notification.status !== 'PENDING') {
            return NextResponse.json({ error: 'Esta solicitud ya fue procesada' }, { status: 409 });
        }

        if (role !== 'ADMIN') {
            const isLabReadyMark = action === 'MARK_DELIVERED' && notification.type === 'LAB_READY';
            const isReceiptErrorDismiss = action === 'APPROVED' && notification.type === 'RECEIPT_ERROR';
            const isReceiptErrorDeleteRequest = action === 'REQUEST_DELETE_RECEIPT' && notification.type === 'RECEIPT_ERROR';
            
            if (!isLabReadyMark && !isReceiptErrorDismiss && !isReceiptErrorDeleteRequest) {
                return NextResponse.json({ error: 'Solo el administrador puede gestionar estas solicitudes' }, { status: 403 });
            }
        }

        if (!['APPROVED', 'REJECTED', 'MARK_DELIVERED', 'REQUEST_DELETE_RECEIPT'].includes(action)) {
            return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
        }

        // If the seller requests deletion of the receipt
        if (action === 'REQUEST_DELETE_RECEIPT') {
            const updated = await prisma.notification.update({
                where: { id },
                data: {
                    type: 'DELETE_REQUEST',
                    message: `⚠️ [SOLICITUD ELIMINACIÓN COMPROBANTE] Vendedor solicita eliminar comprobante. Detalle: ${notification.message}`,
                    requestedBy: role === 'STAFF' ? (headersList.get('x-user-name') || 'Vendedor') : notification.requestedBy,
                }
            });
            return NextResponse.json(updated);
        }

        let finalStatus = action;

        // If approving a DELETE_REQUEST, execute the deletion
        if (action === 'APPROVED' && notification.type === 'DELETE_REQUEST' && notification.orderId) {
            try {
                // OrderService.deleteOrder (no ContactService.deleteOrder): es la única
                // vía que deja snapshot de pagos + logAudit + entrada en la ficha del
                // cliente. Role ya es ADMIN acá (gate de la línea 30-38 lo garantiza).
                await OrderService.deleteOrder(notification.orderId, `Aprobado por ${adminName} — Solicitado por ${notification.requestedBy}`, role, adminId, adminName);
            } catch (err: any) {
                return NextResponse.json({ error: `Error al eliminar la orden: ${err.message}` }, { status: 500 });
            }
        }

        // If marking DELIVERED
        if (action === 'MARK_DELIVERED') {
            if (notification.type !== 'LAB_READY' || !notification.orderId) {
                return NextResponse.json({ error: 'Notificación inválida para marcar como entregado' }, { status: 400 });
            }
            try {
                await OrderService.updateOrder(notification.orderId, { labStatus: 'DELIVERED' }, adminId, adminName, role);
                finalStatus = 'RESOLVED';
            } catch (err: any) {
                return NextResponse.json({ error: `Error al actualizar la orden: ${err.message}` }, { status: 500 });
            }
        }

        // Update notification status
        const updated = await prisma.notification.update({
            where: { id },
            data: {
                status: finalStatus,
                resolvedBy: adminName,
            },
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Error updating notification:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
