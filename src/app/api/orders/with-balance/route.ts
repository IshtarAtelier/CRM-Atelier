import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';
import { serverCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const cacheKey = 'orders-with-balance';
        const cached = serverCache.get<any>(cacheKey);
        if (cached !== null) {
            return NextResponse.json(cached);
        }

        const orders = await ContactService.getOrdersWithBalance();
        serverCache.set(cacheKey, orders, 60); // Cache for 60 seconds
        return NextResponse.json(orders);
    } catch (error) {
        console.error('Error fetching orders with balance:', error);
        return NextResponse.json({ 
            error: 'Error al obtener pedidos con saldo',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
