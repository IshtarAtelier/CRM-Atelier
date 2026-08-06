'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Encontrar la fila de chat de un saliente cuando el waId no matchea exacto.
//
// El mismo contacto puede existir en WhatsApp con DOS identidades: la clásica
// (`5493541...@c.us`) y la nueva de Meta (`265656914161793@lid`). Ya está
// documentado en sales-followups.js y task-generator.js: hay contactos con dos
// chats. Si WhatsApp reporta el saliente con una identidad y la fila quedó
// guardada con la otra, `findUnique({ waId })` devuelve null y el listener de
// salientes se iba en silencio: NO apagaba el bot (le seguía contestando por
// encima de la vendedora) y NO guardaba el mensaje en el buzón.
//
// La regla de oro acá es no equivocarse de chat: apagar el bot o archivar un
// mensaje en la conversación de otro cliente es peor que no hacer nada. Por eso
// el fallback solo acepta una coincidencia ÚNICA y por teléfono exacto.
// ─────────────────────────────────────────────────────────────────────────────

/** Un teléfono de verdad: 10-15 dígitos y sin arrancar en 0. Los @lid falsos son más largos. */
function esTelefonoPlausible(digits) {
    return typeof digits === 'string' && /^[1-9]\d{9,14}$/.test(digits);
}

/** Los dígitos de un waId clásico. Un @lid no tiene teléfono adentro: su número es un id de Meta. */
function telefonoDeWaId(waId) {
    if (typeof waId !== 'string' || !waId.includes('@c.us')) return null;
    const digits = waId.split('@')[0].replace(/[^0-9]/g, '');
    return esTelefonoPlausible(digits) ? digits : null;
}

/**
 * Busca el chat de un waId, con fallback por teléfono cuando el formato no coincide.
 *
 * @param {object} prisma
 * @param {string} waId              El id que reportó WhatsApp (msg.to)
 * @param {object} [opts]
 * @param {(waId:string)=>Promise<string|null>} [opts.lidToPhone]
 *        Resuelve un @lid a teléfono. Es una llamada a WhatsApp: se invoca SOLO
 *        en el fallback, que es raro. Si falla o no está, se devuelve null y el
 *        que llama decide (nunca se adivina un chat).
 * @returns {Promise<{chat: object|null, via: 'waId'|'telefono'|null, telefono: string|null, ambiguo: boolean}>}
 */
async function findChatByWaId(prisma, waId, opts = {}) {
    const vacio = { chat: null, via: null, telefono: null, ambiguo: false };
    if (!waId) return vacio;

    const exacto = await prisma.whatsAppChat.findUnique({ where: { waId } });
    if (exacto) return { chat: exacto, via: 'waId', telefono: null, ambiguo: false };

    // Sin teléfono no hay con qué cruzar: mejor null que un chat adivinado.
    let telefono = telefonoDeWaId(waId);
    if (!telefono && waId.includes('@lid') && typeof opts.lidToPhone === 'function') {
        try {
            const resuelto = await opts.lidToPhone(waId);
            const digits = String(resuelto || '').replace(/[^0-9]/g, '');
            if (esTelefonoPlausible(digits)) telefono = digits;
        } catch {
            // Resolver el LID es best-effort: si WhatsApp no contesta, se sigue sin teléfono.
        }
    }
    if (!telefono) return vacio;

    // `take: 2` a propósito: con dos candidatos no se elige ninguno. Un chat
    // equivocado apagaría el bot y archivaría el mensaje en la ficha de otro.
    const candidatos = await prisma.whatsAppChat.findMany({
        where: { OR: [{ realPhone: telefono }, { waId: `${telefono}@c.us` }] },
        take: 2,
    });

    if (candidatos.length === 1) return { chat: candidatos[0], via: 'telefono', telefono, ambiguo: false };
    return { chat: null, via: null, telefono, ambiguo: candidatos.length > 1 };
}

module.exports = { findChatByWaId, telefonoDeWaId, esTelefonoPlausible };
