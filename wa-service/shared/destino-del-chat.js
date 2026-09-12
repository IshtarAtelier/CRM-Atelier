/**
 * A qué número se le manda un mensaje de este chat.
 *
 * Los chats que vienen de WhatsApp Web (antes del 18/8/2026) tienen como
 * `waId` un identificador "<número largo>@lid" que la API oficial no acepta
 * ("Destino inválido"). Pero el teléfono real está en `realPhone` (lo
 * resolvió el transporte viejo). Medido el 12/9/2026: 133 chats @lid, 132
 * con `realPhone` válido; el motor de seguimientos falló 6 envíos por esto en
 * su primera mañana.
 *
 * Regla: si el `waId` sirve, ese; si no, `realPhone`; si no, null. Y cuando
 * se usa `realPhone`, el chat se migra a ese número (waId = realPhone) para
 * que el próximo entrante caiga en el mismo chat — salvo que ya exista otro
 * chat con ese número (2 casos): ahí se manda igual y se deja el @lid.
 */
function esE164(s) {
    return typeof s === 'string' && /^\d{10,15}$/.test(s);
}

/** @returns {string|null} E.164 al que mandar */
function destinoDelChat(chat) {
    if (!chat) return null;
    const waId = String(chat.waId || '');
    if (waId.includes('@lid')) return esE164(chat.realPhone) ? chat.realPhone : null;
    const pelado = waId.replace(/@c\.us$|@s\.whatsapp\.net$/, '').replace(/\D/g, '');
    if (esE164(pelado)) return pelado;
    return esE164(chat.realPhone) ? chat.realPhone : null;
}

/** Migra un chat @lid a su número real. Silencioso si ya existe un chat con ese número. */
async function migrarChatLid(prisma, chat) {
    if (!chat || !String(chat.waId || '').includes('@lid') || !esE164(chat.realPhone)) return false;
    try {
        await prisma.whatsAppChat.update({ where: { id: chat.id }, data: { waId: chat.realPhone } });
        console.log(`  ♻️ [Destino] Chat ${chat.waId} migrado a ${chat.realPhone}`);
        return true;
    } catch (e) {
        if (e.code !== 'P2002') console.warn(`  ⚠️ [Destino] No se pudo migrar ${chat.waId}: ${e.message}`);
        return false;
    }
}

module.exports = { destinoDelChat, migrarChatLid, esE164 };
