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
    TIER_GRACE_HOURS,
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
async function checkEligibility({ client, chat, quote, now, isManual = false, taskDescription = null }) {

    // 1. SON DOS INTERRUPTORES DISTINTOS, y este módulo solo mira el suyo.
    //
    //    · `chat.botEnabled` y el label [SISTEMA - BOT APAGADO] gobiernan al
    //      AGENTE: si CONTESTA o no en ese chat. Se apagan solos apenas una
    //      persona responde (index.js:270, "Intervención humana").
    //    · Los SEGUIMIENTOS tienen los suyos: el interruptor global del panel
    //      (lo aplica el ejecutor) y, por conversación, la etiqueta
    //      SIN_SEGUIMIENTO.
    //
    //    Hasta el 4/8/2026 acá se exigía `chat.botEnabled`, y eso ataba una cosa
    //    a la otra: medido sobre 20 días, 308 de 308 presupuestos con chat
    //    tenían el bot apagado, así que NUNCA salía un seguimiento. Y era al
    //    revés de lo que el negocio necesita: el presupuesto lo arma una persona
    //    hablando con el cliente —lo que apaga el bot en ese chat—, o sea que
    //    quien más merece seguimiento era justamente a quien nunca se le escribía.
    //
    //    Para frenar los seguimientos de UNA conversación: etiqueta SIN_SEGUIMIENTO.
    //    Para frenarlos TODOS: el interruptor "Seguimientos" del panel.

    // 2. No tiene SIN_SEGUIMIENTO (Only block if NOT manual trigger)
    const labels = chat.chatLabels || [];
    if (!isManual && labels.includes('SIN_SEGUIMIENTO')) {
        return { eligible: false, reason: `${client.name} tiene SIN_SEGUIMIENTO` };
    }

    // 3. No tiene tags de exclusión en el cliente
    const tieneTagExclusion = (client.tags || []).some(tag =>
        TAGS_SIN_BOT.some(t => tag.name.toLowerCase().includes(t))
    );
    if (tieneTagExclusion) {
        return { eligible: false, reason: `${client.name} tiene tag de exclusión` };
    }

    // 4. Etiquetas del chat que excluyen del seguimiento (post-venta, ya es
    //    cliente, etc.). OJO: acá NO va [SISTEMA - BOT APAGADO] — ese label solo
    //    dice que el agente dejó de contestar en la charla, que es lo normal
    //    apenas la toma una persona. Frenar el seguimiento por eso era la causa
    //    de que nunca saliera ninguno (ver nota del punto 1).
    const tieneLabelExclusion = labels.some(label =>
        TAGS_SIN_BOT.some(t => label.toLowerCase().includes(t))
    );
    if (tieneLabelExclusion) {
        return { eligible: false, reason: `Chat de ${client.name} tiene etiqueta de exclusión` };
    }

    // 4b. Pausa puesta por la compuerta de conversación ("hablamos a fin de
    // mes"): vale para todos los sistemas. El trigger manual la respeta también:
    // si el cliente pidió una fecha, taggearlo no debería adelantársela.
    if (chat.followUpPausedUntil && new Date(chat.followUpPausedUntil) > now) {
        return { eligible: false, reason: `Seguimientos de ${client.name} pausados hasta ${new Date(chat.followUpPausedUntil).toLocaleDateString('es-AR')}` };
    }

    // 5. Cooldown: mínimo COOLDOWN_HOURS desde último follow-up (Bypassed if manual trigger)
    if (!isManual && chat.lastFollowUpAt) {
        const hoursSinceLastFU = (now.getTime() - new Date(chat.lastFollowUpAt).getTime()) / 3600000;
        if (hoursSinceLastFU < COOLDOWN_HOURS) {
            return { eligible: false, reason: `${client.name} recibió follow-up hace ${hoursSinceLastFU.toFixed(1)}hs (cooldown: ${COOLDOWN_HOURS}hs)` };
        }
    }

    // 6. Chat sin actividad reciente (Bypassed if manual trigger)
    if (!isManual && chat.lastMessageAt) {
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

    // 8.5. No es un contacto frío (debe tener al menos un mensaje entrante registrado) (Bypassed if manual trigger)
    if (!isManual) {
        const inboundCount = await prisma.whatsAppMessage.count({
            where: {
                chatId: chat.id,
                direction: 'INBOUND',
            },
        });
        if (inboundCount === 0) {
            return { eligible: false, reason: `${client.name} es un contacto frío (sin mensajes entrantes)` };
        }
    }

    // 9. Determinar qué tier de seguimiento le corresponde
    if (isManual && taskDescription) {
        const tierType = taskDescription.includes('DIA_15') ? 'DIA_15' : (taskDescription.includes('DIA_4') ? 'DIA_4' : 'DIA_1');
        const tier = FOLLOWUP_TIERS.find(t => t.type === tierType);
        if (tier) {
            return {
                eligible: true,
                followUpType: tier.type,
                label: tier.label,
                reason: `${client.name} califica por trigger manual para ${tier.type}`,
            };
        }
    }

    const diffHours = (now.getTime() - new Date(quote.createdAt).getTime()) / 3600000;

    for (const tier of FOLLOWUP_TIERS) {
        // ¿Ya tiene esta etiqueta?
        if (labels.includes(tier.label)) continue;

        // ¿Requiere una etiqueta previa que no tiene?
        if (tier.requiresPrevious && !labels.includes(tier.requiresPrevious)) continue;

        // ¿Pasaron suficientes horas... y no DEMASIADAS?
        //
        // El techo es tan importante como el piso: sin él, un presupuesto de
        // hace 20 días recibía hoy su seguimiento "de las 48 horas", y al
        // cliente le llegaba un "¿pudiste verlo?" tres semanas tarde — suena a
        // error y quema la relación. Si el escalón quedó viejo, se saltea y se
        // evalúa el siguiente; si ninguno está en ventana, no se manda nada.
        // El trigger manual ignora el techo: si alguien lo pide a mano, sabe
        // lo que hace.
        const venceEn = tier.hoursAfterQuote + TIER_GRACE_HOURS;
        if (diffHours >= tier.hoursAfterQuote && (isManual || diffHours <= venceEn)) {
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
