import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET — List price per tinting style (COMPACTO/MUESTRA/DEGRADE)
export async function GET() {
    try {
        const prices = await prisma.tintStylePrice.findMany({
            orderBy: { category: 'asc' },
        });
        return NextResponse.json(prices);
    } catch (error) {
        console.error('Error fetching tint style prices:', error);
        return NextResponse.json({ error: 'Error al obtener precios de teñido' }, { status: 500 });
    }
}
