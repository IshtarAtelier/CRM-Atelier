/**
 * Qué ESCALÓN de seguimiento le toca a un presupuesto (DÍA 1 / 4 / 15).
 *
 * Los filtros de "¿se le puede escribir?" ya no viven acá: los resuelve
 * `politica.js`, que es el único módulo que los implementa para todo el sistema.
 */

const { evaluarElegibilidad } = require('./politica');
const { FOLLOWUP_TIERS, TIER_GRACE_HOURS } = require('./config');

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

    // Los filtros comunes (interruptor global, SIN_SEGUIMIENTO, etiquetas de
    // exclusión, pausa del cliente, cooldown, actividad reciente, convertido,
    // compra/pago posterior y contacto frío) los resuelve la POLÍTICA. Antes
    // estaban escritos acá y copiados en otros cuatro archivos con umbrales
    // distintos; ahora hay una sola implementación.
    //
    // Lo que queda en este módulo es lo único que le es propio: qué escalón de
    // seguimiento (DÍA 1 / 4 / 15) le toca a un presupuesto según su antigüedad.
    const veredicto = await evaluarElegibilidad({
        client, chat, now, isManual,
        desde: quote.createdAt,
    });
    if (!veredicto.ok) {
        return { eligible: false, reason: veredicto.motivo, codigo: veredicto.codigo };
    }

    const labels = chat.chatLabels || [];

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
