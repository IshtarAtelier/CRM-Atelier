'use strict';

/**
 * El ÚNICO punto por donde sale un mensaje hacia un cliente.
 *
 * POR QUÉ (auditoría del 10/10/2026): el saneado de la salida del modelo se
 * llamaba A MANO en cada lugar que mandaba algo — bot-cloud, index, los dos
 * crons de seguimiento — y cada uno lo hacía distinto (uno saneaba antes del
 * guardrail, otro después, `send_product_photos` no saneaba nada y mandaba en
 * medio del grafo). Un camino nuevo que se olvidara del saneador mandaba al
 * cliente lo que el modelo escribiera: razonamiento en inglés, notas del
 * historial, "[precio]". Pasó las tres cosas.
 *
 * Ahora los DOS transportes (`transport/cloud-transport.js` y
 * `whatsapp/client.js`) exportan su `sendMessage` envuelto acá, y este
 * envoltorio:
 *   1. EXIGE `options.origen`: 'llm' | 'humano' | 'plantilla' | 'sistema'.
 *      Sin origen no sale nada (error ORIGEN_REQUERIDO). Así el que escribe un
 *      envío nuevo tiene que decir de quién es el texto, y no puede "olvidarse"
 *      de que lo escribió el modelo.
 *   2. Si el origen es 'llm', pasa el texto por el saneador y el guardrail
 *      (`revisarSalidaLLM`). Si no aprueba, NO se manda (SALIDA_RECHAZADA).
 *   3. Una plantilla solo sale con origen 'plantilla' (y viceversa no hace
 *      falta: un texto de sistema puede ir sin plantilla dentro de la ventana).
 *
 * Lo de 'humano' y 'sistema' sale tal cual: lo escribió una vendedora o el
 * código, y el saneador está calibrado para el modelo (borraría, por ejemplo,
 * un "[Lo escribió Mile]" que una persona tipeó a propósito).
 *
 * Lo fija `npm run check:envios-bot` (sin base ni red, también en CI).
 */

const { sanearBloques } = require('./limpiar-salida-bot');
const { runOutputGuardrail } = require('./guardrail-salida');

const ORIGENES = Object.freeze(['llm', 'humano', 'plantilla', 'sistema']);

function errorConCodigo(mensaje, code, extra = {}) {
    const e = new Error(mensaje);
    e.code = code;
    Object.assign(e, extra);
    return e;
}

/**
 * La revisión que se le hace a TODO texto del modelo antes de salir. Es la
 * misma función que usa el transporte: quien la llame antes (para guardar en
 * la outbox exactamente lo que va a salir, por ejemplo) obtiene el mismo
 * resultado, y el transporte la vuelve a pasar igual (es idempotente).
 *
 * @param {string} texto
 * @returns {{ ok: boolean, texto: string, motivo?: string, guardrail?: object, quitado: string[] }}
 */
function revisarSalidaLLM(texto) {
    const r = sanearBloques(texto);
    if (r.rechazo) return { ok: false, texto: '', motivo: r.rechazo.motivo, quitado: r.quitado };
    const limpio = r.bloques.join('\n\n');
    if (!limpio.trim()) return { ok: false, texto: '', motivo: 'vacío tras el saneado', quitado: r.quitado };
    const g = runOutputGuardrail(limpio);
    if (!g.safe) return { ok: false, texto: limpio, motivo: `guardrail: ${g.reason}`, guardrail: g, quitado: r.quitado };
    return { ok: true, texto: limpio, quitado: r.quitado };
}

/**
 * Envuelve el `sendMessage` crudo de un transporte.
 *
 * @param {(waId: string, content: string, media?: object|null, options?: object) => Promise<any>} enviarCrudo
 * @param {{ transporte: string }} meta
 */
function conPuntoDeSalida(enviarCrudo, { transporte } = {}) {
    if (typeof enviarCrudo !== 'function') throw new TypeError('conPuntoDeSalida espera una función');
    const nombre = transporte || 'transporte';

    return async function sendMessage(waId, content, media = null, options = {}) {
        const opts = options || {};
        const origen = opts.origen;
        if (!ORIGENES.includes(origen)) {
            throw errorConCodigo(
                `[${nombre}] Envío sin origen declarado (${JSON.stringify(origen)}). Todo envío tiene que decir si el texto es 'llm', 'humano', 'plantilla' o 'sistema'.`,
                'ORIGEN_REQUERIDO',
            );
        }
        if (opts.template && origen !== 'plantilla') {
            throw errorConCodigo(`[${nombre}] Una plantilla tiene que salir con origen 'plantilla' (vino '${origen}').`, 'ORIGEN_REQUERIDO');
        }

        let texto = content;
        let quitado = [];
        if (origen === 'llm' && texto !== undefined && texto !== null && String(texto).trim()) {
            const r = revisarSalidaLLM(String(texto));
            if (!r.ok) {
                console.warn(`  🛑 [Salida] ${nombre}: texto del modelo RECHAZADO para ${String(waId).slice(0, 15)} (${r.motivo}): "${String(texto).slice(0, 80)}"`);
                throw errorConCodigo(`Salida del modelo rechazada: ${r.motivo}`, 'SALIDA_RECHAZADA', { motivo: r.motivo, guardrail: r.guardrail || null });
            }
            texto = r.texto;
            quitado = r.quitado;
            if (quitado.length) console.log(`  🧹 [Salida] ${nombre}: ${quitado.join(' · ')}`);
        }

        const enviado = await enviarCrudo(waId, texto, media, opts);
        // Quien guarda la burbuja en el buzón tiene que guardar lo que SALIÓ,
        // no lo que pidió mandar.
        if (enviado && typeof enviado === 'object') {
            try { enviado.textoEnviado = texto; enviado.origen = origen; } catch { /* objeto congelado: no importa */ }
        }
        return enviado;
    };
}

module.exports = { ORIGENES, conPuntoDeSalida, revisarSalidaLLM };
