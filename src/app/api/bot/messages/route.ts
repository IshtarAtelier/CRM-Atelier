import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { prefillAdTag, fallbackAdTag } from '@/lib/ads/ad-tag';
import { vincularChatSiCorresponde } from '@/lib/whatsapp/vincular-chat';
import { WHATSAPP_PHONE, WHOLESALE_WHATSAPP_PHONE } from '@/lib/constants';

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

        // --- PUENTE ENTRE LAS DOS LÍNEAS DEL NEGOCIO ---
        //
        // Un mensaje que entra desde la línea principal o desde la mayorista no
        // es de un cliente: son las dos líneas de la óptica hablándose entre sí.
        // Se reenvía a la otra y NO se mete en la bandeja de conversaciones con
        // clientes, que es lo que hace el `return` del final.
        //
        // Los números salen de `src/lib/constants.ts`, que es su única fuente:
        // estaban copiados a mano acá y en /api/equipo/mensajes, así que cambiar
        // una línea del negocio obligaba a acordarse de tres lugares.
        const MATIAS_PHONE = WHATSAPP_PHONE;
        const ISHTAR_PHONE = WHOLESALE_WHATSAPP_PHONE;
        
        if (direction === 'INBOUND' && (waId === `${MATIAS_PHONE}@c.us` || waId === `${ISHTAR_PHONE}@c.us`)) {
            const senderName = waId === `${MATIAS_PHONE}@c.us` ? 'MATIAS' : 'ISHTAR';
            const targetPhone = senderName === 'MATIAS' ? ISHTAR_PHONE : MATIAS_PHONE;
            
            // Ya NO se guarda en `TeamMessage`: esa tabla la leía /admin/equipo,
            // que quedó reemplazada por la mensajería interna (/admin/mensajes)
            // y ya no está enlazada en el menú. Seguir escribiéndola era generar
            // filas que nadie iba a leer nunca.
            //
            // Tampoco se vuelca a la mensajería interna: esto es un puente entre
            // dos líneas de WhatsApp, no un mensaje entre colaboradores con
            // usuario en el sistema. Mezclarlos ensuciaría la bandeja del equipo
            // con el tráfico de las líneas.

            // Reenviar a la otra línea
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

        // Enganchar el chat con la ficha del cliente, si esa persona ya existe.
        // Hasta ahora el vínculo se armaba SOLO al crear una ficha (ahí
        // contact.service busca los chats sueltos con ese teléfono); si el
        // WhatsApp entraba primero —que es el caso normal cuando alguien
        // responde un anuncio— el chat quedaba con clientId en null para
        // siempre. Y como el reporte de ROAS cruza gasto contra ventas POR
        // clientId, las ventas de esa gente eran invisibles para la atribución:
        // el retorno de cada anuncio se subestimaba. Bloqueante B5 del plan.
        //
        // Se intenta en cada mensaje, no solo al crear el chat: la ficha puede
        // haberse creado después (alguien vino al local y la cargó a mano), y
        // el próximo mensaje del mismo chat cierra el vínculo. Es barato: sale
        // por el `if (chat.clientId)` sin tocar la base cuando ya está atado.
        if (!chat.clientId) {
            const vinculado = await vincularChatSiCorresponde(chat);
            if (vinculado) chat = { ...chat, clientId: vinculado };
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
            // Mismo criterio que el wa-service: etiqueta con corchetes primero,
            // y si no hay, el fallback de prefills genéricos → 'generico'.
            const tag = prefillAdTag(content) || fallbackAdTag(content);
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
