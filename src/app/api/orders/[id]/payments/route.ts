import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';
import { getActor } from '@/lib/actor';
import { z } from 'zod';

const PaymentSchema = z.object({
    amount: z.number().positive(),
    method: z.string(),
    notes: z.string().nullable().optional(),
    receiptUrl: z.string().nullable().optional(),
    date: z.string().nullable().optional(),
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

        const { amount, method, notes, receiptUrl, date } = validation.data;

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
            receiptUrl ?? undefined,
            date ?? undefined,
            getActor(request)
        );

        return NextResponse.json(payment);
    } catch (error: any) {
        console.error('Error in payment API:', error);
        
        // Traducir errores técnicos de Prisma a mensajes claros en castellano
        let userMessage = error.message || 'Error desconocido al registrar el pago';
        
        if (error.code === 'P2003' || error.message?.includes('Foreign key constraint')) {
            userMessage = 'Error interno del sistema al crear una notificación. Por favor, contactá al administrador para que revise la configuración.';
        } else if (error.code === 'P2002') {
            userMessage = 'Ya existe un registro con estos datos. Verificá que no estés duplicando el pago.';
        } else if (error.code === 'P2025') {
            userMessage = 'No se encontró el registro solicitado. Es posible que haya sido eliminado.';
        }
        
        return NextResponse.json({ error: userMessage }, { status: 500 });
    }
}
