import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// PUT /api/fixed-costs/[id] — Update a fixed cost
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, amount, category, month, year, notes } = body;

        const updated = await prisma.fixedCost.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(amount !== undefined && { amount: Number(amount) }),
                ...(category !== undefined && { category }),
                ...(month !== undefined && { month: Number(month) }),
                ...(year !== undefined && { year: Number(year) }),
                ...(notes !== undefined && { notes }),
            },
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Error updating fixed cost:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/fixed-costs/[id] — Delete a fixed cost
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        await prisma.fixedCost.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting fixed cost:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
