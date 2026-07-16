import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

/** Borrar un movimiento de caja de vendedor (corrección). Solo ADMIN. */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const actor = getActor(request);
        if (actor.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Solo administradores pueden borrar movimientos' }, { status: 403 });
        }

        const { id } = await params;
        const entry = await prisma.vendorCashEntry.findUnique({
            where: { id },
            include: { vendor: { select: { name: true } } },
        });
        if (!entry) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
        }

        await prisma.vendorCashEntry.delete({ where: { id } });

        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'DELETE',
            entityType: 'VENDOR_CASH',
            entityId: id,
            details: {
                vendorId: entry.vendorId,
                vendorName: entry.vendor?.name,
                type: entry.type,
                amount: entry.amount,
                reason: entry.reason,
                category: entry.category,
            },
        });

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('Error borrando movimiento de caja de vendedor:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
