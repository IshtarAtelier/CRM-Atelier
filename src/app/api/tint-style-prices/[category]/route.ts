import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const VALID_CATEGORIES = ['COMPACTO', 'MUESTRA', 'DEGRADE'];

// PUT — Upsert the price for a tinting style
export async function PUT(req: Request, { params }: { params: Promise<{ category: string }> }) {
    try {
        const { category } = await params;
        if (!VALID_CATEGORIES.includes(category)) {
            return NextResponse.json({ error: 'Estilo de teñido inválido' }, { status: 400 });
        }

        const body = await req.json();
        const price = Number(body.price);
        if (!Number.isFinite(price) || price < 0) {
            return NextResponse.json({ error: 'Precio inválido' }, { status: 400 });
        }

        const updated = await prisma.tintStylePrice.upsert({
            where: { category },
            update: { price },
            create: { category, price },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating tint style price:', error);
        return NextResponse.json({ error: 'Error al actualizar precio de teñido' }, { status: 500 });
    }
}
