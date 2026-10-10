'use strict';

/**
 * Qué es un mensaje ENTRANTE, en una sola definición para el bot cloud
 * (`bot-cloud.js`), el transporte legacy (`index.js`) y el auto-respondedor:
 *
 *   'consulta'         — lo escribió una persona y merece respuesta.
 *   'reaccion'         — una reacción, un sticker, un "gracias" de cierre o
 *                        solo emojis: se guarda, no dispara turno.
 *   'auto_nuestro'     — una respuesta automática NUESTRA (bienvenida /
 *                        ausencia de WhatsApp Business) que volvió como entrante.
 *   'auto_del_cliente' — la respuesta automática del NEGOCIO del cliente
 *                        ("Hola! Estoy fuera trabajando. Regreso mañana").
 *
 * POR QUÉ (auditoría del 10/10/2026): un cliente con WhatsApp Business tiene su
 * propio mensaje de ausencia. Le escribíamos, su teléfono contestaba solo, y
 * ese entrante le programaba al bot un turno entero: el bot le respondía a un
 * contestador. Y si la vendedora había tomado el chat, encima lo reactivaba.
 * Cada lugar tenía su filtro (el bot miraba solo el tipo; el auto-respondedor
 * además los patrones de Meta; el legacy otra cosa): ahora es uno.
 *
 * Criterio para 'auto_del_cliente': SEÑALES FUERTES, nunca una sola frase
 * suelta. "mañana regreso por el local" es una consulta; "Estoy fuera
 * trabajando. Regreso mañana" es un contestador. Se exigen dos señales (o una
 * declaración explícita de "mensaje automático"), y cualquier pregunta o
 * mención de lo que vendemos lo devuelve a 'consulta': ante la duda, se
 * contesta — callar a un cliente real es el error caro.
 *
 * Puro: sin base ni red. Lo fija `npm run check:entrantes`.
 */

const { TIPOS_CON_CONSULTA } = require('./tipos-entrantes');
const { isMetaAutoReplyText } = require('./meta-auto-patterns');

const CLASE = Object.freeze({
    CONSULTA: 'consulta',
    REACCION: 'reaccion',
    AUTO_NUESTRO: 'auto_nuestro',
    AUTO_DEL_CLIENTE: 'auto_del_cliente',
});

/** Tipos que nunca son una consulta: se guardan y nada más. */
const TIPOS_REACCION = new Set(['reaction', 'sticker']);

