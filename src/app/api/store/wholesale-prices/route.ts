import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { serverCache } from '@/lib/cache';
import { canSeeWholesalePrices } from '@/lib/wholesale-access';

export const dynamic = 'force-dynamic';

// GET /api/store/wholesale-prices — mapa liviano { productId: wholesalePrice }
// para re-preciar el carrito mayorista en vivo. Mismo criterio que el backend
// al cobrar (effectiveFramePrice): TODO producto con wholesalePrice > 0,
// publicado o no en la vitrina mayorista. Solo ids y precios (nada de
// imágenes): unos pocos KB contra los MB del catálogo completo.
//
// SOLO con sesión: sin este control era la lista de precios netos completa a un
// curl de distancia, sin cuenta ni link. El hook que lo consume
// (useWholesaleCartBackfill) ya solo lo llama con sesión de óptica.
export async function GET() {
    const token = (await cookies()).get('session')?.value;
    if (!(await canSeeWholesalePrices(token))) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const cacheKey = 'wholesale-prices-map';
        let map = serverCache.get<Record<string, number>>(cacheKey);
        if (map === null) {
            const products = await prisma.product.findMany({
                where: { wholesalePrice: { gt: 0 } },
                select: { id: true, wholesalePrice: true },
            });
            map = {};
            for (const p of products) map[p.id] = p.wholesalePrice;
            serverCache.set(cacheKey, map, 60);
        }
        return NextResponse.json({ prices: map });
    } catch (e) {
        console.error('wholesale-prices error:', e);
        return NextResponse.json({ prices: {} }, { status: 500 });
    }
}
