import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { doctorName, amount, method, notes, receiptUrl } = body;

        if (!doctorName || !amount || !method) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        if (!['CASH', 'TRANSFER'].includes(method)) {
            return NextResponse.json({ error: 'Método debe ser CASH o TRANSFER' }, { status: 400 });
        }

        // Es plata real que sale: queda registrado qué usuario lo cargó
        const actor = getActor(request);
        const payment = await prisma.doctorPayment.create({
            data: {
                doctorName,
                amount: Number(amount),
                method,
                notes: notes || null,
                receiptUrl: receiptUrl || null,
                createdById: actor.id,
                createdByName: actor.name,
            }
        });

        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'CREATE',
            entityType: 'DOCTOR_PAYMENT',
            entityId: payment.id,
            details: { doctorName, amount: Number(amount), method, notes: notes || null }
        });

        return NextResponse.json(payment);
    } catch (error: any) {
        console.error('Error creating doctor payment:', error);
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        // Borrar un pago de comisión altera saldos retroactivamente: solo ADMIN
        const actor = getActor(request);
        if (actor.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Solo el administrador puede eliminar pagos a médicos.' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

        // Snapshot antes del hard-delete: sin esto el pago desaparece sin rastro
        const payment = await prisma.doctorPayment.findUnique({ where: { id } });
        if (!payment) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });

        await prisma.doctorPayment.delete({ where: { id } });

        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'DELETE',
            entityType: 'DOCTOR_PAYMENT',
            entityId: id,
            details: {
                doctorName: payment.doctorName,
                amount: payment.amount,
                method: payment.method,
                date: payment.date,
                createdByName: payment.createdByName
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting doctor payment:', error);
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
