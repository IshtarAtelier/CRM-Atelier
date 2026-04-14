import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params; // orderId would be better but keeping it consistent with context
        const body = await request.json();
        const { amount, method, notes, orderId, receiptUrl } = body;

        if (!orderId || !amount || !method) {
            return NextResponse.json({ error: 'Datos de pago incompletos' }, { status: 400 });
        }

        if (amount <= 0) {
            return NextResponse.json({ error: 'El monto del pago debe ser mayor a 0' }, { status: 400 });
        }

        const result = await ContactService.addPayment(orderId, amount, method, notes, receiptUrl);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: 'Error al registrar pago' }, { status: 500 });
    }
}
