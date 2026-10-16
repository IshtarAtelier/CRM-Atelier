'use strict';

/**
 * ¿Por qué falló una llamada a la IA (Gemini por clave de API, o Vertex)?
 *
 * UNA sola definición para el bot y el CRM. Espejo TypeScript en
 * `src/lib/ia/errores-ia.ts` (mismos patrones; lo fija `npm run check:credito-ia`
 * corriendo los dos contra los mismos textos de error reales).
 *
 * Clases:
 *  - 'sin_credito': el prepago de AI Studio llegó a cero (402 "prepayment
 *    credits are depleted"), o Vertex dice que el proyecto no tiene facturación.
 *    No se arregla solo: alguien tiene que cargar plata. Pasó el 8/10/2026.
 *  - 'cuota': 429 / RESOURCE_EXHAUSTED / "exceeded your current quota". Puede
 *    ser un pico de un minuto o un tope que no se libera: solo se avisa si
 *    dura (ver CUOTA_SOSTENIDA_MIN en el CRM).
 *  - 'transitorio': 5xx, UNAVAILABLE, overloaded, timeout, red caída.
 *  - 'otro': todo lo demás (un bug, un 400 por el pedido, etc.).
 *
 * Por qué no alcanza con buscar "billing" o "429" sueltos: el 429 de cuota de
 * AI Studio dice "please check your plan and billing details" y NO es falta de
 * crédito; y "429" puede aparecer adentro de un número cualquiera.
 * Los códigos se buscan como número suelto: "$88.429,50" no es un 429.
 */

const CLASE_ERROR_IA = Object.freeze({
    SIN_CREDITO: 'sin_credito',
    CUOTA: 'cuota',
    TRANSITORIO: 'transitorio',
    OTRO: 'otro',
});

const PATRONES_SIN_CREDITO = [
    /(?<![\d.,$])402(?![\d]|[.,]\d)/,
    /payment required/i,
    /prepayment credits? (are|is) depleted/i,
    /credits? (are|is) depleted/i,
    /requires billing to be enabled/i,
    /billing (is )?(not enabled|disabled)/i,
    /BILLING_DISABLED/,
    /billing account[^.]{0,80}(disabled|closed|absent|delinquent)/i,
];

const PATRONES_CUOTA = [
    /(?<![\d.,$])429(?![\d]|[.,]\d)/,
    /RESOURCE_EXHAUSTED/,
    /too many requests/i,
    /exceeded your current quota/i,
    /quota (exceeded|exhausted)/i,
    /rate limit/i,
];

const PATRONES_TRANSITORIO = [
    /(?<![\d.,$])50[0234](?![\d]|[.,]\d)/,
    /UNAVAILABLE/,
    /INTERNAL/,
    /DEADLINE_EXCEEDED/,
    /overloaded/i,
    /timeout|timed out/i,
    /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|socket hang up|fetch failed/i,
];

/** Todo lo que el error dice de sí mismo: mensaje, status, code y causas encadenadas. */
function textoDelError(err, profundidad = 0) {
    if (err == null || profundidad > 4) return '';
    if (typeof err === 'string') return err;
    const partes = [];
    for (const k of ['status', 'code', 'statusText', 'message']) {
        const v = err[k];
        if (v != null && (typeof v === 'string' || typeof v === 'number')) partes.push(String(v));
    }
    if (err.error && typeof err.error === 'object') partes.push(textoDelError(err.error, profundidad + 1));
    if (err.cause) partes.push(textoDelError(err.cause, profundidad + 1));
    if (!partes.length) partes.push(String(err));
    return partes.join(' | ');
}

/** @returns {'sin_credito'|'cuota'|'transitorio'|'otro'} */
function clasificarErrorIA(err) {
    const st = err && typeof err === 'object' ? Number(err.status || err.code) : NaN;
    if (st === 402) return CLASE_ERROR_IA.SIN_CREDITO;
    const texto = textoDelError(err);
    // Sin crédito primero: un 402 que de paso mencione "quota" sigue siendo plata.
    if (PATRONES_SIN_CREDITO.some(p => p.test(texto))) return CLASE_ERROR_IA.SIN_CREDITO;
    if (st === 429 || PATRONES_CUOTA.some(p => p.test(texto))) return CLASE_ERROR_IA.CUOTA;
    if ((st >= 500 && st < 600) || PATRONES_TRANSITORIO.some(p => p.test(texto))) return CLASE_ERROR_IA.TRANSITORIO;
    return CLASE_ERROR_IA.OTRO;
}

/** ¿Es una falla de PLATA o CUOTA (no del chat ni del pedido)? */
function esFallaDeSaldo(clase) {
    return clase === CLASE_ERROR_IA.SIN_CREDITO || clase === CLASE_ERROR_IA.CUOTA;
}

/**
 * Error que lleva su clase puesta. El grafo del bot lo lanza en vez de
 * tragarse la falla del modelo, para que el turno sepa POR QUÉ no hubo
 * respuesta (antes llegaba un `messages: []` y se contaba como falla del chat).
 */
class ErrorDeIA extends Error {
    constructor(clase, original) {
        super(`[IA ${clase}] ${String((original && original.message) || original || '').slice(0, 500)}`);
        this.name = 'ErrorDeIA';
        this.clase = clase;
        this.cause = original;
    }
}

/** Clase de un error cualquiera, respetando la que ya traiga un ErrorDeIA. */
function claseDe(err) {
    if (err && typeof err === 'object' && Object.values(CLASE_ERROR_IA).includes(err.clase)) return err.clase;
    return clasificarErrorIA(err);
}

module.exports = { CLASE_ERROR_IA, clasificarErrorIA, claseDe, esFallaDeSaldo, ErrorDeIA, textoDelError };
