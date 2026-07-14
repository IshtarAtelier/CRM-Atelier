import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const year = searchParams.get('year');

        const targets = await prisma.monthlyTarget.findMany({
            where: year ? { year: parseInt(year, 10) } : undefined,
            orderBy: [{ year: 'desc' }, { month: 'desc' }]
        });

        return NextResponse.json(targets);
    } catch (error) {
        console.error('Error fetching monthly targets:', error);
        return NextResponse.json({ error: 'Error fetching targets' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { target1, target2, target3, month, year, currency } = body;

        const currentMonth = month || new Date().getMonth() + 1;
        const currentYear = year || new Date().getFullYear();
        // "USD" = los valores se convierten a ARS con el blue del día; "ARS" = fijos.
        const targetCurrency = currency === 'USD' ? 'USD' : 'ARS';

        const updatedTarget = await prisma.monthlyTarget.upsert({
            where: {
                month_year: {
                    month: currentMonth,
                    year: currentYear
                }
            },
            update: {
                target1: parseFloat(target1),
                target2: parseFloat(target2),
                target3: target3 ? parseFloat(target3) : null,
                currency: targetCurrency
            },
            create: {
                month: currentMonth,
                year: currentYear,
                target1: parseFloat(target1),
                target2: parseFloat(target2),
                target3: target3 ? parseFloat(target3) : null,
                currency: targetCurrency
            }
        });

        return NextResponse.json(updatedTarget);
    } catch (error) {
        console.error('Error updating monthly targets:', error);
        return NextResponse.json({ error: 'Error updating targets' }, { status: 500 });
    }
}
