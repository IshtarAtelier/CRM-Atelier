'use strict';

/**
 * Qué es un mensaje ENTRANTE, en una sola definición para el bot cloud
 * (`bot-cloud.js`), el transporte legacy (`index.js`) y el auto-respondedor:
 *
 *   'consulta'         — lo escribió una persona y merece respuesta.
 *   'reaccion'         — una reacción, un sticker, un "gracias" de cierre o
 *                        solo emojis: se guarda, no dispara turno.
 *   'auto_nuestro'     — un mensaje NUESTRO que volvió por el camino de los
 *                        entrantes (eco con `fromMe`). Se decide por el
 *                        METADATO del mensaje, nunca por el texto (ver abajo).
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
 * trabajando. Regreso mañana" es un contestador. Primero las guardas que lo
 * devuelven a 'consulta' (habla de lo nuestro, dice que quiere algo o que va a
 * pasar), después: o el mensaje DECLARA ser automático, o junta dos señales
 * (ausencia, regreso, promesa de responder, horario, bienvenida). Ante la
 * duda, se contesta — callar a un cliente real es el error caro.
 *
 * Auditoría del 15/10/2026, dos clientes reales que se callaban:
 *   - "Gracias por tu mensaje! quería saber cuánto salen" salía 'auto_nuestro'
 *     porque el texto se parecía a NUESTRA bienvenida de Meta. Pero un
 *     ENTRANTE nunca es nuestro: nuestros automáticos son salientes. Ahora
 *     'auto_nuestro' sale solo del metadato (`fromMe`), jamás del texto.
 *   - "Estoy de viaje, regreso el lunes y paso a buscarlos" juntaba dos
 *     señales ("estoy de viaje", "regreso el lunes") y salía contestador. Lo
 *     que lo delata como persona es lo que VA A HACER ("paso a buscarlos"):
 *     ahora esa guarda corre antes de contar señales (`HABLA_UNA_PERSONA`).
 *
 * Puro: sin base ni red. Lo fija `npm run check:entrantes`.
 */

const { TIPOS_CON_CONSULTA } = require('./tipos-entrantes');

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

/** Señales de AUSENCIA o de REGRESO (castellano y portugués). */
const SENALES_DE_AUSENCIA = [
    /\b(estoy|estamos|me encuentro|nos encontramos) (fuera|afuera|ausente|de vacaciones|de viaje)\b/,
    /\b(estou|estamos) (fora|ausente|de ferias|viajando)\b/,
    /\b(regreso|vuelvo|retorno|estare de vuelta) (manana|el lunes|el martes|el miercoles|el jueves|el viernes|el sabado|el domingo|en breve|pronto|a la brevedad|el dia)\b/,
    /\b(retornarei|retornaremos|volto|voltarei) (amanha|em breve|logo|na segunda|assim que)/,
];

/** Señales de COMERCIO: promete responder, informa su horario o da la bienvenida. */
const SENALES_DE_COMERCIO = [
    /\ben este momento no (puedo|podemos) (atender|responder|contestar)/,
    /\bno momento nao (posso|podemos) (atender|responder)/,
    /\b(fuera|fora) (del|de|do) horario (de atencion|comercial|de trabajo|laboral)\b/,
    /\b(nuestro|nosso) horario (de atencion|de atendimento) es\b/,
    /\bte (respondere|responderemos|contestare|contestaremos|escribire|escribiremos) (a la brevedad|lo antes posible|cuanto antes|en breve|apenas pueda|apenas podamos|pronto|manana)/,
    /\b(responderei|responderemos) (assim que possivel|em breve|o mais breve)/,
    /\bgracias por (comunicarte|contactarte|contactarnos|escribirnos|tu mensaje|su mensaje|elegirnos)\b/,
    /\bobrigad[oa] (por (entrar em contato|sua mensagem|seu contato|nos contatar))\b/,
    /\b(bienvenid[oa]s? a|bem[- ]vind[oa]s? a)\b/,
    /\ben (que|como) (te |le )?(podemos|puedo) ayudar(te|le)?\b/,
    /\bcomo (podemos|posso) (te )?ajudar\b/,
];

