import { NextResponse } from 'next/server';
import { CashService } from '@/services/cash.service';
import { headers } from 'next/headers';

export async function POST(request: Request) {
    try {
        const headersList = await headers();
        const userId = headersList.get('x-user-id');
        
        if (!userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { type, amount, reason } = body;

        if (!type || !amount || !reason) {
            return NextResponse.json({ error: 'Faltan campos obligatorios (type, amount, reason)' }, { status: 400 });
        }

        const movement = await CashService.registerMovement({
            type,
            amount: parseFloat(amount),
            reason,
            userId,
        });

        return NextResponse.json(movement);
    } catch (error: any) {
        console.error('Error registrando movimiento de caja:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
