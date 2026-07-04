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
        // 120s > los 60s de polling: así la caché absorbe el request siguiente en vez
        // de expirar justo cuando llega. Esta query es la más cara del panel (dump de
        // clientes con venta + includes anidados), conviene correrla lo menos posible.
        serverCache.set(cacheKey, orders, 120);
        return NextResponse.json(orders);
    } catch (error) {
        console.error('Error fetching orders with balance:', error);
        return NextResponse.json({ 
            error: 'Error al obtener pedidos con saldo',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
