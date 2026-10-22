'use strict';

/**
 * En qué FASE está la charla, decidido por el CÓDIGO y no por el modelo.
 *
 * Requisito de Ishtar (10/10/2026): cuando entra un mensaje de un anuncio de
 * Meta o es el primer contacto, el bot saluda ("Hola Luciano, cómo estás?"),
 * pregunta qué está necesitando, después si tiene receta, después si va por
 * obra social — una charla amena que asesora, no una lista de precios.
 *
 * POR QUÉ en código (auditoría del 10/10/2026): estaba escrito como la regla
 * 10 de CORE_RULES y en MetaClip el 74% de los primeros turnos igual tiró un
 * precio. La regla tenía todo en contra en el MISMO prompt:
 *   - las herramientas de precio y fotos estaban disponibles;
 *   - el módulo 'productos' se disparaba por /clip/ y decía "ARMAZONES: Desde
 *     $100.000" (falso para clip-ons: van de $175.000 a $200.000) y "SÍ tenés
 *     fotos para mandarle";
 *   - el prompt vivo de la base dicta otro saludo literal;
 *   - la regla 3 decía "no te presentes: tu primer mensaje va directo a
 *     atender";
 *   - 23 de 293 chats de anuncio ya tenían mensajes nuestros y recibían el
 *     módulo `conversacion_en_curso` ("PROHIBIDO saludar") junto con la regla
 *     10 ("primer mensaje = saludo").
 * Una instrucción entre sesenta pierde contra todo eso. Ahora:
 *   1. `faseDeLaCharla()` decide la fase con la MISMA función que alimenta
 *      `conversacion_en_curso` (`mensajesNuestros`): no pueden contradecirse.
 *   2. En las fases de apertura el grafo corre SIN las herramientas de precio
 *      y fotos (`HERRAMIENTAS_FUERA_DE_LA_APERTURA`), sin los módulos que
 *      empujan a cotizar, y con UN solo bloque de saludo (`instruccionDeFase`).
 *   3. La salida de ese turno se valida (`validarSalidaDeApertura`): ni `$`,
 *      ni montos, ni [IMAGE:], ni links. Si el modelo igual los mete, sale el
 *      saludo de respaldo armado por el código (`saludoDeRespaldo`).
 *
 * Puro: sin base ni red. Lo fija `npm run check:primer-contacto`.
 */

const { isMetaAutoReplyText } = require('./meta-auto-patterns');
const { SENDER_NAME_AUTORESPONDEDOR } = require('./remitentes');

const FASE = Object.freeze({
    /** No hay ningún mensaje nuestro en el historial. */
    PRIMER_CONTACTO: 'primer_contacto',
    /** Ya hablamos antes, y ahora volvió por un anuncio de Meta. */
    ANUNCIO_CON_HISTORIA: 'anuncio_con_historia',
    /** Charla empezada: rige `conversacion_en_curso`. */
    EN_CURSO: 'en_curso',
});

/** Las fases en las que no se cotiza ni se mandan fotos. */
const FASES_DE_APERTURA = new Set([FASE.PRIMER_CONTACTO, FASE.ANUNCIO_CON_HISTORIA]);

/**
 * Herramientas que NO se le dan al modelo en la apertura. Las dos de precio y
 * fotos son las que importan; las de presupuesto, por coherencia (no se arma
 * un presupuesto sin saber qué necesita).
 */
const HERRAMIENTAS_FUERA_DE_LA_APERTURA = new Set([
    'get_price_list', 'send_product_photos', 'create_quote', 'send_quote_pdf',
]);

/** La marca de anuncio que viaja en el texto precargado ("[MetaClip]", "[metaRecetados]"…). */
const MARCA_DE_ANUNCIO = /\[meta[^\]]*\]/i;

// ── ¿Qué es "un mensaje nuestro"? ───────────────────────────────────────────

