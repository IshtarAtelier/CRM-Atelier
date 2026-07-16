import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const doctors = await prisma.doctor.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(doctors);
    } catch (error) {
        console.error('Error fetching doctors:', error);
        return NextResponse.json({ error: 'Error al obtener médicos' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name } = await request.json();
        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
        }
        const doctor = await prisma.doctor.create({
            data: { name: name.trim() }
        });

        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'CREATE',
            entityType: 'OTHER',
            entityId: doctor.id,
            details: {
                descripcion: `Médico "${doctor.name}" creado`,
                name: doctor.name,
            },
        });

        return NextResponse.json(doctor);
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un médico con ese nombre' }, { status: 409 });
        }
        console.error('Error creating doctor:', error);
        return NextResponse.json({ error: 'Error al crear médico' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'ID es obligatorio' }, { status: 400 });
        }
        const previo = await prisma.doctor.findUnique({ where: { id } });
        await prisma.doctor.delete({ where: { id } });

        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'DELETE',
            entityType: 'OTHER',
            entityId: id,
            details: {
                descripcion: `Médico "${previo?.name ?? id}" eliminado`,
                snapshot: { name: previo?.name ?? null },
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting doctor:', error);
        return NextResponse.json({ error: 'Error al eliminar médico' }, { status: 500 });
    }
}
