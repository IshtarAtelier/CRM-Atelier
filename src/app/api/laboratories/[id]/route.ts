import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';

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

        const lab = await prisma.laboratoryConfig.update({
            where: { id },
            data: {
                name: data.name.trim().toUpperCase(),
                calibrado: parseFloat(data.calibrado) || 0.0,
                iva: parseFloat(data.iva) || 0.0,
                deliveryTime: data.deliveryTime !== undefined ? data.deliveryTime : null,
            }
        });

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

        const lab = await prisma.laboratoryConfig.update({
            where: { id },
            data: updateData
        });

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

        await prisma.laboratoryConfig.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
