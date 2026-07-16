import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

// Compara previo vs. actualizado y registra la auditoría del laboratorio
async function auditLabUpdate(req: Request, previo: any, lab: any) {
    const actor = getActor(req);
    const before: Record<string, any> = {};
    const after: Record<string, any> = {};
    if (previo) {
        for (const campo of ['name', 'calibrado', 'iva', 'deliveryTime'] as const) {
            if (previo[campo] !== lab[campo]) {
                before[campo] = previo[campo];
                after[campo] = lab[campo];
            }
        }
    }
    await logAudit({
        userId: actor.id,
        userName: actor.name,
        action: 'UPDATE',
        entityType: 'OTHER',
        entityId: lab.id,
        details: {
            descripcion: `Laboratorio "${lab.name}" actualizado`,
            before,
            after,
        },
    });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const headersList = await headers();
        const role = headersList.get('x-user-role');
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const data = await req.json();

        if (!data.name?.trim()) {
            return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
        }

        const previo = await prisma.laboratoryConfig.findUnique({ where: { id } });

        const lab = await prisma.laboratoryConfig.update({
            where: { id },
            data: {
                name: data.name.trim().toUpperCase(),
                calibrado: parseFloat(data.calibrado) || 0.0,
                iva: parseFloat(data.iva) || 0.0,
                deliveryTime: data.deliveryTime !== undefined ? data.deliveryTime : null,
            }
        });

        await auditLabUpdate(req, previo, lab);

        return NextResponse.json({ laboratory: lab });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un laboratorio con ese nombre' }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const headersList = await headers();
        const role = headersList.get('x-user-role');
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const data = await req.json();

        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name.trim().toUpperCase();
        if (data.calibrado !== undefined) updateData.calibrado = parseFloat(data.calibrado) || 0.0;
        if (data.iva !== undefined) updateData.iva = parseFloat(data.iva) || 0.0;
        if (data.deliveryTime !== undefined) updateData.deliveryTime = data.deliveryTime;

        const previo = await prisma.laboratoryConfig.findUnique({ where: { id } });

        const lab = await prisma.laboratoryConfig.update({
            where: { id },
            data: updateData
        });

        await auditLabUpdate(req, previo, lab);

        return NextResponse.json(lab);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un laboratorio con ese nombre' }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const headersList = await headers();
        const role = headersList.get('x-user-role');
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;

        const previo = await prisma.laboratoryConfig.findUnique({ where: { id } });

        await prisma.laboratoryConfig.delete({
            where: { id }
        });

        const actor = getActor(req);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'DELETE',
            entityType: 'OTHER',
            entityId: id,
            details: {
                descripcion: `Laboratorio "${previo?.name ?? id}" eliminado`,
                snapshot: previo ? {
                    name: previo.name,
                    calibrado: previo.calibrado,
                    iva: previo.iva,
                    deliveryTime: previo.deliveryTime,
                } : null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