/**
 * Una persona diciendo lo que quiere o lo que va a hacer: "quería saber",
 * "paso a buscarlos", "necesito". Un contestador no habla así.
 */
const HABLA_UNA_PERSONA = [
    /\b(quiero|queria|quisiera|necesito|necesitaria|consulto|consultaba|preguntaba|queria saber)\b/,
    /\b(paso|pasare|voy a pasar|pasamos|paso a buscar|los busco|las busco|lo busco|la busco)\b/,
    /\b(buscar|retirar)(los|las|lo|la)?\b/,
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
    // Guardas primero: ante la duda, consulta.
    if (HABLA_DE_LO_NUESTRO.some(r => r.test(t))) return false;
    if (HABLA_UNA_PERSONA.some(r => r.test(t))) return false;
    if (DECLARA_AUTOMATICO.some(r => r.test(t))) return true;
    const senales = SENALES_DE_COMERCIO.filter(r => r.test(t)).length + SENALES_DE_AUSENCIA.filter(r => r.test(t)).length;
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
 * gracias 😊". Tiene que estar el agradecimiento, la despedida o el "te
 * aviso": "ok" o "dale" solos pueden ser el SÍ a una pregunta nuestra ("¿te
 * mando fotos?" → "dale"), y eso es una consulta.
 *
 * Reforzado el 15/10/2026 con los cierres reales que hacían volver al bot en
 * chats que atendía una persona (simulado contra prod: "gracias chicos!",
 * "Okis muchas gracias", "Graciasss", "Bueno, espero tu aviso. Saludos.",
 * "Vuelvo a analizar y te aviso", "Cualquier cosa me comunico. Muchas
 * gracias"): vocativos al final ("chicos", "che", "genia"), "okis", letras
 * estiradas, y el "te aviso" del que se va a pensarlo. El mensaje entero
 * tiene que estar hecho de estas piezas: "gracias, y cuánto sale?" sigue
 * siendo consulta.
 */
const PIEZAS_DE_CIERRE = [
    // muletillas de asentimiento
    /(?:bueno|buenisimo|genial|perfecto|ok|okey|oka|okis|okas|dale|listo|joya|barbaro|excelente|ah|aa+h?|si|bien|super|re|y)/.source,
    // el agradecimiento
    /(?:muchas |mil |muchisimas |muy )?gracias+(?: a vos| a ustedes| a todos| igual| por todo| por la info(?:rmacion)?| por responder| por (?:tu|su) (?:tiempo|ayuda|atencion|respuesta))?/.source,
    // vocativos
    /(?:chicos|chicas|chiques|che|genia|genio|genias|genios|capo|capa|crack|amigo|amiga|linda|lindo|querida|querido|bella)/.source,
    // despedidas
    /(?:saludos|saludo|besos|beso|abrazo|abrazos|que tengas (?:un )?buen dia|que tengas buena tarde|buen dia|buenas tardes|buenas noches|nos vemos|hasta luego|chau|slds)/.source,
    // "lo pienso y te aviso"
    /(?:quedo a la espera|espero (?:tu|su) (?:aviso|respuesta)|(?:te|les|le) aviso|(?:te|les|le) confirmo|cualquier cosa (?:te|les|le) (?:aviso|escribo|consulto)|cualquier cosa me comunico|vuelvo a analizar|lo (?:veo|pienso|analizo|charlo)|lo voy a pensar|voy a pensarlo|lo vemos)/.source,
];
const CIERRE_CON_GRACIAS = new RegExp(`^(?:(?:${PIEZAS_DE_CIERRE.join('|')})(?:[\\s,.!]+|$))+$`);
/** Lo que hace que sea un cierre y no un "sí": agradecer, despedirse o "te aviso". */
const NUCLEO_DE_CIERRE = new RegExp(`\\b(?:${PIEZAS_DE_CIERRE.slice(1, 2).concat(PIEZAS_DE_CIERRE.slice(3)).join('|')})\\b`);

/**
 * Una palabra sola que, sin pregunta nuestra pendiente, es un acuse y no una
 * consulta ("Veo", "Bueno", "Excelente"). Con una pregunta nuestra pendiente
 * puede ser el SÍ ("¿te reservo el martes?" → "bueno"): ahí es consulta,
 * igual que un emoji solo.
 */
const ACUSE_SUELTO = /^(?:bueno|veo|lo veo|ya veo|excelente|genial|perfecto|buenisimo|joya|barbaro|ah bueno|ok bueno|okis|oki)[\s,.!]*$/;

/** Junta las letras estiradas: "Graciasss" → "gracias", "buenooo" → "bueno". */
function sinLetrasEstiradas(t) {
    return t.replace(/([a-z])\1{2,}/g, '$1');
}

function textoDeCierre(texto) {
    return sinLetrasEstiradas(normalizar(String(texto || '').replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️]/gu, ' ')));
}

