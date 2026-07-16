import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

// PUT /api/fixed-costs/[id] — Update a fixed cost
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const role = request.headers.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const { name, amount, category, month, year, notes } = body;

        const previo = await prisma.fixedCost.findUnique({ where: { id } });

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

        const actor = getActor(request);
        const before: Record<string, any> = {};
        const after: Record<string, any> = {};
        if (previo) {
            for (const campo of ['name', 'amount', 'category', 'month'] as const) {
                if (previo[campo] !== updated[campo]) {
                    before[campo] = previo[campo];
                    after[campo] = updated[campo];
                }
            }
        }
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'UPDATE',
            entityType: 'EXPENSE',
            entityId: updated.id,
            details: {
                descripcion: `Costo fijo "${updated.name}" (${updated.month}/${updated.year}) actualizado`,
                before,
                after,
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
        const role = request.headers.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { id } = await params;

        const previo = await prisma.fixedCost.findUnique({ where: { id } });

        await prisma.fixedCost.delete({ where: { id } });

        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'DELETE',
            entityType: 'EXPENSE',
            entityId: id,
            details: {
                descripcion: `Costo fijo "${previo?.name ?? id}" eliminado`,
                snapshot: previo ? {
                    name: previo.name,
                    amount: previo.amount,
                    category: previo.category,
                    month: previo.month,
                    year: previo.year,
                    notes: previo.notes,
                } : null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting fixed cost:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
