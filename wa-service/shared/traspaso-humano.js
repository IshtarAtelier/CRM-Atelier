/**
 * Traspaso a humano: cuando una PERSONA escribe en un chat, el bot se apaga ahí.
 *
 * POR QUÉ es un helper y no dos copias: la regla tiene DOS pasos y hay que
 * hacer los dos, siempre. Apagar sin marcar no alcanza — el Auto-Resume de 24 h
 * y la garantía de Meta Ads vuelven a encender el bot en una charla que un
 * humano ya tomó. La rutina existía escrita a mano en el envío del CRM
 * (`routes/api.js`) y no existía en ningún otro lado.
 *
 * Los caminos por los que una persona puede escribir son tres, y hasta ahora
 * solo el primero apagaba el bot:
 *   1. El buzón del CRM        → `routes/api.js` (/send)
 *   2. El celular del local    → eco `smb_message_echoes` (modo coexistencia)
 *   3. WhatsApp Web            → el mismo eco que el celular
 *
 * Vale para CUALQUIER persona del equipo: la regla mira que sea humano, no
 * quién es.
 */

/**
 * Marca permanente de "acá se metió un humano". Distinta de apagar `botEnabled`:
 * ese se puede volver a prender solo, esta etiqueta no se borra sola.
 */
const ETIQUETA_BOT_APAGADO = '[SISTEMA - BOT APAGADO]';

/**
 * @param {object}   deps
 * @param {object}   deps.prisma
 * @param {string}   deps.chatId
 * @param {string}   deps.motivo                 queda en el log y en el resumen de traspaso
 * @param {Function} deps.disableBotForChatById  el helper del bot: además de apagar,
 *   CANCELA el turno ya programado en el debounce (si no, la respuesta que el bot
 *   tenía agendada sale igual, pisando al humano), refresca el buzón y guarda el
 *   resumen del traspaso.
 */
async function marcarTraspasoHumano({ prisma, chatId, motivo, disableBotForChatById }) {
    if (!chatId) return;

    if (disableBotForChatById) {
        await disableBotForChatById(chatId, motivo)
            .catch(e => console.error('[Traspaso] No se pudo apagar el bot:', e && e.message));
    }

    try {
        const chat = await prisma.whatsAppChat.findUnique({
            where: { id: chatId },
            select: { chatLabels: true },
        });
        const labels = [...(chat?.chatLabels || [])];
        if (!labels.includes(ETIQUETA_BOT_APAGADO)) {
            labels.push(ETIQUETA_BOT_APAGADO);
            await prisma.whatsAppChat.update({ where: { id: chatId }, data: { chatLabels: labels } });
        }
    } catch (e) {
        console.error('[Traspaso] No se pudo marcar el chat como tomado por un humano:', e && e.message);
    }
}

module.exports = { ETIQUETA_BOT_APAGADO, marcarTraspasoHumano };