/** Un mensaje del historial que salió de nuestro lado (bot, vendedora o seguimiento). */
function esMensajeNuestro(m) {
    if (!m) return false;
    try {
        if (typeof m._getType === 'function') return m._getType() === 'ai';
    } catch {
        // Un mensaje raro no puede voltear el armado del prompt.
    }
    const tipo = m.role || m.type || (m.constructor && m.constructor.name) || '';
    return /^ai/i.test(String(tipo)) || String(tipo) === 'AIMessage';
}

/** Texto plano de un mensaje del historial (puede venir multimodal). */
function textoDeMensaje(m) {
    const content = m && m.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.filter(p => p && p.type === 'text' && p.text).map(p => p.text).join(' ');
    }
    return '';
}

/** Saca el sello de hora ("[mar, 4 ago, 21:26] ") y la firma del equipo del historial. */
function sinAnotaciones(texto) {
    return String(texto || '')
        .replace(/^\[[^\]]{5,40}\]\s*/, '')
        .replace(/^\[Lo escribió [^\]]+\]\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Una bienvenida AUTOMÁTICA nuestra (la de WhatsApp Business / Meta, o el
 * auto-respondedor de fuera de horario) no es "ya hablamos": nadie atendió
 * todavía, y el cliente merece su saludo.
 */
function esSaludoAutomatico(texto) {
    const t = sinAnotaciones(texto);
    return isMetaAutoReplyText(t) || /^bienvenid[oa]s? a atelier/i.test(t);
}

// ── "Ya hablamos", decidido por la FILA (15/10/2026) ───────────────────────
//
// Antes se juzgaba nuestro saliente por el TEXTO (`esSaludoAutomatico`): si el
// bot saludaba "Hola Ana, gracias por escribirnos! contame…", el patrón de la
// bienvenida de Meta lo tomaba por automático, el historial quedaba "sin nada
// nuestro" y el turno siguiente volvía a ser PRIMER_CONTACTO: saludo repetido
// y sin herramientas de precio. Quién escribió un saliente lo dice su firma
// (`senderName`, ver shared/remitentes.js), no lo que dice: cualquier saliente
// del Bot, de una persona, del sistema o de una campaña es "ya hablamos"; solo
// los dos contestadores automáticos cuentan como bienvenida.
//
// El juicio por texto queda SOLO como respaldo para quien arma el historial
// sin las filas (el transporte legacy `index.js`).

/** Firmas de los salientes que son una bienvenida automática (no "ya hablamos"). */
const REMITENTES_DE_BIENVENIDA_AUTOMATICA = Object.freeze([SENDER_NAME_AUTORESPONDEDOR, 'Meta (Auto-Reply)']);

function esBienvenidaAutomaticaPorRemitente(senderName) {
    return REMITENTES_DE_BIENVENIDA_AUTOMATICA.includes(String(senderName || '').trim());
}

/**
 * Lo que necesitan la fase y `conversacion_en_curso`, calculado de las filas
 * CRUDAS de la base.
 *
 * @param {Array<{ direction: string, senderName?: string|null, content?: string|null, createdAt?: Date|string }>} filas  en cualquier orden
 * @returns {{ yaHablamos: boolean, primerMensajeNuestro: string }}
 */
function historiaNuestra(filas) {
    const nuestras = (filas || [])
        .filter(f => f && f.direction === 'OUTBOUND' && !esBienvenidaAutomaticaPorRemitente(f.senderName))
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    if (!nuestras.length) return { yaHablamos: false, primerMensajeNuestro: '' };
    return { yaHablamos: true, primerMensajeNuestro: sinAnotaciones(nuestras[0].content || '').slice(0, 160) };
}

/** Los mensajes nuestros del historial que cuentan como "ya hablamos" (respaldo por texto). */
function mensajesNuestros(messages) {
    return (messages || []).filter(m => esMensajeNuestro(m) && !esSaludoAutomatico(textoDeMensaje(m)));
}

