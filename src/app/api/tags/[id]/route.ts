import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const headersList = await headers();
        const body = await request.json();
        const previo = await prisma.tag.findUnique({ where: { id: id } });
        const updatedTag = await prisma.tag.update({
            where: { id: id },
            data: {
                name: body.name,
                color: body.color,
                botAction: body.botAction,
                notifyPhone: body.notifyPhone,
                autoAssignCondition: body.autoAssignCondition
            }
        });

        const actor = getActor(request);
        const before: Record<string, any> = {};
        const after: Record<string, any> = {};
        if (previo) {
            for (const campo of ['name', 'botAction', 'notifyPhone'] as const) {
                if (previo[campo] !== updatedTag[campo]) {
                    before[campo] = previo[campo];
                    after[campo] = updatedTag[campo];
                }
            }
        }
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'UPDATE',
            entityType: 'OTHER',
            entityId: updatedTag.id,
            details: {
                descripcion: `Etiqueta "${updatedTag.name}" actualizada`,
                name: updatedTag.name,
                botAction: updatedTag.botAction,
                notifyPhone: updatedTag.notifyPhone,
                before,
                after,
            },
        });

        return NextResponse.json(updatedTag);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const headersList = await headers();
        const previo = await prisma.tag.findUnique({ where: { id: id } });
        await prisma.tag.delete({
            where: { id: id }
        });

        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'DELETE',
            entityType: 'OTHER',
            entityId: id,
            details: {
                descripcion: `Etiqueta "${previo?.name ?? id}" eliminada`,
                name: previo?.name ?? null,
                botAction: previo?.botAction ?? null,
                notifyPhone: previo?.notifyPhone ?? null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
    }
}
