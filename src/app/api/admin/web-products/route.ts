import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const webProducts = await prisma.webProduct.findMany({
            include: {
                product: {
                    select: {
                        brand: true,
                        model: true,
                        price: true,
                        stock: true,
                        imagenesCatalogo: true,
                        publishToWeb: true,
                    }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        return NextResponse.json(webProducts);
    } catch (error: any) {
        console.error('Error fetching admin web products:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, category, isFeatured, isActive, description, slug } = body;

        if (!id) {
            return NextResponse.json({ error: 'Falta el ID del WebProduct' }, { status: 400 });
        }

        // Validate slug unique if it is being changed
        if (slug) {
            const existing = await prisma.webProduct.findFirst({
                where: {
                    slug,
                    id: { not: id }
                }
            });
            if (existing) {
                return NextResponse.json({ error: 'El slug ya está en uso por otro producto' }, { status: 400 });
            }
        }

        const updated = await prisma.webProduct.update({
            where: { id },
            data: {
                ...(category !== undefined ? { category } : {}),
                ...(isFeatured !== undefined ? { isFeatured } : {}),
                ...(isActive !== undefined ? { isActive } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(slug !== undefined ? { slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') } : {}),
            }
        });

        return NextResponse.json({ success: true, webProduct: updated });
    } catch (error: any) {
        console.error('Error updating web product:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
