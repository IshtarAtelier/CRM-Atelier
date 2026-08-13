/**
 * Envío de mensajes de seguimiento con re-validación pre-envío.
 * Soporta modo test (redirige al admin) y modo producción.
 */

const { prisma } = require('../db');
const outbox = require('./outbox');
const { evaluarElegibilidad } = require('./politica');
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

    // Entre que este mensaje se aprobó y llega su turno en la cola pueden pasar
    // horas: en el medio el cliente pudo comprar, pedir que no le escriban, o
    // alguien pudo etiquetar la conversación. Se vuelve a preguntar a la MISMA
    // política que lo aprobó — antes acá había una copia recortada de los checks
    // y por eso el re-chequeo dejaba pasar cosas que el filtro de entrada frenaba.
    //
    // Dos diferencias legítimas, y por eso son parámetros:
    //  · el cooldown NO se mira (este envío ya fue aprobado; mirarlo lo mataría);
    //  · la ventana de actividad es corta (2hs): acá solo interesa no pisar una
    //    conversación que está pasando AHORA.
    const cliente = freshChat.clientId
        ? await prisma.client.findUnique({
            where: { id: freshChat.clientId },
            select: { id: true, name: true, status: true, tags: { select: { name: true } } },
        })
        : null;

    // Sin cliente en la ficha no hay nada que consultar más allá del chat: se
    // evalúa con un cliente mínimo para que igual corran los checks del chat.
    const veredicto = await evaluarElegibilidad({
        client: cliente || { id: freshChat.id, name: freshChat.profileName || waId, tags: [] },
        chat: freshChat,
        mirarCooldown: false,
        actividadHoras: PRE_SEND_ACTIVITY_WINDOW_HOURS,
        // El contacto frío ya se filtró al generar; re-mirarlo acá es una query
        // por mensaje sin cambiar ninguna decisión.
        exigirEntrante: false,
    });

    if (!veredicto.ok) {
        return { canSend: false, reason: veredicto.motivo, codigo: veredicto.codigo };
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
async function sendFollowUp({ waId, text, chatId, label, clientName, followUpType, claim, origen, outboxId }) {
    const logPrefix = TEST_MODE ? '[TEST Follow-Up]' : '[Follow-Up]';

    // Outbox (Fase 1 del motor): el envío queda persistido desde acá hasta su
    // resultado. Si el proceso muere con el mensaje esperando en la cola del
    // anti-ban (minutos u horas), la fila QUEUED lo recupera al arrancar.
    // `outboxId` viene seteado solo desde esa recuperación (se reusa la fila).
    let filaOutbox = outboxId || null;
    if (!filaOutbox) {
        filaOutbox = await outbox.persistir({
            waId, chatId, contenido: text, label, clientName,
            origen: origen || followUpType || 'MANUAL',
            taskId: claim?.taskId, claimStamp: claim?.claimStamp,
        });
    }

    try {
        // 0. Guardrail de salida: mismo filtro final que el bot conversacional
        // (datos prohibidos, títulos, narración interna, CUIDs, revelación de bot)
        const guardrail = runOutputGuardrail(text);
        if (!guardrail.safe) {
            console.warn(`  🚫 ${logPrefix} Bloqueado por guardrail (${guardrail.reason}): "${(text || '').substring(0, 80)}"`);
            await outbox.marcar(filaOutbox, 'SKIPPED', `Guardrail: ${guardrail.reason}`);
            return { sent: false, reason: `Guardrail: ${guardrail.reason}` };
        }

        // 1. Re-validar estado del chat
        const preCheck = await preSendValidation(chatId, waId);
        if (!preCheck.canSend) {
            console.log(`  🚫 ${logPrefix} ${preCheck.reason}. Cancelando envío.`);
            await outbox.marcar(filaOutbox, 'SKIPPED', preCheck.reason);
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
                    if (claim.claimStamp && t.updatedAt.getTime() !== new Date(claim.claimStamp).getTime()) {
                        return { ok: false, reason: 'La tarea fue reclamada por otra corrida (token vencido)' };
                    }
                }
                // Vía libre: el envío físico sale en segundos. Desde acá el
                // resultado es incierto ante un reinicio → SENDING (la
                // recuperación NUNCA reenvía un SENDING).
                await outbox.marcar(filaOutbox, 'SENDING');
                return { ok: true };
            },
        });

        if (sent && sent.skipped) {
            console.log(`  🚦 ${logPrefix} Envío a ${clientName} descartado en cola: ${sent.reason}`);
            await outbox.marcar(filaOutbox, 'SKIPPED', `Preflight: ${sent.reason}`);
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
        await outbox.marcar(filaOutbox, 'SENT');
        return { sent: true };

    } catch (err) {
        console.error(`  ❌ ${logPrefix} Error enviando a ${clientName}:`, err.message);
        await outbox.marcar(filaOutbox, 'FAILED', err.message);
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
