import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;
        const body = await request.json();
        const { enabled } = body;

        const chat = await prisma.whatsAppChat.update({
            where: { id },
            data: { botEnabled: !!enabled }
        });

        // Log interaction if reactivated
        if (enabled && chat.clientId) {
            await prisma.interaction.create({
                data: {
                    clientId: chat.clientId,
                    type: 'SYSTEM',
                    content: `🤖 Inteligencia Artificial reactivada manualmente desde el CRM.`
                }
            });
        }

        return NextResponse.json(chat);
    } catch (error: any) {
        console.error('[WhatsApp Chat Toggle POST] Error:', error);
        return NextResponse.json({ error: 'Error al cambiar estado del bot' }, { status: 500 });
    }
}
