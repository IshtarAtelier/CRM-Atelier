import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const channel = request.nextUrl.searchParams.get('channel');
        const isWholesale = channel === 'wholesale';

        const products = await prisma.product.findMany({
            where: {
                ...(isWholesale
                    ? { publishToWholesale: true }
                    : { publishToWeb: true }),
                category: { not: 'Cristal' }
            },
            select: {
                id: true,
                name: true,
                brand: true,
                model: true,
                category: true,
                price: true,
                ...(isWholesale ? { wholesalePrice: true } : {}),
                stock: true,
                imagenesCatalogo: true,
                lensWidth: true,
                bridgeWidth: true,
                templeLength: true,
                frameHeight: true,
                webProducts: {
                    where: { isActive: true },
                    select: { slug: true },
                    take: 1
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 40
        });

        const mappedProducts = products.map(p => ({
            id: p.id,
            name: p.name,
            brand: 'ATELIER',
            model: p.model,
            category: p.category,
            price: p.price,
            ...((isWholesale && 'wholesalePrice' in p) ? { wholesalePrice: (p as any).wholesalePrice } : {}),
            stock: p.stock,
            imagenesCatalogo: p.imagenesCatalogo,
            lensWidth: p.lensWidth,
            bridgeWidth: p.bridgeWidth,
            templeLength: p.templeLength,
            frameHeight: p.frameHeight,
            slug: p.webProducts && p.webProducts.length > 0 ? p.webProducts[0].slug : p.id
        }));

        return NextResponse.json(mappedProducts);
    } catch (error) {
        console.error('Error fetching store products:', error);
        return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
    }
}
