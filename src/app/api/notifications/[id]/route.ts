import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { ContactService } from '@/services/contact.service';
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
        const adminName = headersList.get('x-user-name') || 'Admin';

        const body = await request.json();
        const { action } = body; // "APPROVED", "REJECTED", or "MARK_DELIVERED"

        if (role !== 'ADMIN' && action !== 'MARK_DELIVERED') {
            return NextResponse.json({ error: 'Solo el administrador puede gestionar estas solicitudes' }, { status: 403 });
        }

        if (!['APPROVED', 'REJECTED', 'MARK_DELIVERED'].includes(action)) {
            return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
        }

        const notification = await prisma.notification.findUnique({ where: { id } });
        if (!notification) {
            return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
        }

        if (notification.status !== 'PENDING') {
            return NextResponse.json({ error: 'Esta solicitud ya fue procesada' }, { status: 409 });
        }

        let finalStatus = action;

        // If approving a DELETE_REQUEST, execute the deletion
        if (action === 'APPROVED' && notification.type === 'DELETE_REQUEST' && notification.orderId) {
            try {
                await ContactService.deleteOrder(notification.orderId, `Aprobado por ${adminName} — Solicitado por ${notification.requestedBy}`);
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
                await OrderService.updateOrder(notification.orderId, { labStatus: 'DELIVERED' });
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
