import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
    try {
        const headersList = await headers();
        const tags = await prisma.tag.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { clients: true, orders: true }
                }
            }
        });
        return NextResponse.json(tags);
    } catch (error) {
        return NextResponse.json({ error: 'Unauthorized or Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const headersList = await headers();
        const body = await request.json();

        // trim + colapso de espacios: la tag "visita showroom " (con espacio
        // final) convivió duplicada con "visita showroom". El unique de la DB
        // no distingue espacios, así que hay que limpiar ANTES de crear.
        const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
        if (!name) {
            return NextResponse.json({ error: 'El nombre de la etiqueta no puede estar vacío' }, { status: 400 });
        }

        const newTag = await prisma.tag.create({
            data: {
                name,
                color: body.color || '#9e7f65',
                botAction: body.botAction || 'NONE',
                notifyPhone: body.notifyPhone || null,
                autoAssignCondition: body.autoAssignCondition || null
            }
        });

        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'CREATE',
            entityType: 'OTHER',
            entityId: newTag.id,
            details: {
                descripcion: `Etiqueta "${newTag.name}" creada`,
                name: newTag.name,
                botAction: newTag.botAction,
                notifyPhone: newTag.notifyPhone,
            },
        });

        return NextResponse.json(newTag);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Tag already exists' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
