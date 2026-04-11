import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { ContactService } from '@/services/contact.service';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: paymentId } = await params;
        
        if (!paymentId) {
            return NextResponse.json({ error: 'ID de pago requerido' }, { status: 400 });
        }

        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';

        // Security check: Find payment and its associated order
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: {
                order: {
                    select: { labStatus: true, clientId: true }
                }
            }
        });

        if (!payment) {
            return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
        }

        if (role !== 'ADMIN') {
            const status = payment.order?.labStatus;
            if (status && status !== 'NONE') {
                return NextResponse.json(
                    { error: 'Seguridad: No podés eliminar pagos de un pedido que ya fue enviado a fábrica.' },
                    { status: 403 }
                );
            }
        }

        const deletedPayment = await ContactService.deletePayment(paymentId);

        // Registrar en la ficha del cliente (Línea de Tiempo)
        if (payment.order?.clientId) {
            const formattedAmount = payment.amount.toLocaleString('es-AR');
            const interactionText = `El Administrador eliminó un registro de pago por $${formattedAmount} (${payment.method}). Motivo: Eliminación manual / Corrección de caja.`;
            await ContactService.addInteraction(payment.order.clientId, 'SISTEMA', interactionText);
        }

        return NextResponse.json(deletedPayment);
    } catch (error: any) {
        console.error('Error deleting payment:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
