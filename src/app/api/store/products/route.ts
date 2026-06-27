import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const revalidate = 300;

export async function GET() {
    try {
        const products = await prisma.product.findMany({
            where: {
                publishToWeb: true,
                category: { not: 'Cristal' } // Crystals are handled by the configurator, not the catalog
            },
            select: {
                id: true,
                name: true,
                brand: true,
                model: true,
                category: true,
                price: true,
                stock: true,
                imagenesCatalogo: true,
                lensWidth: true,
                bridgeWidth: true,
                templeLength: true,
                frameHeight: true,
                webProducts: {
                    where: { isActive: true },
                    select: {
                        slug: true
                    },
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
