import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { ContactService } from '@/services/contact.service';

// PATCH /api/notifications/[id] — Approve or reject a notification (ADMIN only)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';
        const adminName = headersList.get('x-user-name') || 'Admin';

        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Solo el administrador puede gestionar solicitudes' }, { status: 403 });
        }

        const body = await request.json();
        const { action } = body; // "APPROVED" or "REJECTED"

        if (!['APPROVED', 'REJECTED'].includes(action)) {
            return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
        }

        const notification = await prisma.notification.findUnique({ where: { id } });
        if (!notification) {
            return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
        }

        if (notification.status !== 'PENDING') {
            return NextResponse.json({ error: 'Esta solicitud ya fue procesada' }, { status: 409 });
        }

        // If approving a DELETE_REQUEST, execute the deletion
        if (action === 'APPROVED' && notification.type === 'DELETE_REQUEST' && notification.orderId) {
            try {
                await ContactService.deleteOrder(notification.orderId, `Aprobado por ${adminName} — Solicitado por ${notification.requestedBy}`);
            } catch (err: any) {
                return NextResponse.json({ error: `Error al eliminar la orden: ${err.message}` }, { status: 500 });
            }
        }

        // Update notification status
        const updated = await prisma.notification.update({
            where: { id },
            data: {
                status: action,
                resolvedBy: adminName,
            },
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Error updating notification:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
