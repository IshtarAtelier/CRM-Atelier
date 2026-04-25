import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month');
        const year = searchParams.get('year');

        if (!month || !year) {
            return NextResponse.json({ error: 'Missing month or year' }, { status: 400 });
        }

        const m = parseInt(month, 10);
        const y = parseInt(year, 10);

        const expenses = await prisma.fixedCost.findMany({
            where: {
                month: m,
                year: y
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        return NextResponse.json(expenses);
    } catch (error: any) {
        console.error('Error fetching expenses:', error);
        return NextResponse.json({ error: error.message || 'Error fetching expenses' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, name, amount, category, type, month, year, notes } = body;

        if (!name || amount === undefined || !category || !type || !month || !year) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        let expense;

        if (id) {
            // Update existing
            expense = await prisma.fixedCost.update({
                where: { id },
                data: {
                    name,
                    amount: parseFloat(amount),
                    category,
                    type,
                    notes
                }
            });
        } else {
            // Create new
            expense = await prisma.fixedCost.create({
                data: {
                    name,
                    amount: parseFloat(amount),
                    category,
                    type,
                    month: parseInt(month, 10),
                    year: parseInt(year, 10),
                    notes
                }
            });
        }

        return NextResponse.json(expense);
    } catch (error: any) {
        console.error('Error saving expense:', error);
        return NextResponse.json({ error: error.message || 'Error saving expense' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing expense ID' }, { status: 400 });
        }

        await prisma.fixedCost.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting expense:', error);
        return NextResponse.json({ error: error.message || 'Error deleting expense' }, { status: 500 });
    }
}
