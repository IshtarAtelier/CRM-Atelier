/**
 * Módulo de seguimiento por inactividad del cliente.
 * Envía un recordatorio automático si el bot respondió hace más de 4 horas
 * y el cliente no contestó.
 * 
 * DEDUP: Usa lastFollowUpAt en la DB para no enviar más de 1 follow-up cada 24hs.
 * EXCLUSIÓN MUTUA: Respeta etiquetas de sales-followups (SEGUIMIENTO_DIA_1, SEGUIMIENTO_DIA_4).
 */
const { prisma } = require('../db');
const { sendMessage, sendTypingState } = require('../whatsapp-client');

// Texto alineado con las reglas del prompt:
// - Sin signos de apertura (¡¿) — regla 12
// - Voseo cordobés neutro — regla 5
// - No dice "cualquier cosita" (demasiado informal)
const FOLLOW_UP_TEXT = "Hola! Te escribo para saber si te quedó alguna duda o si querés que sigamos viendo opciones 😊";

// Cooldown mínimo entre follow-ups para el mismo chat (24 horas)
const FOLLOW_UP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Etiquetas de sales-followups que indican que ese cron ya está gestionando el chat
const SALES_FOLLOWUP_LABELS = ['SEGUIMIENTO_DIA_1', 'SEGUIMIENTO_DIA_4'];

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

        // Solo actuar si el último mensaje fue del Bot (outbound)
        if (lastMsg.direction === 'OUTBOUND' && lastMsg.senderName === 'Bot') {
            // DEDUP #1: Si el último mensaje ya es el follow-up, saltar
            if (lastMsg.content === FOLLOW_UP_TEXT) {
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
            if (chat.chatLabels && SALES_FOLLOWUP_LABELS.some(label => chat.chatLabels.includes(label))) {
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

                    // Actualizar timestamps: lastMessageAt + lastFollowUpAt (DEDUP persistente)
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

module.exports = { checkAndSendInactivityFollowUps, isBusinessHours };
