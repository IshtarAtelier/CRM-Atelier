import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { PAGINA_MENSAJES } from '@/lib/whatsapp/paginacion';

// GET /api/whatsapp/chats/[id]/messages?before=<ISO>
//
// Lee DIRECTO de la base (compartida con wa-service): es una lectura pura, no
// necesita la sesión de WhatsApp, así que evitamos el hop a wa-service (que
// sumaba latencia y reintentos en cada apertura de chat).
//
// Dos cosas que antes hacía y ya no:
//
// 1) Traía el hilo ENTERO (`findMany` sin `take` y sin `select`), con el
//    `content` completo de cada mensaje — los audios guardan base64 de cientos
//    de KB — y encima firmaba una URL por cada mensaje con media. El latido de
//    15 s repetía todo eso mientras el chat estuviera abierto. Ahora trae los
//    últimos 60 y pagina hacia atrás con `?before`.
//
// 2) Reseteaba `unreadCount` en un GET. Un GET con efecto de escritura que
//    disparaban el latido y cualquier prefetch: se "leían" mensajes que nadie
//    miró. Marcar como leído es del POST `mark-read`, que ya existe y que el
//    buzón ya llama al abrir el chat.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const before = new URL(request.url).searchParams.get('before');
        const corte = before ? new Date(before) : null;
        const cursorValido = corte && !Number.isNaN(corte.getTime()) ? corte : null;

        // Descendente + take: usa el índice [chatId, createdAt desc] y corta en
        // el tope. Se devuelve ascendente porque la UI pinta de arriba a abajo.
        const ultimos = await prisma.whatsAppMessage.findMany({
            where: {
                chatId: id,
                ...(cursorValido ? { createdAt: { lt: cursorValido } } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: PAGINA_MENSAJES,
            select: {
                id: true,
                chatId: true,
                direction: true,
                type: true,
                content: true,
                mediaUrl: true,
                waMessageId: true,
                status: true,
                senderName: true,
                templateName: true,
                createdAt: true,
            },
        });
        const messages = ultimos.reverse();

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
        // 503 y no `[]`: un hilo vacío se lee como "este cliente nunca escribió"
        // y alguien reenvía algo que ya mandó. Que la falla se vea es la menos
        // cara de las dos mentiras (mismo criterio que api/whatsapp/agent).
        return NextResponse.json({ error: 'No se pudieron cargar los mensajes' }, { status: 503 });
    }
}