function normalizar(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

// ── Contestadores ───────────────────────────────────────────────────────────

/** Una sola de estas alcanza: el mensaje DICE que es automático. */
const DECLARA_AUTOMATICO = [
    /\b(mensaje|respuesta) automatic[oa]\b/,
    /\bmensagem automatica\b/,
    /\bresposta automatica\b/,
    /\bauto[- ]?reply\b/,
];

/** Señales de contestador (castellano y portugués). Hacen falta dos. */
const SENALES_DE_CONTESTADOR = [
    // ausencia
    /\b(estoy|estamos|me encuentro|nos encontramos) (fuera|afuera|ausente|de vacaciones|de viaje)\b/,
    /\b(estou|estamos) (fora|ausente|de ferias|viajando)\b/,
    /\ben este momento no (puedo|podemos) (atender|responder|contestar)/,
    /\bno momento nao (posso|podemos) (atender|responder)/,
    /\b(fuera|fora) (del|de|do) horario (de atencion|comercial|de trabajo|laboral)\b/,
    /\b(nuestro|nosso) horario (de atencion|de atendimento) es\b/,
    // promesa de volver / responder
    /\b(regreso|vuelvo|retorno|estare de vuelta) (manana|el lunes|el martes|el miercoles|el jueves|el viernes|el sabado|el domingo|en breve|pronto|a la brevedad|el dia)\b/,
    /\b(retornarei|retornaremos|volto|voltarei) (amanha|em breve|logo|na segunda|assim que)/,
    /\bte (respondere|responderemos|contestare|contestaremos|escribire|escribiremos) (a la brevedad|lo antes posible|cuanto antes|en breve|apenas pueda|apenas podamos|pronto|manana)/,
    /\b(responderei|responderemos) (assim que possivel|em breve|o mais breve)/,
    // bienvenida de comercio
    /\bgracias por (comunicarte|contactarte|contactarnos|escribirnos|tu mensaje|su mensaje|elegirnos)\b/,
    /\bobrigad[oa] (por (entrar em contato|sua mensagem|seu contato|nos contatar))\b/,
    /\b(bienvenid[oa]s? a|bem[- ]vind[oa]s? a)\b/,
    /\ben (que|como) (te |le )?(podemos|puedo) ayudar(te|le)?\b/,
    /\bcomo (podemos|posso) (te )?ajudar\b/,
];

/**
 * Lo que nos escriben de verdad: algo de lo que vendemos. Si aparece, es una
 * consulta aunque el resto suene a contestador.
 */
const HABLA_DE_LO_NUESTRO = [
    /\b(anteojo|anteojos|lente|lentes|receta|armazon|armazones|cristal|cristales|clip|multifocal|precio|precios|cuanto|cuotas|turno|local|optica|graduacion|presupuesto|oculos|receita)\b/,
];

function esContestadorDelCliente(texto) {
    const t = normalizar(texto);
    if (!t) return false;
    if (HABLA_DE_LO_NUESTRO.some(r => r.test(t))) return false;
    if (DECLARA_AUTOMATICO.some(r => r.test(t))) return true;
    const senales = SENALES_DE_CONTESTADOR.filter(r => r.test(t)).length;
    // Una pregunta suele ser de una persona ("estoy fuera, regreso mañana,
    // ¿puedo pasar el lunes?"); pero las bienvenidas de comercio también
    // preguntan ("¿en qué podemos ayudarte?"). Con pregunta se exige una
    // señal más.
    const minimo = /\?/.test(t) ? 3 : 2;
    return senales >= minimo;
}

// ── Reacciones escritas ─────────────────────────────────────────────────────

/** Solo emojis / signos, sin una letra. */
function soloEmojis(texto) {
    const t = String(texto || '').trim();
    return Boolean(t) && !/[\p{L}\p{N}]/u.test(t);
}

/**
 * Un cierre de charla: "gracias", "bueno gracias", "muchas gracias!!", "ok
 * gracias 😊". Tiene que estar el agradecimiento: "ok" o "dale" solos pueden
 * ser el SÍ a una pregunta nuestra ("¿te mando fotos?" → "dale"), y eso es
 * una consulta.
 */
const CIERRE_CON_GRACIAS = /^(?:(?:bueno|buenisimo|genial|perfecto|ok|okey|oka|dale|listo|joya|barbaro|excelente|ah|aa+h?|si|bien)[\s,.!]*)*(?:muchas |mil |muchisimas )?gracias(?: a vos| a ustedes| igual| por todo| por la info(?:rmacion)?| por responder)?(?:[\s,.!]*(?:saludos|besos|abrazo|que tengas buen dia|buen dia|buenas tardes|buenas noches))?[\s,.!]*$/;

function esCierreConGracias(texto) {
    const t = normalizar(String(texto || '').replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️]/gu, ' '));
    return Boolean(t) && CIERRE_CON_GRACIAS.test(t);
}

/**
 * @param {object} msg  entrante normalizado ({ type, text|body, reaction })
 * @param {object} [contexto]
 * @param {boolean} [contexto.ultimoNuestroPregunta]  nuestro último saliente terminó en pregunta:
 *        un emoji solo puede ser la respuesta ("¿te mando fotos?" → "👍").
 * @returns {'consulta'|'reaccion'|'auto_nuestro'|'auto_del_cliente'}
 */
function clasificarEntrante(msg, contexto = {}) {
    if (!msg) return CLASE.REACCION;
    if (msg.reaction) return CLASE.REACCION;
    // Sin `type` se asume texto: los transportes viejos no lo mandaban, y
    // callar por una duda de forma es peor que contestar de más.
    const tipo = msg.type ? String(msg.type).toLowerCase() : 'text';
    if (TIPOS_REACCION.has(tipo)) return CLASE.REACCION;
    if (!TIPOS_CON_CONSULTA.has(tipo)) return CLASE.REACCION;

    const texto = String(msg.text ?? msg.body ?? '');
    if (tipo !== 'text') return CLASE.CONSULTA; // una foto, un audio, un documento: siempre consulta
    if (/^\[reacci[oó]n\]/i.test(texto.trim())) return CLASE.REACCION;
    if (!texto.trim()) return CLASE.REACCION;

    // Primero el contestador del cliente: los patrones de nuestra bienvenida
    // ("gracias por escribir…") también aparecen en los de otros comercios.
    // Para el turno da igual (ninguno dispara), pero el log dice la verdad.
    if (esContestadorDelCliente(texto)) return CLASE.AUTO_DEL_CLIENTE;
    if (isMetaAutoReplyText(texto)) return CLASE.AUTO_NUESTRO;

    if (soloEmojis(texto)) return contexto.ultimoNuestroPregunta ? CLASE.CONSULTA : CLASE.REACCION;
    if (esCierreConGracias(texto)) return CLASE.REACCION;
    return CLASE.CONSULTA;
}

/** `true` si el entrante tiene que disparar un turno del bot. */
function disparaTurno(clase) {
    return clase === CLASE.CONSULTA;
}

module.exports = { CLASE, clasificarEntrante, disparaTurno, esContestadorDelCliente, esCierreConGracias };