/** `true` si en el historial no hay ningún mensaje nuestro (salvo bienvenidas automáticas). */
function esPrimerContacto(messages) {
    return mensajesNuestros(messages).length === 0;
}

/**
 * ¿El cliente entró por un anuncio EN ESTE TURNO? Se mira en las filas crudas
 * de la base (antes de que el historial limpie la marca): algún entrante
 * posterior a nuestro último saliente trae la marca [metaXxx].
 *
 * @param {Array<{ direction: string, content?: string }>} filasRecientes  de la más nueva a la más vieja
 */
function entroPorAnuncio(filasRecientes) {
    for (const f of filasRecientes || []) {
        if (f.direction === 'OUTBOUND') return false;
        if (MARCA_DE_ANUNCIO.test(String(f.content || ''))) return true;
    }
    return false;
}

/**
 * @param {Array} messages  historial en formato LangChain
 * @param {{ entroPorAnuncio?: boolean, yaHablamos?: boolean }} [opciones]
 * @returns {'primer_contacto'|'anuncio_con_historia'|'en_curso'}
 */
function faseDeLaCharla(messages, { entroPorAnuncio: porAnuncio = false, yaHablamos } = {}) {
    // `yaHablamos` viene de `historiaNuestra(filas)` cuando quien llama tiene
    // las filas; el historial (por texto) es solo el respaldo.
    const primero = typeof yaHablamos === 'boolean' ? !yaHablamos : esPrimerContacto(messages);
    if (primero) return FASE.PRIMER_CONTACTO;
    if (porAnuncio) return FASE.ANUNCIO_CON_HISTORIA;
    return FASE.EN_CURSO;
}

function esApertura(fase) {
    return FASES_DE_APERTURA.has(fase);
}

// ── El bloque de instrucción (uno solo) ─────────────────────────────────────

/** El saludo exacto, armado por el código. */
function saludoDeRespaldo(fase, nombre) {
    const hola = nombre ? `Hola ${nombre}` : 'Hola';
    if (fase === FASE.ANUNCIO_CON_HISTORIA) return `${hola}, qué bueno que nos volviste a escribir 😊 contame qué estás necesitando`;
    return `${hola}, cómo estás? contame un poquito qué estás necesitando`;
}

/**
 * La ÚNICA instrucción de saludo del turno. Va al final del system prompt,
 * después de las reglas innegociables. En `en_curso` no hay bloque: rige el
 * módulo `conversacion_en_curso`.
 */
function instruccionDeFase(fase, nombre, { porAnuncio = false } = {}) {
    const nombreTxt = nombre ? `"${nombre}"` : 'NINGUNO (saludá sin nombre)';
    const sinPrecios = `  - En este mensaje NO van precios, montos, "desde $", listas de opciones, fotos ni links, aunque el anuncio sea de un producto puntual y aunque te pregunte el precio. Si lo preguntó, decile que se lo pasás enseguida y preguntale antes para qué lo quiere, así le recomendás bien.
  - En este turno no tenés herramientas de precios, fotos ni presupuestos: no las busques ni las prometas.
  - No te presentes ni digas un nombre propio.
  - Si mandó la foto de una receta, agradecésela en la misma burbuja y preguntá qué está buscando (anteojos para todos los días, de sol, para la compu…). Nunca le preguntes si son monofocales o multifocales.`;

    if (fase === FASE.PRIMER_CONTACTO) {
        return `

<fase_de_la_charla fase="primer_contacto">
  La fase la decide el sistema y MANDA sobre cualquier otra instrucción de saludo (también la del prompt principal).
  Es el PRIMER mensaje nuestro en esta charla. UNA sola burbuja: saludo + pregunta abierta, y nada más.
  - Nombre para saludar: ${nombreTxt}. Nunca uses otro (tampoco el de la receta: puede ser de otra persona).
  - Con nombre: "Hola Luciano, cómo estás? contame un poquito qué estás necesitando". Sin nombre: "Hola, cómo estás? contame un poquito qué estás necesitando".${porAnuncio ? `
  - Vino por un anuncio: podés nombrar lo que le interesó ("vi que te interesaron los clip-on") y preguntar para qué lo quiere.` : ''}
${sinPrecios}
  - Después de este mensaje, la charla sigue este orden: qué necesita y para qué → si tiene receta → si va por obra social. De a una pregunta.
</fase_de_la_charla>`;
    }
    if (fase === FASE.ANUNCIO_CON_HISTORIA) {
        return `

<fase_de_la_charla fase="anuncio_con_historia">
  La fase la decide el sistema y MANDA sobre cualquier otra instrucción de saludo (también la del prompt principal).
  Esta persona YA habló con nosotros (está en el historial) y ahora volvió a escribir desde un anuncio.
  - Saludo BREVE para retomar, sin presentarte y sin repetir la bienvenida de la primera vez. Nombre para saludar: ${nombreTxt}.
    Ejemplo: "Hola Luciano, qué bueno que nos volviste a escribir 😊" + una pregunta que RETOME lo que ya sabemos.
  - Leé el historial: si ya contó qué necesitaba, si ya mandó la receta o si dijo su obra social, NO lo vuelvas a preguntar — partí de ahí ("seguís buscando los anteojos para manejar?").
  - Lo que el equipo ya le dijo o le prometió en el historial sigue en pie: no lo contradigas ni lo repitas palabra por palabra.
${sinPrecios}
</fase_de_la_charla>`;
    }
    return '';
}

