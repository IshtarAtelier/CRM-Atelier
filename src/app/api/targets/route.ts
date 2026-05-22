import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { target1, target2, target3, month, year } = body;

        const currentMonth = month || new Date().getMonth() + 1;
        const currentYear = year || new Date().getFullYear();

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
                target3: target3 ? parseFloat(target3) : null
            },
            create: {
                month: currentMonth,
                year: currentYear,
                target1: parseFloat(target1),
                target2: parseFloat(target2),
                target3: target3 ? parseFloat(target3) : null
            }
        });

        return NextResponse.json(updatedTarget);
    } catch (error) {
        console.error('Error updating monthly targets:', error);
        return NextResponse.json({ error: 'Error updating targets' }, { status: 500 });
    }
}
