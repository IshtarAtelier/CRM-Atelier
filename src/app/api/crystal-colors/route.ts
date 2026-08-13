import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { TONOS_TENIDO, ESTILOS_TENIDO } from '@/lib/constants/tenido';

const prisma = new PrismaClient();

// GET — Los tonos de teñido para el selector.
//
// Primero los CANÓNICOS (los mismos que muestra SmartLab, definidos en código:
// ver src/lib/constants/tenido.ts) y después los que alguien haya cargado a
// mano en la tabla y no estén en esa lista. Así el vendedor ve siempre lo que
// el laboratorio acepta —elegir un tono que no existe deja el pedido parado— y
// al mismo tiempo no desaparece nada de lo ya cargado.
export async function GET() {
    try {
        const canonicos = ESTILOS_TENIDO.flatMap(estilo =>
            TONOS_TENIDO.map((tono, i) => ({
                id: `canonico-${estilo.key}-${tono.name}`,
                name: tono.name,
                category: estilo.key,
                hexColor: tono.hexColor,
                sortOrder: i,
                active: true,
            }))
        );

        let extras: any[] = [];
        try {
            const enBase = await prisma.crystalColor.findMany({
                where: { active: true },
                orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
            });
            const yaEstan = new Set(canonicos.map(c => `${c.category}|${c.name.toLowerCase()}`));
            extras = enBase.filter(c => !yaEstan.has(`${c.category}|${(c.name || '').toLowerCase()}`));
        } catch (e) {
            // Si la tabla no responde, el selector igual funciona con los
            // canónicos: es lo que el laboratorio acepta.
            console.error('[Colores de teñido] No se pudieron leer los extras de la base:', e);
        }

        return NextResponse.json([...canonicos, ...extras]);
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
