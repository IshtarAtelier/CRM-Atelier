import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET — List all crystal colors (optionally filter by active)
export async function GET() {
    try {
        const colors = await prisma.crystalColor.findMany({
            where: { active: true },
            orderBy: [
                { category: 'asc' },
                { sortOrder: 'asc' },
                { name: 'asc' },
            ],
        });
        return NextResponse.json(colors);
    } catch (error) {
        console.error('Error fetching crystal colors:', error);
        return NextResponse.json({ error: 'Error al obtener colores' }, { status: 500 });
    }
}

// POST — Create a new crystal color
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, category, hexColor, sortOrder } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
        }

        const color = await prisma.crystalColor.create({
            data: {
                name: name.trim(),
                category: category || 'COMPACTO',
                hexColor: hexColor || null,
                sortOrder: sortOrder || 0,
            },
        });

        return NextResponse.json(color, { status: 201 });
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un color con ese nombre en esa categoría' }, { status: 409 });
        }
        console.error('Error creating crystal color:', error);
        return NextResponse.json({ error: 'Error al crear color' }, { status: 500 });
    }
}