// ── Validación de la salida del turno de apertura ───────────────────────────

const PRECIO = /\$\s*\d|\b\d{1,3}(?:\.\d{3})+\b|\b\d+\s*(?:mil|lucas)\b|\bpesos\b/i;
const IMAGEN = /\[IMAGE:/i;
const LINK = /https?:\/\/|\bwww\.|\.com(?:\.ar)?\b|atelieroptica/i;

/**
 * ¿La respuesta del turno de apertura cumple? Rechaza precios, imágenes y links.
 * @param {string} texto
 * @returns {{ ok: boolean, motivo?: string }}
 */
function validarSalidaDeApertura(texto) {
    const t = String(texto || '');
    if (PRECIO.test(t)) return { ok: false, motivo: 'un precio en el saludo' };
    if (IMAGEN.test(t)) return { ok: false, motivo: 'una foto en el saludo' };
    if (LINK.test(t)) return { ok: false, motivo: 'un link en el saludo' };
    return { ok: true };
}

/**
 * Lo que `armarRespuesta` necesita para el turno de apertura, o null si la
 * fase no restringe nada.
 */
function restriccionDeFase(fase, nombre) {
    if (!esApertura(fase)) return null;
    return { fase, validar: validarSalidaDeApertura, respaldo: saludoDeRespaldo(fase, nombre) };
}

const CORRECCION_DE_APERTURA = 'AVISO DEL SISTEMA (no lo escribió el cliente): tu respuesta anterior NO se envió porque es el saludo de apertura y traía un precio, una foto o un link. Escribila de nuevo: solo saludo + una pregunta abierta sobre qué está necesitando, con responder_al_cliente. Sin precios, sin montos, sin fotos, sin links.';

module.exports = {
    FASE,
    FASES_DE_APERTURA,
    HERRAMIENTAS_FUERA_DE_LA_APERTURA,
    MARCA_DE_ANUNCIO,
    CORRECCION_DE_APERTURA,
    esMensajeNuestro,
    textoDeMensaje,
    sinAnotaciones,
    esSaludoAutomatico,
    REMITENTES_DE_BIENVENIDA_AUTOMATICA,
    esBienvenidaAutomaticaPorRemitente,
    historiaNuestra,
    mensajesNuestros,
    esPrimerContacto,
    entroPorAnuncio,
    faseDeLaCharla,
    esApertura,
    instruccionDeFase,
    saludoDeRespaldo,
    validarSalidaDeApertura,
    restriccionDeFase,
};
