import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// PATCH — Update a crystal color
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { name, category, hexColor, sortOrder, active } = body;

        const data: any = {};
        if (name !== undefined) data.name = name.trim();
        if (category !== undefined) data.category = category;
        if (hexColor !== undefined) data.hexColor = hexColor;
        if (sortOrder !== undefined) data.sortOrder = sortOrder;
        if (active !== undefined) data.active = active;

        const updated = await prisma.crystalColor.update({
            where: { id },
            data,
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un color con ese nombre' }, { status: 409 });
        }
        if (error?.code === 'P2025') {
            return NextResponse.json({ error: 'Color no encontrado' }, { status: 404 });
        }
        console.error('Error updating crystal color:', error);
        return NextResponse.json({ error: 'Error al actualizar color' }, { status: 500 });
    }
}

// DELETE — Remove a crystal color
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.crystalColor.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error?.code === 'P2025') {
            return NextResponse.json({ error: 'Color no encontrado' }, { status: 404 });
        }
        console.error('Error deleting crystal color:', error);
        return NextResponse.json({ error: 'Error al eliminar color' }, { status: 500 });
    }
}
