import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { prefillAdTag } from '@/lib/ads/ad-tag';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // waMessageId/senderName/status venían llegando y se descartaban en silencio:
        // por eso TODO lo ingresado por esta ruta quedaba anónimo (sin id de WhatsApp
        // y sin autor), imposible de deduplicar y de auditar. Ahora se guardan si vienen.
        const { waId, content, direction, type, mediaUrl, waMessageId, senderName, status } = body;

        console.log('[Bot Webhook] Mensaje recibido de:', waId, 'Contenido:', content);

        if (!waId || !content) {
            return NextResponse.json({ error: 'waId y content son requeridos' }, { status: 400 });
        }

        // Esta ruta es hoy la puerta de entrada de los mensajes de WhatsApp al CRM
        // y no valida nada: cualquiera que conozca la URL puede inyectar mensajes en
        // una ficha. Se deja en modo PERMISIVO (sólo avisa) para no cortar la
        // ingestión viva; poniendo BOT_WEBHOOK_REQUIRE_KEY=true pasa a rechazar.
        const apiKey = request.headers.get('x-api-key');
        const expectedKey = process.env.BOT_API_KEY;
        if (expectedKey && apiKey !== expectedKey) {
            if (process.env.BOT_WEBHOOK_REQUIRE_KEY === 'true') {
                return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
            }
            console.warn('[Bot Webhook] ⚠️ Mensaje aceptado SIN clave válida (modo permisivo). Emisor:', waId);
        }

        // --- TEAM CHAT INTERCEPTION ---
        const MATIAS_PHONE = '5493518685644';
        const ISHTAR_PHONE = '5493541215971';
        
        if (direction === 'INBOUND' && (waId === `${MATIAS_PHONE}@c.us` || waId === `${ISHTAR_PHONE}@c.us`)) {
            const senderName = waId === `${MATIAS_PHONE}@c.us` ? 'MATIAS' : 'ISHTAR';
            const targetPhone = senderName === 'MATIAS' ? ISHTAR_PHONE : MATIAS_PHONE;
            
            // 1. Save internal TeamMessage
            await prisma.teamMessage.create({
                data: { content, sender: senderName }
            });
            
            // 2. Forward to the other team member
            const prefix = senderName === 'MATIAS' ? '👨🏻 *[Matías]*:\n' : '👩🏻‍💻 *[Ishtar]*:\n';
            try {
                const fetchWaRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/whatsapp/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: `${targetPhone}@c.us`,
                        message: `${prefix}${content}`
                    })
                });
                if (!fetchWaRes.ok) {
                    console.error('[Bot Bridge] Error forwarding team message');
                }
            } catch (e) {
                console.error('[Bot Bridge] Exception forwarding team message', e);
            }
            
            // We can still let it flow into the regular CRM WhatsApp chat, or we can just return here.
            // Returning early means these messages won't clutter the CRM customer chat view.
            return NextResponse.json({ success: true, teamMessage: true });
        }
        // ------------------------------


        // Find or create chat
        let chat = await prisma.whatsAppChat.findUnique({
            where: { waId }
        });

        if (!chat) {
            chat = await prisma.whatsAppChat.create({
                data: {
                    waId,
                    status: 'OPEN'
                }
            });
        }

        // Registrar el mensaje. Con id de WhatsApp se hace UPSERT: si el emisor
        // reintenta el webhook (timeout, reintento de cola), antes se duplicaba el
        // mensaje o reventaba con 500 por la unicidad de waMessageId.
        const data = {
            chatId: chat.id,
            content,
            direction: direction || 'OUTBOUND',
            type: type || 'TEXT',
            mediaUrl,
            status: status || 'SENT',
            ...(waMessageId ? { waMessageId } : {}),
            ...(senderName ? { senderName } : {}),
        };

        const yaEstaba = waMessageId
            ? await prisma.whatsAppMessage.findUnique({ where: { waMessageId }, select: { id: true } })
            : null;

        const message = waMessageId
            ? await prisma.whatsAppMessage.upsert({
                where: { waMessageId },
                update: {},   // el primero que lo grabó manda: no se pisa el autor
                create: data,
            })
            : await prisma.whatsAppMessage.create({ data });

        // Persistir la etiqueta del anuncio si viene en el prefill (primer toque:
        // una etiqueta ya grabada nunca se pisa). El wa-service hace lo mismo en su
        // ingestión directa; esto cubre lo que entre por esta ruta.
        if (direction === 'INBOUND' && !chat.adTag) {
            const tag = prefillAdTag(content);
            if (tag) {
                await prisma.whatsAppChat.updateMany({
                    where: { id: chat.id, adTag: null },
                    data: { adTag: tag }
                });
                if (chat.clientId) {
                    await prisma.client.updateMany({
                        where: { id: chat.clientId, adTag: null },
                        data: { adTag: tag }
                    });
                }
            }
        }

        // Update chat. El no leído sube sólo si el mensaje es nuevo: con el
        // reintento de un webhook, el contador se inflaba con el mismo mensaje.
        await prisma.whatsAppChat.update({
            where: { id: chat.id },
            data: {
                lastMessageAt: new Date(),
                unreadCount: direction === 'INBOUND' && !yaEstaba ? { increment: 1 } : undefined
            }
        });

        return NextResponse.json(message);
    } catch (error: any) {
        console.error('[Bot Bridge Messages POST] Error:', error);
        return NextResponse.json({ error: 'Error al registrar mensaje' }, { status: 500 });
    }
}
