import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/fixed-costs — List fixed costs (optionally filtered by month/year)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month');
        const year = searchParams.get('year');

        const where: any = {};
        if (month) where.month = parseInt(month);
        if (year) where.year = parseInt(year);

        const costs = await prisma.fixedCost.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(costs);
    } catch (error: any) {
        console.error('Error fetching fixed costs:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/fixed-costs — Create a new fixed cost
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, amount, category, month, year, notes } = body;

        if (!name || !amount || !month || !year) {
            return NextResponse.json({ error: 'Nombre, monto, mes y año son requeridos' }, { status: 400 });
        }

        const cost = await prisma.fixedCost.create({
            data: {
                name,
                amount: Number(amount),
                category: category || 'OTRO',
                month: Number(month),
                year: Number(year),
                notes: notes || null,
            },
        });

        return NextResponse.json(cost);
    } catch (error: any) {
        console.error('Error creating fixed cost:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
