/**
 * Determina si un prospecto califica para recibir un seguimiento de venta.
 * Encapsula TODOS los filtros de elegibilidad en un solo módulo testeable.
 */

const { prisma } = require('../db');
const { TAGS_SIN_BOT } = require('../utils');
const {
    FOLLOWUP_TIERS,
    COOLDOWN_HOURS,
    ACTIVITY_WINDOW_HOURS,
} = require('./config');

/**
 * Verifica si un cliente/chat/presupuesto califica para seguimiento.
 * Los checks están ordenados del más barato al más caro (DB queries al final).
 *
 * @param {Object} params
 * @param {Object} params.client - Cliente con tags[], whatsappChats[]
 * @param {Object} params.chat - Chat con botEnabled, chatLabels[], lastFollowUpAt, lastMessageAt
 * @param {Object} params.quote - Presupuesto con createdAt
 * @param {Date} params.now - Fecha actual
 * @returns {Promise<{ eligible: boolean, followUpType?: string, label?: string, reason?: string }>}
 */
async function checkEligibility({ client, chat, quote, now }) {

    // 1. Bot habilitado para este chat
    if (!chat.botEnabled) {
        return { eligible: false, reason: `Bot desactivado para ${client.name}` };
    }

    // 2. No tiene SIN_SEGUIMIENTO
    const labels = chat.chatLabels || [];
    if (labels.includes('SIN_SEGUIMIENTO')) {
        return { eligible: false, reason: `${client.name} tiene SIN_SEGUIMIENTO` };
    }

    // 3. No tiene tags de exclusión en el cliente
    const tieneTagExclusion = (client.tags || []).some(tag =>
        TAGS_SIN_BOT.some(t => tag.name.toLowerCase().includes(t))
    );
    if (tieneTagExclusion) {
        return { eligible: false, reason: `${client.name} tiene tag de exclusión` };
    }

    // 4. No tiene label de bot apagado manual
    const tieneLabelApagado = labels.some(label =>
        label.includes('[SISTEMA - BOT APAGADO]') ||
        TAGS_SIN_BOT.some(t => label.toLowerCase().includes(t))
    );
    if (tieneLabelApagado) {
        return { eligible: false, reason: `Chat de ${client.name} desactivado manualmente` };
    }

    // 5. Cooldown: mínimo COOLDOWN_HOURS desde último follow-up
    if (chat.lastFollowUpAt) {
        const hoursSinceLastFU = (now.getTime() - new Date(chat.lastFollowUpAt).getTime()) / 3600000;
        if (hoursSinceLastFU < COOLDOWN_HOURS) {
            return { eligible: false, reason: `${client.name} recibió follow-up hace ${hoursSinceLastFU.toFixed(1)}hs (cooldown: ${COOLDOWN_HOURS}hs)` };
        }
    }

    // 6. Chat sin actividad reciente
    if (chat.lastMessageAt) {
        const hoursSinceLastMsg = (now.getTime() - new Date(chat.lastMessageAt).getTime()) / 3600000;
        if (hoursSinceLastMsg < ACTIVITY_WINDOW_HOURS) {
            return { eligible: false, reason: `Chat de ${client.name} tuvo actividad hace ${hoursSinceLastMsg.toFixed(1)}hs` };
        }
    }

    // 7. No tiene compras/pedidos posteriores al presupuesto (query DB)
    const completedOrders = await prisma.order.findFirst({
        where: {
            clientId: client.id,
            orderType: { in: ['SALE', 'ORDER'] },
            createdAt: { gt: quote.createdAt },
            isDeleted: false,
        },
    });
    if (completedOrders) {
        return { eligible: false, reason: `${client.name} ya realizó compras posteriores` };
    }

    // 8. No tiene pagos posteriores al presupuesto (query DB)
    const completedPayments = await prisma.payment.findFirst({
        where: {
            order: { clientId: client.id },
            date: { gt: quote.createdAt },
        },
    });
    if (completedPayments) {
        return { eligible: false, reason: `${client.name} ya registró pagos posteriores` };
    }

    // 8.5. No es un contacto frío (debe tener al menos un mensaje entrante registrado)
    const inboundCount = await prisma.whatsAppMessage.count({
        where: {
            chatId: chat.id,
            direction: 'INBOUND',
        },
    });
    if (inboundCount === 0) {
        return { eligible: false, reason: `${client.name} es un contacto frío (sin mensajes entrantes)` };
    }

    // 9. Determinar qué tier de seguimiento le corresponde
    const diffHours = (now.getTime() - new Date(quote.createdAt).getTime()) / 3600000;

    for (const tier of FOLLOWUP_TIERS) {
        // ¿Ya tiene esta etiqueta?
        if (labels.includes(tier.label)) continue;

        // ¿Requiere una etiqueta previa que no tiene?
        if (tier.requiresPrevious && !labels.includes(tier.requiresPrevious)) continue;

        // ¿Pasaron suficientes horas?
        if (diffHours >= tier.hoursAfterQuote) {
            return {
                eligible: true,
                followUpType: tier.type,
                label: tier.label,
                reason: `${client.name} califica para ${tier.type} (${diffHours.toFixed(1)}hs transcurridas)`,
            };
        }
    }

    // No cumple ningún tier
    return { eligible: false, reason: `${client.name} no cumple plazos para ningún seguimiento (${diffHours.toFixed(1)}hs)` };
}

module.exports = { checkEligibility };
