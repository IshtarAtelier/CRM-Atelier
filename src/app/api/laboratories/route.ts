import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';

export async function GET() {
    try {
        const labs = await prisma.laboratoryConfig.findMany({
            orderBy: { name: 'asc' }
        });
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