function esCierreConGracias(texto) {
    const t = textoDeCierre(texto);
    if (!t || /\?/.test(String(texto || ''))) return false;
    return CIERRE_CON_GRACIAS.test(t) && NUCLEO_DE_CIERRE.test(t);
}

function esAcuseSuelto(texto) {
    return ACUSE_SUELTO.test(textoDeCierre(texto));
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
    // Lo NUESTRO se reconoce por el metadato, no por el texto (15/10/2026): un
    // cliente que escribe "Gracias por tu mensaje! quería saber cuánto salen"
    // se parece a nuestra bienvenida y quedaba callado.
    if (msg.fromMe === true) return CLASE.AUTO_NUESTRO;
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

    if (esContestadorDelCliente(texto)) return CLASE.AUTO_DEL_CLIENTE;

    if (soloEmojis(texto)) return contexto.ultimoNuestroPregunta ? CLASE.CONSULTA : CLASE.REACCION;
    if (esCierreConGracias(texto)) return CLASE.REACCION;
    if (esAcuseSuelto(texto)) return contexto.ultimoNuestroPregunta ? CLASE.CONSULTA : CLASE.REACCION;
    return CLASE.CONSULTA;
}

/**
 * Una fila de `WhatsAppMessage` (INBOUND) en la forma que espera
 * `clasificarEntrante`. La usan los caminos que deciden desde la BASE y no
 * desde el webhook (el control "llegó algo nuevo durante el turno" y el
 * barrido de la vuelta del bot, 15/10/2026): tienen que contar lo mismo que
 * cuenta el webhook, o una reacción les vale como consulta.
 * `transport/inbound.js` guarda el sticker como IMAGE "[Sticker]", lo no
 * soportado como TEXT "[Mensaje no soportado]" y la reacción como TEXT
 * "[Reacción] 👍".
 *
 * @param {{ type?: string, content?: string }} fila
 */
function entranteDeFila(fila) {
    const contenido = String((fila && fila.content) || '');
    let tipo = String((fila && fila.type) || 'TEXT').toLowerCase();
    if (/^\[sticker\]/i.test(contenido.trim())) return { type: 'sticker', text: contenido };
    if (/^\[mensaje no soportado\]/i.test(contenido.trim())) return { type: 'unsupported', text: contenido };
    if (!TIPOS_CON_CONSULTA.has(tipo)) tipo = 'text';
    return { type: tipo, text: contenido };
}

/** ¿Esta fila entrante dispara un turno? (atajo de las dos de arriba) */
function filaDisparaTurno(fila, contexto) {
    return disparaTurno(clasificarEntrante(entranteDeFila(fila), contexto));
}

/** `true` si el entrante tiene que disparar un turno del bot. */
function disparaTurno(clase) {
    return clase === CLASE.CONSULTA;
}

module.exports = { CLASE, clasificarEntrante, disparaTurno, entranteDeFila, filaDisparaTurno, esContestadorDelCliente, esCierreConGracias, esAcuseSuelto };
