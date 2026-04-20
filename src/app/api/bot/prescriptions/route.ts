import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientId, ...prescriptionData } = body;

        if (!clientId) {
            return NextResponse.json({ error: 'clientId es requerido' }, { status: 400 });
        }

        const prescription = await prisma.prescription.create({
            data: {
                clientId,
                ...prescriptionData,
                date: new Date()
            }
        });

        // Log interaction
        await prisma.interaction.create({
            data: {
                clientId,
                type: 'NOTE',
                content: `🤖 Bot procesó y cargó una nueva receta vía OCR.`
            }
        });

        return NextResponse.json(prescription);
    } catch (error: any) {
        console.error('[Bot Bridge Prescriptions POST] Error:', error);
        return NextResponse.json({ error: 'Error al guardar receta' }, { status: 500 });
    }
}
