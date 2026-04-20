import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientId, type, content } = body;

        if (!clientId || !content) {
            return NextResponse.json({ error: 'clientId y content son requeridos' }, { status: 400 });
        }

        const interaction = await prisma.interaction.create({
            data: {
                clientId,
                type: type || 'NOTE',
                content
            }
        });

        return NextResponse.json(interaction);
    } catch (error: any) {
        console.error('[Bot Bridge Interactions POST] Error:', error);
        return NextResponse.json({ error: 'Error al registrar interacción' }, { status: 500 });
    }
}
