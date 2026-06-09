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
            },
            orderBy: { createdAt: 'desc' },
            take: 40
        });

        return NextResponse.json(products);
    } catch (error) {
        console.error('Error fetching store products:', error);
        return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
    }
}
