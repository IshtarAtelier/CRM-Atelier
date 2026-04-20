import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientId, description, dueDate } = body;

        if (!clientId || !description) {
            return NextResponse.json({ error: 'clientId y descripción son requeridos' }, { status: 400 });
        }

        const task = await prisma.clientTask.create({
            data: {
                clientId,
                description,
                dueDate: dueDate ? new Date(dueDate) : null,
                status: 'PENDING'
            }
        });

        // Log interaction as well
        await prisma.interaction.create({
            data: {
                clientId,
                type: 'NOTE',
                content: `🤖 Bot creó tarea: ${description}`
            }
        });

        return NextResponse.json(task);
    } catch (error: any) {
        console.error('[Bot Bridge Tasks POST] Error:', error);
        return NextResponse.json({ error: 'Error al crear tarea' }, { status: 500 });
    }
}
