/**
 * Envío de mensajes de seguimiento con re-validación pre-envío.
 * Soporta modo test (redirige al admin) y modo producción.
 */

const { prisma } = require('../db');
const { sendMessage, sendTypingState } = require('../whatsapp/client');
const { runOutputGuardrail } = require('../services/ai.service');
const { resolveWaMessageId, rememberBotMessage } = require('../shared/message-id');
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

    // Acá NO se mira `botEnabled` ni [SISTEMA - BOT APAGADO]: gobiernan si el
    // AGENTE contesta, y se apagan solos apenas una persona toma la charla —
    // que es justo lo que pasa cuando se arma un presupuesto. El corte del
    // seguimiento por conversación es la etiqueta SIN_SEGUIMIENTO.

    // Etiquetas de corte: pueden haberse aplicado (por un humano o por la
    // compuerta de conversación) DESPUÉS de que este envío se generó y encoló.
    const labels = freshChat.chatLabels || [];
    if (labels.includes('SIN_SEGUIMIENTO')) {
        return { canSend: false, reason: `Etiqueta SIN_SEGUIMIENTO en ${freshChat.profileName || waId}` };
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
 * @param {Object} [params.claim] - Token de reclamo de la ClientTask que originó
 *   este envío: { taskId, claimStamp }. Permite que el preflight verifique en el
 *   momento del envío físico que la tarea siga siendo NUESTRA (status SENDING y
 *   updatedAt igual al del reclamo). Si otra corrida la recuperó, canceló o
 *   pospuso, el updatedAt cambió y este envío se descarta solo — sin duplicados.
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendFollowUp({ waId, text, chatId, label, clientName, followUpType, claim }) {
    const logPrefix = TEST_MODE ? '[TEST Follow-Up]' : '[Follow-Up]';

    try {
        // 0. Guardrail de salida: mismo filtro final que el bot conversacional
        // (datos prohibidos, títulos, narración interna, CUIDs, revelación de bot)
        const guardrail = runOutputGuardrail(text);
        if (!guardrail.safe) {
            console.warn(`  🚫 ${logPrefix} Bloqueado por guardrail (${guardrail.reason}): "${(text || '').substring(0, 80)}"`);
            return { sent: false, reason: `Guardrail: ${guardrail.reason}` };
        }

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

        // 5. Enviar mensaje. El preflight corre DENTRO de la cola anti-ban,
        // justo antes del envío físico: la validación de arriba es al encolar,
        // pero el mensaje puede esperar en cola desde minutos hasta horas
        // (pausas de lote, límite horario, retención nocturna) y en ese lapso
        // el cliente pudo escribir o la tarea pudo cancelarse.
        console.log(`  ✉️ ${logPrefix} Enviando mensaje a ${clientName} (${targetWaId.substring(0, 15)}...)`);
        const sent = await sendMessage(targetWaId, messageText, null, {
            isProactive: true,
            preflight: async () => {
                const recheck = await preSendValidation(chatId, waId);
                if (!recheck.canSend) return { ok: false, reason: recheck.reason };
                if (claim && claim.taskId) {
                    const t = await prisma.clientTask.findUnique({
                        where: { id: claim.taskId },
                        select: { status: true, updatedAt: true },
                    });
                    if (!t || t.status !== 'SENDING') {
                        return { ok: false, reason: `La tarea ya no está en SENDING (${t ? t.status : 'no existe'})` };
                    }
                    if (claim.claimStamp && t.updatedAt.getTime() !== claim.claimStamp.getTime()) {
                        return { ok: false, reason: 'La tarea fue reclamada por otra corrida (token vencido)' };
                    }
                }
                return { ok: true };
            },
        });

        if (sent && sent.skipped) {
            console.log(`  🚦 ${logPrefix} Envío a ${clientName} descartado en cola: ${sent.reason}`);
            return { sent: false, reason: `Preflight: ${sent.reason}` };
        }

        const msgSerializedId = resolveWaMessageId(sent, { waId: targetWaId, direction: 'OUTBOUND', content: messageText });

        // Registrar el mensaje como del bot para que handleMessageCreate lo ignore
        // (si no, el listener de salientes lo puede tratar como intervención humana)
        rememberBotMessage(sent, messageText);

        // 6. Guardar en DB (siempre en el chat original, no en el test).
        // Upsert: si el listener de salientes ya lo registró, forzamos senderName 'Bot'
        // para que en el CRM figure como seguimiento del bot y no como "Teléfono".
        await prisma.whatsAppMessage.upsert({
            where: { waMessageId: msgSerializedId },
            update: { senderName: 'Bot' },
            create: {
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
