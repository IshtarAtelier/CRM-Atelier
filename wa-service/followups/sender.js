/**
 * Envío de mensajes de seguimiento con re-validación pre-envío.
 * Soporta modo test (redirige al admin) y modo producción.
 */

const { prisma } = require('../db');
const { sendMessage, sendTypingState } = require('../whatsapp/client');
const {
    TEST_MODE,
    TEST_PHONE,
    PRE_SEND_ACTIVITY_WINDOW_HOURS,
    TYPING_MS_PER_CHAR,
    TYPING_MIN_MS,
    TYPING_MAX_MS,
} = require('./config');

/**
 * Re-valida que el chat siga siendo válido justo antes de enviar.
 * Entre la generación del mensaje y el envío pudo pasar tiempo
 * (delay de cola) donde el estado cambió.
 *
 * @param {string} chatId
 * @param {string} waId - Para logging
 * @returns {Promise<{ canSend: boolean, reason?: string, chat?: Object }>}
 */
async function preSendValidation(chatId, waId) {
    const freshChat = await prisma.whatsAppChat.findUnique({ where: { id: chatId } });

    if (!freshChat) {
        return { canSend: false, reason: `Chat ${chatId} ya no existe` };
    }

    if (!freshChat.botEnabled) {
        return { canSend: false, reason: `Bot desactivado para ${freshChat.profileName || waId}` };
    }

    if (freshChat.lastMessageAt) {
        const hoursSinceLastMsg = (Date.now() - new Date(freshChat.lastMessageAt).getTime()) / 3600000;
        if (hoursSinceLastMsg < PRE_SEND_ACTIVITY_WINDOW_HOURS) {
            return { canSend: false, reason: `Actividad reciente en ${freshChat.profileName || waId} (hace ${hoursSinceLastMsg.toFixed(1)}hs)` };
        }
    }

    return { canSend: true, chat: freshChat };
}

/**
 * Envía un mensaje de seguimiento al cliente (o al admin en modo test).
 *
 * @param {Object} params
 * @param {string} params.waId - WhatsApp ID del destinatario real
 * @param {string} params.text - Texto del mensaje
 * @param {string} params.chatId - ID del chat en la DB
 * @param {string} params.label - Label de seguimiento a agregar
 * @param {string} params.clientName - Nombre del cliente (para logs y modo test)
 * @param {string} params.followUpType - Tipo de seguimiento (para logs)
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendFollowUp({ waId, text, chatId, label, clientName, followUpType }) {
    const logPrefix = TEST_MODE ? '[TEST Follow-Up]' : '[Follow-Up]';

    try {
        // 1. Re-validar estado del chat
        const preCheck = await preSendValidation(chatId, waId);
        if (!preCheck.canSend) {
            console.log(`  🚫 ${logPrefix} ${preCheck.reason}. Cancelando envío.`);
            return { sent: false, reason: preCheck.reason };
        }

        // 2. Determinar destinatario
        const targetWaId = TEST_MODE ? TEST_PHONE : waId;
        const messageText = TEST_MODE
            ? `[TEST - ${followUpType} - Para: ${clientName}]\n\n${text}`
            : text;

        // 3. Marcar como "bot respondiendo" para evitar race condition
        if (global.botReplyingTo) {
            global.botReplyingTo.add(targetWaId);
        }

        // 4. Simular tipeo
        console.log(`  ⏳ ${logPrefix} Simulando escritura para ${clientName}...`);
        try {
            await sendTypingState(targetWaId);
        } catch (typingErr) {
            // No fallar por error de tipeo
            console.warn(`  ⚠️ ${logPrefix} Error en typing state: ${typingErr.message}`);
        }

        const typingMs = Math.min(Math.max(text.length * TYPING_MS_PER_CHAR, TYPING_MIN_MS), TYPING_MAX_MS);
        await new Promise(resolve => setTimeout(resolve, typingMs));

        // 5. Enviar mensaje
        console.log(`  ✉️ ${logPrefix} Enviando mensaje a ${clientName} (${targetWaId.substring(0, 15)}...)`);
        const sent = await sendMessage(targetWaId, messageText);

        const msgSerializedId = sent?.id?._serialized || `followup_${Date.now()}`;

        // 6. Guardar en DB (siempre en el chat original, no en el test)
        await prisma.whatsAppMessage.create({
            data: {
                chatId: chatId,
                direction: 'OUTBOUND',
                type: 'TEXT',
                content: TEST_MODE ? `[TEST] ${text}` : text,
                waMessageId: msgSerializedId,
                senderName: 'Bot',
                status: 'SENT',
            },
        });

        // 7. Actualizar labels y timestamps del chat
        const currentChat = await prisma.whatsAppChat.findUnique({ where: { id: chatId } });
        let updatedLabels = [...(currentChat?.chatLabels || [])];
        if (!updatedLabels.includes(label)) {
            updatedLabels.push(label);
        }

        await prisma.whatsAppChat.update({
            where: { id: chatId },
            data: {
                chatLabels: updatedLabels,
                lastMessageAt: new Date(),
                lastFollowUpAt: new Date(),
            },
        });

        // 8. Notificar al frontend
        if (global.io) {
            global.io.emit('chat_updated', { chatId });
        }

        console.log(`  ✅ ${logPrefix} Mensaje enviado a ${clientName} — etiqueta ${label} aplicada.`);
        return { sent: true };

    } catch (err) {
        console.error(`  ❌ ${logPrefix} Error enviando a ${clientName}:`, err.message);
        return { sent: false, reason: err.message };

    } finally {
        // 9. Limpiar race condition guard
        if (global.botReplyingTo) {
            const targetWaId = TEST_MODE ? TEST_PHONE : waId;
            setTimeout(() => global.botReplyingTo.delete(targetWaId), 3000);
        }
    }
}

module.exports = { sendFollowUp, preSendValidation };
