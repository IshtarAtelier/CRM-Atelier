/**
 * Módulo de seguimiento por inactividad del cliente.
 * Envía un recordatorio automático si el bot respondió hace más de 24 horas
 * y el cliente no contestó.
 * 
 * DEDUP: Usa lastFollowUpAt en la DB para no enviar más de 1 follow-up cada 24hs.
 * EXCLUSIÓN MUTUA: Respeta etiquetas de sales-followups.
 */
const { prisma } = require('../db');
const { sendMessage, sendTypingState } = require('../whatsapp/client');
const { isBusinessHours } = require('../shared/business-hours');
const { ALL_FOLLOWUP_LABELS } = require('../followups/config');

// Pool de 5 variantes para follow-up de inactividad (evita texto idéntico y firma repetitiva)
const FOLLOW_UP_TEXT_VARIANTS = [
    "Hola! Te escribo para saber si te quedó alguna duda o si querés que sigamos viendo opciones 😊",
    "Buenas! Cómo estás? Te escribo para ver si pudiste revisar la info y si te quedó alguna consulta sobre los armazones o lentes 👍",
    "Hola! Quería saber si tenías alguna consulta sobre el presupuesto o si querés que busquemos otras alternativas de cristales 👓",
    "Buenas! Qué tal? Pasaba a ver si querés que sigamos con la seña del pedido o si necesitás ver algún otro detalle antes 🕶️",
    "Hola! Espero que estés bien. Te quedó alguna duda pendiente de lo que charlamos ayer o querés coordinar los lentes? 😊"
];

// Cooldown mínimo entre follow-ups para el mismo chat (48 horas según políticas anti-ban)
const FOLLOW_UP_COOLDOWN_MS = 48 * 60 * 60 * 1000;

/**
 * Chequea y envía follow-ups por inactividad.
 * @param {Object} deps - Dependencias inyectadas
 * @param {Function} deps.isAgentEnabled - Función que retorna si el agente está habilitado
 * @param {Set} deps.botReplyingTo - Set de waIds activos
 * @param {Function} deps.broadcastChatUpdate - Emite actualización de chat por WebSocket
 */
async function checkAndSendInactivityFollowUps({ isAgentEnabled, botReplyingTo, broadcastChatUpdate }) {
    const now = new Date();
    if (!isBusinessHours(now)) {
        return;
    }

    // Las tareas de inactividad se ejecutan incluso con el asistente global apagado
    // porque representan compromisos comerciales que no deben detenerse.

    const activeChats = await prisma.whatsAppChat.findMany({
        where: { botEnabled: true, archived: false },
        include: {
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1
            }
        }
    });

    for (const chat of activeChats) {
        if (chat.messages.length === 0) continue;
        const lastMsg = chat.messages[0];

        // Solo actuar si el último mensaje fue del Bot (outbound)
        if (lastMsg.direction === 'OUTBOUND' && lastMsg.senderName === 'Bot') {
            // DEDUP #1: Si el último mensaje ya es un follow-up de nuestro pool, saltar
            if (FOLLOW_UP_TEXT_VARIANTS.includes(lastMsg.content)) {
                continue;
            }

            // DEDUP #2: Verificar cooldown persistente (24hs desde último follow-up)
            if (chat.lastFollowUpAt) {
                const timeSinceLastFollowUp = now.getTime() - new Date(chat.lastFollowUpAt).getTime();
                if (timeSinceLastFollowUp < FOLLOW_UP_COOLDOWN_MS) {
                    continue;
                }
            }

            // EXCLUSIÓN MUTUA: Si sales-followups ya está gestionando este chat, no enviar
            if (chat.chatLabels && ALL_FOLLOWUP_LABELS.some(label => chat.chatLabels.includes(label))) {
                continue;
            }

            // Verificar si el cliente tiene compras recientes (no enviar si ya compró)
            if (chat.clientId) {
                const recentOrders = await prisma.order.findFirst({
                    where: {
                        clientId: chat.clientId,
                        orderType: { in: ['SALE', 'ORDER'] },
                        isDeleted: false,
                        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                    }
                });
                if (recentOrders) {
                    continue;
                }
            }

            // Excluir si tiene label SIN_SEGUIMIENTO
            if (chat.chatLabels && chat.chatLabels.includes('SIN_SEGUIMIENTO')) {
                continue;
            }

            const diffMs = now.getTime() - new Date(lastMsg.createdAt).getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours >= 24) {
                console.log(`  ✉️ [Follow-Up] Enviando recordatorio por inactividad de ${diffHours.toFixed(1)}hs a ${chat.profileName || chat.waId}`);
                
                try {
                    botReplyingTo.add(chat.waId);
                    await sendTypingState(chat.waId);
                    await new Promise(r => setTimeout(r, 2000));
                    
                    // Selección aleatoria del pool de variantes
                    const selectedText = FOLLOW_UP_TEXT_VARIANTS[Math.floor(Math.random() * FOLLOW_UP_TEXT_VARIANTS.length)];
                    const sent = await sendMessage(chat.waId, selectedText, null, { isProactive: true });
                    
                    if (sent && sent.id && sent.id._serialized) {
                        await prisma.whatsAppMessage.upsert({
                            where: { waMessageId: sent.id._serialized },
                            update: { senderName: 'Bot' },
                            create: {
                                chatId: chat.id,
                                direction: 'OUTBOUND',
                                type: 'TEXT',
                                content: selectedText,
                                waMessageId: sent.id._serialized,
                                senderName: 'Bot',
                                status: 'SENT'
                            }
                        });
                    } else {
                        await prisma.whatsAppMessage.create({
                            data: {
                                chatId: chat.id,
                                direction: 'OUTBOUND',
                                type: 'TEXT',
                                content: selectedText,
                                senderName: 'Bot',
                                status: 'SENT'
                            }
                        });
                    }

                    // Actualizar timestamps
                    await prisma.whatsAppChat.update({
                        where: { id: chat.id },
                        data: { 
                            lastMessageAt: new Date(),
                            lastFollowUpAt: new Date()
                        }
                    });
                    
                    broadcastChatUpdate(chat.id);
                } catch (err) {
                    console.error(`Error enviando follow-up a ${chat.waId}:`, err.message);
                } finally {
                    setTimeout(() => botReplyingTo.delete(chat.waId), 3000);
                }
            }
        }
    }
}

module.exports = { checkAndSendInactivityFollowUps };
