import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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
        await prisma.doctor.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting doctor:', error);
        return NextResponse.json({ error: 'Error al eliminar médico' }, { status: 500 });
    }
}
