import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (request.headers.get('x-user-role') !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }
        const body = await request.json();
        const { id } = await params;

        const previo = await prisma.servicePricing.findUnique({ where: { id } });

        const updatedService = await prisma.servicePricing.update({
            where: { id },
            data: {
                name: body.name,
                description: body.description,
                category: body.category,
                subcategory: body.subcategory,
                priceCash: body.priceCash !== undefined ? parseFloat(body.priceCash) : undefined,
                priceCredit: body.priceCredit !== undefined ? parseFloat(body.priceCredit) : undefined,
                creditMonths: body.creditMonths !== undefined ? parseInt(body.creditMonths) : undefined,
                active: body.active,
                notes: body.notes,
                sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder) : undefined,
            }
        });

        const actor = getActor(request);
        const before: Record<string, any> = {};
        const after: Record<string, any> = {};
        if (previo) {
            for (const campo of ['name', 'priceCash', 'priceCredit', 'active'] as const) {
                if (previo[campo] !== updatedService[campo]) {
                    before[campo] = previo[campo];
                    after[campo] = updatedService[campo];
                }
            }
        }
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'UPDATE',
            entityType: 'SETTING',
            entityId: updatedService.id,
            details: {
                descripcion: `Precio de servicio "${updatedService.name}" actualizado`,
                before,
                after,
            },
        });

        return NextResponse.json(updatedService);
    } catch (error) {
        console.error('Error updating service pricing:', error);
        return NextResponse.json({ error: 'Error updating service' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (request.headers.get('x-user-role') !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }
        const { id } = await params;
        const previo = await prisma.servicePricing.findUnique({ where: { id } });
        await prisma.servicePricing.delete({
            where: { id }
        });

        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'DELETE',
            entityType: 'SETTING',
            entityId: id,
            details: {
                descripcion: `Precio de servicio "${previo?.name ?? id}" eliminado`,
                snapshot: previo ? {
                    name: previo.name,
                    category: previo.category,
                    subcategory: previo.subcategory,
                    priceCash: previo.priceCash,
                    priceCredit: previo.priceCredit,
                    active: previo.active,
                } : null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting service pricing:', error);
        return NextResponse.json({ error: 'Error deleting service' }, { status: 500 });
    }
}
