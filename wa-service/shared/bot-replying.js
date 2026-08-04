'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// "El bot está enviando a este número ahora mismo".
//
// Sirve para no confundir el eco del propio mensaje del bot con una persona
// escribiendo. Es un cinturón de milisegundos: el guardia principal es
// wasSentByBot() (shared/message-id.js), que corre antes en handleMessageCreate.
//
// Por qué vence solo: un seguimiento pone la marca ANTES de encolar el mensaje, y
// la cola anti-ban puede retenerlo desde minutos hasta 13 horas (retención
// nocturna). En todo ese rato la marca quedaba viva, y si una vendedora escribía
// a ese chat su mensaje se leía como envío del bot: NO se apagaba el bot —le
// seguía contestando por encima— y su mensaje quedaba firmado "Bot" en el buzón.
//
// 3 minutos es holgado para cualquier envío real (la simulación de tipeo llega a
// 6s) y acota el daño de horas a minutos.
// ─────────────────────────────────────────────────────────────────────────────

const BOT_REPLYING_MAX_MS = 3 * 60 * 1000;

class BotReplyingSet extends Set {
    /** @param {number} [ttlMs] Vencimiento de la marca. Parametrizable para los tests. */
    constructor(ttlMs = BOT_REPLYING_MAX_MS) {
        super();
        this.ttlMs = ttlMs;
        this._timers = new Map();
    }

    add(waId) {
        clearTimeout(this._timers.get(waId));
        const t = setTimeout(() => {
            if (super.delete(waId)) {
                console.warn(`  ⚠️ [botReplyingTo] Marca de ${waId} vencida a los ${(this.ttlMs / 60000).toFixed(1)} min sin limpiarse (envío colgado o encolado). Se libera para no tapar a una persona.`);
            }
            this._timers.delete(waId);
        }, this.ttlMs);
        t.unref?.();
        this._timers.set(waId, t);
        return super.add(waId);
    }

    delete(waId) {
        clearTimeout(this._timers.get(waId));
        this._timers.delete(waId);
        return super.delete(waId);
    }
}

module.exports = { BotReplyingSet, BOT_REPLYING_MAX_MS };
