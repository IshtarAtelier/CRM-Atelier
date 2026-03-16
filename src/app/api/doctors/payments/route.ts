import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

        const payment = await prisma.doctorPayment.create({
            data: {
                doctorName,
                amount: Number(amount),
                method,
                notes: notes || null,
                receiptUrl: receiptUrl || null,
            }
        });

        return NextResponse.json(payment);
    } catch (error: any) {
        console.error('Error creating doctor payment:', error);
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

        await prisma.doctorPayment.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting doctor payment:', error);
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
