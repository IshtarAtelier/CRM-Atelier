'use strict';

/**
 * Salida ÚNICA de mensajes para las herramientas del bot.
 *
 * Antes `tools.js` hacía `require('../whatsapp/client')` directo: mandaba
 * siempre por WhatsApp Web, salteándose el transporte cloud y — lo grave — el
 * chequeo de la ventana de 24 h que vive en `transport/cloud-transport.js`
 * (auditoría H9/L13). Con la API oficial, escribir texto libre fuera de esa
 * ventana es un rechazo de Meta y, repetido, un problema de calidad del número.
 *
 * Ahora quien arranca el servicio INYECTA el sender que corresponde a su
 * transporte (`cloud.js` inyecta el cloud; `index.js` no inyecta nada y cae al
 * legacy). El require de `whatsapp/client` es perezoso a propósito: en el
 * transporte cloud nunca se evalúa, así que no se carga whatsapp-web.js ni
 * Chromium.
 */

let injected = null;

/**
 * @param {(waId: string, content: string, media?: object|null, options?: object) => Promise<any>} fn
 */
function setSender(fn) {
    if (typeof fn !== 'function') throw new TypeError('setSender espera una función');
    injected = fn;
}

/** Solo para tests: vuelve al comportamiento legacy. */
function resetSender() {
    injected = null;
}

/** true si alguien inyectó un transporte (o sea: NO se va a usar WhatsApp Web). */
function hasInjectedSender() {
    return injected !== null;
}

/** Misma firma que `whatsapp/client.js#sendMessage`. */
async function sendMessage(waId, content, media = null, options = {}) {
    if (injected) return injected(waId, content, media, options);
    return require('../whatsapp/client').sendMessage(waId, content, media, options);
}

module.exports = { setSender, resetSender, hasInjectedSender, sendMessage };
