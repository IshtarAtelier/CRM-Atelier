import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientId, type, content } = body;

        if (!clientId || !content) {
            return NextResponse.json({ error: 'clientId y content son requeridos' }, { status: 400 });
        }

        // Esta ruta se autentica por BOT_API_KEY: el autor es siempre el bot.
        // Si llega con sesión de usuario (headers del middleware), se respeta esa identidad.
        const sessionUserName = request.headers.get('x-user-name');
        const interaction = await prisma.interaction.create({
            data: {
                clientId,
                type: type || 'NOTE',
                content,
                userId: request.headers.get('x-user-id') || null,
                userName: sessionUserName || 'Bot'
            }
        });

        return NextResponse.json(interaction);
    } catch (error: any) {
        console.error('[Bot Bridge Interactions POST] Error:', error);
        return NextResponse.json({ error: 'Error al registrar interacción' }, { status: 500 });
    }
}
