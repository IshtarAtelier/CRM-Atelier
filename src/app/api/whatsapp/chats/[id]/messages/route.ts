import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

// GET /api/whatsapp/chats/[id]/messages
// Lee DIRECTO de la base (compartida con wa-service): es una lectura pura +
// reset de no-leídos, no necesita la sesión de WhatsApp, así que evitamos el
// hop a wa-service (que sumaba latencia y reintentos en cada apertura de chat).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const messages = await prisma.whatsAppMessage.findMany({
            where: { chatId: id },
            orderBy: { createdAt: 'asc' },
        });

        // Marcar como leído (igual que hacía wa-service al servir los mensajes).
        // updateMany no lanza si el chat no existe.
        prisma.whatsAppChat.updateMany({ where: { id }, data: { unreadCount: 0 } })
            .catch((e) => console.error('[WhatsApp Messages GET] Error al resetear no-leídos:', e));

        const { getSignedUrl } = await import('@/lib/storage');
        const messagesWithUrls = await Promise.all(messages.map(async (msg) => {
            if (msg.mediaUrl) {
                msg.mediaUrl = await getSignedUrl(msg.mediaUrl);
            }
            return msg;
        }));
        return NextResponse.json(messagesWithUrls);
    } catch (e: any) {
        console.error('Error fetching messages:', e);
        return NextResponse.json([]);
    }
}
