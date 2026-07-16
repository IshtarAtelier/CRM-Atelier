import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

import { unstable_cache } from 'next/cache';

const getCachedLabs = unstable_cache(
    async () => {
        return await prisma.laboratoryConfig.findMany({
            orderBy: { name: 'asc' }
        });
    },
    ['laboratories-list'],
    { tags: ['laboratories'], revalidate: 300 }
);

export async function GET() {
    try {
        const labs = await getCachedLabs();
        return NextResponse.json({ laboratories: labs });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const headersList = await headers();
        const role = headersList.get('x-user-role');
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const data = await req.json();
        
        if (!data.name?.trim()) {
            return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
        }

        const lab = await prisma.laboratoryConfig.create({
            data: {
                name: data.name.trim().toUpperCase(),
                calibrado: parseFloat(data.calibrado) || 0.0,
                iva: parseFloat(data.iva) || 0.0,
                deliveryTime: data.deliveryTime || null,
            }
        });

        const actor = getActor(req);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'CREATE',
            entityType: 'OTHER',
            entityId: lab.id,
            details: {
                descripcion: `Laboratorio "${lab.name}" creado`,
                name: lab.name,
                calibrado: lab.calibrado,
                iva: lab.iva,
                deliveryTime: lab.deliveryTime,
            },
        });

        return NextResponse.json({ laboratory: lab });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un laboratorio con ese nombre' }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
