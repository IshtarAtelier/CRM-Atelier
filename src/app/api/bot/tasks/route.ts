import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { BOT_ACTOR } from '@/lib/actor';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientId, description, dueDate } = body;

        if (!clientId || !description) {
            return NextResponse.json({ error: 'clientId y descripción son requeridos' }, { status: 400 });
        }

        // Validar que el clientId exista antes de crear la tarea
        const clientExists = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
        if (!clientExists) {
            console.warn(`[Bot Bridge Tasks POST] clientId inexistente: ${clientId}. Ignorando creación de tarea.`);
            return NextResponse.json({ error: 'Cliente no encontrado', skipped: true }, { status: 200 });
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
                content: `🤖 Bot creó tarea: ${description}`,
                userId: BOT_ACTOR.id,
                userName: BOT_ACTOR.name,
            }
        });

        return NextResponse.json(task);
    } catch (error: any) {
        console.error('[Bot Bridge Tasks POST] Error:', error);
        return NextResponse.json({ error: 'Error al crear tarea' }, { status: 500 });
    }
}
