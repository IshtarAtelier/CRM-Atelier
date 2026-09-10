/**
 * "No sé esto: me callo y aviso."
 *
 * Hasta el 9/9/2026 el bot tenía cómo callarse (`cancel_bot`, `disable_bot_for_chat`)
 * pero NO tenía cómo avisar: apagaba el bot, etiquetaba la ficha y ahí moría.
 * El cliente quedaba esperando una respuesta que no iba a llegar, y la óptica
 * se enteraba solo si alguien miraba el buzón en ese momento — el `bot_error`
 * del socket es efímero: si nadie tenía el CRM abierto, no existió.
 *
 * Pedido de Ishtar: "que no delire y ofrezca cosas que no conoce; mejor que se
 * llame al silencio y me informe". Esto es la segunda mitad, la que faltaba.
 *
 * Deja TRES rastros, a propósito, porque cada uno falla distinto:
 *   1. una ClientTask en el dashboard — sobrevive a que nadie esté mirando;
 *   2. una nota firmada en la ficha del cliente — queda en su historia;
 *   3. un mail a la administración — llega aunque nadie abra el CRM.
 * Ninguna de las tres puede tumbar la conversación: si una falla, se sigue.
 */

const { prisma } = require('../db');

const CREADO_POR = 'Bot (pidió ayuda)';

/**
 * @param {object} deps
 * @param {(asunto: string, cuerpo: string) => Promise<void>} deps.notifyAdminDown
 * @param {(chatId: string, motivo: string) => Promise<any>} [deps.disableBotForChatById]
 * @param {object} datos
 * @param {string} datos.chatId   id del WhatsAppChat
 * @param {string} datos.motivo   en criollo, lo que se le muestra a la vendedora
 * @param {string} [datos.detalle] contexto extra para el mail
 */
async function escalarAHumano({ notifyAdminDown, disableBotForChatById }, { chatId, motivo, detalle }) {
    const resultado = { apagado: false, tarea: false, nota: false, aviso: false };
    if (!chatId) return resultado;

    const chat = await prisma.whatsAppChat.findUnique({
        where: { id: chatId },
        select: { id: true, waId: true, clientId: true, profileName: true, client: { select: { name: true } } },
    }).catch(() => null);
    if (!chat) return resultado;

    const quien = chat.client?.name || chat.profileName || chat.waId;
    const razon = (motivo || 'el bot no supo cómo seguir').trim();

    // 1. Callarse en ESE chat (no apaga el bot para todos).
    if (disableBotForChatById) {
        await disableBotForChatById(chat.id, `Pidió ayuda: ${razon}`).then(() => { resultado.apagado = true; }).catch(() => {});
    } else {
        await prisma.whatsAppChat.update({ where: { id: chat.id }, data: { botEnabled: false } })
            .then(() => { resultado.apagado = true; }).catch(() => {});
    }

    // 2. Tarea en el dashboard: es lo que hace que alguien se entere aunque
    //    nadie estuviera mirando el buzón en ese segundo.
    if (chat.clientId) {
        await prisma.clientTask.create({
            data: {
                clientId: chat.clientId,
                description: `⚠️ El bot pidió ayuda con ${quien}: ${razon}. Está esperando respuesta.`,
                type: 'TASK',
                status: 'PENDING',
                dueDate: new Date(),
                createdBy: CREADO_POR,
            },
        }).then(() => { resultado.tarea = true; }).catch(() => {});

        await prisma.interaction.create({
            data: {
                clientId: chat.clientId,
                type: 'NOTE',
                userName: 'Bot',
                content: `🤖 El bot se apartó de esta conversación para no improvisar.\nMotivo: ${razon}${detalle ? `\n${detalle}` : ''}`,
            },
        }).then(() => { resultado.nota = true; }).catch(() => {});
    }

    // 3. Mail a la administración: llega aunque nadie abra el CRM.
    if (notifyAdminDown) {
        await notifyAdminDown(
            `El bot pidió ayuda con ${quien}`,
            `El bot dejó de responderle a ${quien} (${chat.waId}) para no dar información equivocada.\n\n` +
            `Motivo: ${razon}\n${detalle ? `\n${detalle}\n` : ''}\n` +
            `La persona está esperando una respuesta. Quedó una tarea en el panel y una nota en la ficha.`,
        ).then(() => { resultado.aviso = true; }).catch(() => {});
    }

    console.log(`  🆘 [Escalada] ${quien}: ${razon} · apagado:${resultado.apagado} tarea:${resultado.tarea} aviso:${resultado.aviso}`);
    return resultado;
}

module.exports = { escalarAHumano, CREADO_POR };
