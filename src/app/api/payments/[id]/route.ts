import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

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

        const deletedPayment = await ContactService.deletePayment(paymentId);
        return NextResponse.json(deletedPayment);
    } catch (error: any) {
        console.error('Error deleting payment:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
