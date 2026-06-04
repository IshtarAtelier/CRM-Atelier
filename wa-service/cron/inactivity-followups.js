/**
 * Módulo de seguimiento por inactividad del cliente.
 * Envía un recordatorio automático si el bot respondió hace más de 4 horas
 * y el cliente no contestó.
 */
const { prisma } = require('../db');
const { sendMessage, sendTypingState } = require('../whatsapp-client');

const FOLLOW_UP_TEXT = "¡Hola! Quería saber si te quedó alguna duda o si querés que sigamos viendo opciones. ¡Avisame cualquier cosita! 😊";

/**
 * Verifica si la hora actual corresponde a horario comercial de Argentina (UTC-3)
 */
function isBusinessHours(date) {
    const argDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const day = argDate.getDay();
    const hour = argDate.getHours();
    const minute = argDate.getMinutes();
    const timeDecimal = hour + minute / 60;

    if (day === 0) return false;
    if (day === 6) {
        return timeDecimal >= 10 && timeDecimal < 14;
    }
    return (timeDecimal >= 9 && timeDecimal < 13.5) || (timeDecimal >= 16 && timeDecimal < 19.5);
}

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

    if (!isAgentEnabled()) return;

    const activeChats = await prisma.whatsAppChat.findMany({
        where: { botEnabled: true },
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

        if (lastMsg.direction === 'OUTBOUND' && lastMsg.senderName === 'Bot') {
            if (lastMsg.content === FOLLOW_UP_TEXT) {
                continue;
            }

            const diffMs = now.getTime() - new Date(lastMsg.createdAt).getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours >= 4) {
                console.log(`  ✉️ [Follow-Up] Enviando recordatorio por inactividad de ${diffHours.toFixed(1)}hs a ${chat.profileName || chat.waId}`);
                
                try {
                    botReplyingTo.add(chat.waId);
                    await sendTypingState(chat.waId);
                    await new Promise(r => setTimeout(r, 2000));
                    const sent = await sendMessage(chat.waId, FOLLOW_UP_TEXT);
                    
                    if (sent && sent.id && sent.id._serialized) {
                        await prisma.whatsAppMessage.upsert({
                            where: { waMessageId: sent.id._serialized },
                            update: { senderName: 'Bot' },
                            create: {
                                chatId: chat.id,
                                direction: 'OUTBOUND',
                                type: 'TEXT',
                                content: FOLLOW_UP_TEXT,
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
                                content: FOLLOW_UP_TEXT,
                                senderName: 'Bot',
                                status: 'SENT'
                            }
                        });
                    }

                    await prisma.whatsAppChat.update({
                        where: { id: chat.id },
                        data: { lastMessageAt: new Date() }
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

module.exports = { checkAndSendInactivityFollowUps, isBusinessHours };
