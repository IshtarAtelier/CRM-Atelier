import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const orders = await ContactService.getOrdersWithBalance();
        return NextResponse.json(orders);
    } catch (error) {
        console.error('Error fetching orders with balance:', error);
        return NextResponse.json({ 
            error: 'Error al obtener pedidos con saldo',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
