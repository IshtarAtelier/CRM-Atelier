import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ContactService } from '@/services/contact.service';
import { z } from 'zod';

const PaymentSchema = z.object({
    amount: z.number().positive(),
    method: z.string(),
    notes: z.string().nullable().optional(),
    receiptUrl: z.string().nullable().optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: orderId } = await params;
        const body = await request.json();
        const validation = PaymentSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ 
                error: 'Datos de pago inválidos', 
                details: validation.error.format() 
            }, { status: 400 });
        }

        const { amount, method, notes, receiptUrl } = validation.data;

        // Validation: Non-cash payments MUST include a receipt photo
        const isCash = method === 'EFECTIVO' || method === 'CASH';
        if (!isCash && !receiptUrl) {
            return NextResponse.json({
                error: 'Para métodos electrónicos (transferencia, tarjeta, etc.) es obligatorio cargar la foto del comprobante.'
            }, { status: 400 });
        }

        // Use the existing ContactService logic which handles transactions and stock (if applicable)
        const payment = await ContactService.addPayment(
            orderId,
            amount,
            method,
            notes ?? undefined,
            receiptUrl ?? undefined
        );

        return NextResponse.json(payment);
    } catch (error: any) {
        console.error('Error in payment API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
