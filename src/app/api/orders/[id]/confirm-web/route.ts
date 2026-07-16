import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { ContactService } from '@/services/contact.service';

export const dynamic = 'force-dynamic';

// POST /api/orders/[id]/confirm-web
// Confirma una venta web (revisión humana) y la pasa al flujo normal de venta:
// - WEB_PENDING (transferencia): registra el pago acreditado y confirma.
// - WEB_PAID (tarjeta vía Payway): el pago ya está registrado, solo confirma.
// En ambos casos resuelve la notificación WEB_SALE pendiente.
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: orderId } = await params;
        const headersList = await headers();
        const userName = headersList.get('x-user-name') || 'CRM';
        const actor = {
            id: headersList.get('x-user-id'),
            name: userName,
            role: headersList.get('x-user-role')
        };

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, status: true, total: true, paid: true }
        });
        if (!order) {
            return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
        }
        if (order.status !== 'WEB_PENDING' && order.status !== 'WEB_PAID') {
            return NextResponse.json({ error: 'La orden no está pendiente de confirmación web.' }, { status: 400 });
        }

        // 1. Reclamo atómico: solo un request puede pasar la orden de WEB_* a PENDING.
        //    Evita doble registro de pago si dos usuarios confirman a la vez.
        const claimed = await prisma.order.updateMany({
            where: { id: orderId, status: order.status },
            data: { status: 'PENDING' }
        });
        if (claimed.count === 0) {
            return NextResponse.json({ error: 'La orden ya fue confirmada por otro usuario.' }, { status: 409 });
        }

        // 2. Si es transferencia (WEB_PENDING), registrar el pago por el saldo pendiente.
        //    Si es tarjeta (WEB_PAID), el pago ya fue registrado por Payway al aprobarse.
        if (order.status === 'WEB_PENDING') {
            const remaining = (order.total || 0) - (order.paid || 0);
            if (remaining > 0) {
                try {
                    await ContactService.addPayment(
                        orderId,
                        remaining,
                        'TRANSFERENCIA_ISHTAR',
                        `Venta Web #${orderId.slice(-4).toUpperCase()} — transferencia acreditada, confirmada por ${userName}`,
                        undefined,
                        undefined,
                        actor
                    );
                } catch (payErr: any) {
                    // Si falla el registro del pago, revertir el reclamo para que la venta
                    // vuelva a quedar "A Confirmar" y se pueda reintentar.
                    await prisma.order.updateMany({
                        where: { id: orderId, status: 'PENDING' },
                        data: { status: 'WEB_PENDING' }
                    });
                    throw payErr;
                }
            }
        }

        const updated = await prisma.order.findUnique({ where: { id: orderId } });

        // 3. Resolver la notificación de venta web pendiente
        await prisma.notification.updateMany({
            where: { orderId, type: 'WEB_SALE', status: 'PENDING' },
            data: { status: 'APPROVED', resolvedBy: userName }
        });

        return NextResponse.json({ success: true, order: updated });
    } catch (error: any) {
        console.error('[CONFIRM WEB SALE] Error:', error);
        return NextResponse.json({ error: error.message || 'Error confirmando la venta web' }, { status: 500 });
    }
}
