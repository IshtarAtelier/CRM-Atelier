import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Toggle the bot for a specific chat (e.g. Reactivate AI)
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { chatId, enabled } = body;

        if (!chatId) {
            return NextResponse.json({ error: 'chatId es requerido' }, { status: 400 });
        }

        const chat = await prisma.whatsAppChat.update({
            where: { id: chatId },
            data: { botEnabled: !!enabled }
        });

        // Log interaction if reactivated
        if (enabled && chat.clientId) {
            await prisma.interaction.create({
                data: {
                    clientId: chat.clientId,
                    type: 'SYSTEM',
                    content: `🤖 Inteligencia Artificial reactivada para este chat.`
                }
            });
        }

        return NextResponse.json(chat);
    } catch (error: any) {
        console.error('[Bot Bridge Chat Toggle POST] Error:', error);
        return NextResponse.json({ error: 'Error al cambiar estado del bot' }, { status: 500 });
    }
}
