'use strict';

/**
 * Saneador de lo que el bot le manda al cliente.
 *
 * POR QUÉ existe: el pipeline le mete al modelo marcadores internos por todos
 * lados — `[INSTRUCCIÓN INTERNA]` cuando una tool devuelve un error de negocio
 * (graph.js), `📍 [HITO]` para las notas del CRM (los prompts se lo enseñan),
 * el sello de hora `[09:33]` que prefija CADA mensaje del historial, y los
 * placeholders del prompt (`[DATOS_CLIENTE]`, `[HORA_ACTUAL]`, `[nombre]`…).
 * Un LLM repite los prefijos que ve. La salida, en cambio, solo limpiaba
 * `[IMAGE: url]`: TODO el resto viajaba tal cual a WhatsApp, y el cliente leía
 * cosas como "[INSTRUCCIÓN INTERNA] Error al ejecutar la herramienta".
 *
 * QUIÉN LO LLAMA (10/10/2026): nadie a mano. Lo usan dos lugares y nada más:
 *   - `shared/punto-de-salida.js`, que corre en CADA envío con origen 'llm'
 *     (los dos transportes lo tienen adentro);
 *   - `shared/respuesta-del-turno.js`, que arma las burbujas del turno del bot.
 * `npm run check:envios-bot` falla si alguien más lo importa.
 *
 * CÓMO TRABAJA (10/10/2026, tras la auditoría):
 *   - Sobre una LISTA DE BLOQUES (= burbujas), de punta a punta. Antes cada
 *     paso recibía un string y lo volvía a partir: `quitarRepeticiones`
 *     aplastaba los `\n\n` y la respuesta entera salía en una sola burbuja.
 *   - Lo que se saca se saca por ORACIÓN ENTERA, y la oración la decide
 *     `partir-oraciones.js`, que no parte precios ni links. La regex vieja
 *     (`[^.!?\n]*X[^.!?\n]*[.!?]*`) dejaba "$185." de un "$185.000".
 *   - Lo que no tiene arreglo (anotaciones del historial, otro idioma) no se
 *     recorta: se RECHAZA la respuesta entera (`rechazo`).
 *   - La derivación ya no se reemplaza acá por una promesa: se informa
 *     (`derivo`, `promete`) y decide el turno, que sabe si de verdad corrió una
 *     herramienta que deje una tarea (ver `respuesta-del-turno.js`).
 *
 * REGLA: `[IMAGE: url]` NO se toca — lo consume el que arma las burbujas.
 * Y es IDEMPOTENTE: sanear dos veces da lo mismo que una (el punto de salida
 * vuelve a pasar cada burbuja ya saneada; el check lo verifica).
 */

const { oraciones, quitarOraciones, llevaDato } = require('./partir-oraciones');
const { detectarIdioma } = require('./idioma');

/**
 * Relleno cosmético ("ahí te paso", "un momentito"). Se saca la oración, SALVO
 * que lleve un precio, un link o una foto: perder el relleno no le cuesta nada
 * a nadie; perder "$185.000" sí.
 */
const FRASES_DE_RELLENO = [
    'dame un segundito', 'esperame que busco', 'ahí te paso',
    'dejame verificar', 'te calculo los precios', 'ahí te busco',
    'dejame chequear', 'ya te busco', 'un momentito',
    'estoy revisando', 'estoy consultando', 'estoy verificando',
    'dejame revisar', 'aguardame un momento',
];

/**
 * Narración del sistema. Estas están TAMBIÉN en el guardrail
 * (`guardrail-salida.js`), que no borra: descarta el mensaje entero. Por eso
 * acá la oración se va SIEMPRE, lleve lo que lleve — si quedara, el guardrail
 * tiraría la respuesta completa.
 */
const NARRACION_DEL_SISTEMA = [
    'reviso en el sistema', 'consulto en el sistema', 'verifico en el sistema',
    'busco en el sistema', 'en el sistema veo', 'en el sistema figura',
    'según nuestros registros', 'segun nuestros registros',
];

/**
 * DERIVACIÓN — regla estricta de Ishtar (10/9/2026): el bot NUNCA le dice al
 * cliente que lo deriva, que lo pasa con alguien, ni que lo va a atender
 * "alguien del equipo".
 *
 * 10/10/2026: se sacaron `/\bdel equipo\b/` y `/\bcon el equipo\b/` sueltos.
 * Eran tan amplios que "lo hacemos con el equipo de laboratorio" o "el armazón
 * del equipo de Ray-Ban" contaban como derivar. Ahora cada patrón exige el
 * VERBO de la derivación.
 */
const FRASES_DE_DERIVACION = [
    /\bte deriv/i, /\bderiv(?:o|amos|arte|arlo|arla)\b/i,
    /\bte paso (?:con|a) (?:alguien|una persona|otra persona|un compa|una compa|un asesor|una asesora|el equipo|mis? compa)/i,
    /\balguien del equipo\b/i,
    /\b(?:lo|la|te) (?:veo|vea|consulto|consulte|charlo|hablo|chequeo|reviso) con (?:el|mi) equipo\b/i,
    /\bel equipo (?:te|se) (?:va a )?(?:contactar|contacta|escribir|escribe|responder|responde|llamar|llama|atender|atiende|comunica)/i,
    /\b(?:le|les) (?:paso|aviso|consulto) (?:a|al) (?:mis? )?(?:equipo|compañer[oa]s?|compa[ñn]er[oa]s?|asesor)/i,
    /\bte va(?:n)? a (?:atender|responder|contactar|escribir|llamar) (?:alguien|una persona|otra persona|un asesor|una asesora|el equipo)/i,
    /\bun (?:asesor|humano|agente|compañero|compa[ñn]ero) (?:te|va)\b/i,
];

/**
 * La frase aprobada para apartarse. La pone el CÓDIGO (respuesta-del-turno.js)
 * y solo cuando hay detrás una tarea real.
 */
const FRASE_EN_VEZ_DE_DERIVAR = 'Lo confirmo y te escribo en un ratito 😊';

/**
 * Una promesa de volver a escribir. Si nadie quedó encargado (no corrió
 * create_task / pedir_ayuda / report_complaint), es una promesa que nadie va a
 * cumplir: el turno crea la tarea desde el código.
 */
const PROMESA_DE_VOLVER = /\b(?:lo confirmo|te (?:escribo|confirmo|aviso|respondo|contesto|cuento))\b[^.!?\n]{0,40}\b(?:en un rat(?:o|ito)|enseguida|más tarde|mas tarde|en breve|a la brevedad|al toque|ahora te)\b/i;

/** Marcadores que, si aparecen, se llevan la LÍNEA entera: lo que sigue es interno. */
const MARCADORES_DE_LINEA = [
    /^\s*.{0,3}\[\s*INSTRUCCI[ÓO]N\s+INTERNA\s*\]/i,
    /^\s*.{0,3}\[\s*HITO\s*\]/i,
    // Ecos del historial que se le inyecta al modelo entre corchetes.
    /^\s*\[\s*(?:El cliente|Imagen adjunta|Mensaje vacío|Mensaje vacio|Media)\b/i,
];

/**
 * Placeholders del prompt y marcadores sueltos. Un token TODO-MAYÚSCULAS entre
 * corchetes nunca es texto que le escribiríamos a un cliente; `IMAGE` es la
 * única excepción y va explícita. Se saca el TOKEN, no la oración.
 */
const TOKEN_INTERNO = /\[(?!IMAGE\s*:)\s*(?:[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9_]*(?:[ _][A-ZÁÉÍÓÚÑ0-9_]+)*|nombre|telefono|teléfono)\s*(?::[^\]]*)?\]/g;

/**
 * Sello de fecha/hora del historial, al principio de una línea.
 *
 * OJO CON EL FORMATO: `bot-cloud.js` no prefija `[09:33]` sino lo que devuelve
 * `Intl.DateTimeFormat('es-AR', {weekday, month, day, hour, minute})`, o sea
 * `[mié, 2 sept, 09:19 a. m.]`. La primera versión de esta regex exigía que el
 * corchete arrancara con dígitos y se le escapaban todos: 17 mensajes salieron
 * al cliente con la fecha pegada adelante. Se matchea cualquier corchete al
 * principio de línea que contenga una HORA (`\d{1,2}:\d{2}`).
 */
const SELLO_DE_HORA = /^\s*\[[^\]\n]*\d{1,2}:\d{2}[^\]\n]*\]\s*/gm;

/**
 * Autoidentificación como automático. PROHIBIDO decirlo (decisión de Ishtar,
 * 5/9/2026, que reemplaza a la del 31/8 en la que el bot lo aclaraba solo).
 *
 * POR QUÉ SE LIMPIA ACÁ Y NO EN EL GUARDRAIL: el guardrail no borra, DESCARTA
 * el mensaje entero y encima apaga el bot en ese chat. Hasta el 31/8 estas
 * mismas palabras estaban ahí y el resultado era que a un "sos un bot?" el
 * cliente no recibía NADA, nunca más. Acá se saca la ORACIÓN y el resto del
 * mensaje sale igual: el cliente siempre recibe una respuesta.
 */
const FRASES_DE_IDENTIDAD = [
    /\b(?:soy|sos)\s+(?:un|una|el|la)?\s*(?:asistente\s+(?:automátic[oa]|virtual)|bot\b|chatbot|robot|ia\b|inteligencia\s+artificial)/i,
    /\bno\s+soy\s+(?:un[ao]?\s+)?(?:human[ao]|persona\s+real|persona)\b/i,
    /\b(?:soy|es)\s+una?\s+respuesta\s+autom[áa]tica\b/i,
    /\bestoy\s+programad[oa]\b/i,
    /\bcomo\s+(?:modelo\s+de\s+lenguaje|asistente\s+de\s+i\.?a\.?)\b/i,
    /\bmensaje\s+autom[áa]tico\b/i,
];

/**
 * Si al sacar la autoidentificación no queda NADA, no se puede mandar silencio:
 * la pregunta "sos un bot?" merece respuesta. Sale esta línea, que atiende sin
 * anunciar nada.
 */
const RESPUESTA_SIN_IDENTIDAD = 'Te estoy ayudando desde la óptica 😊 Contame qué necesitás y lo vemos.';

/**
 * Razonamiento interno en castellano: habla DEL cliente, no CON el cliente
 * ("El cliente agradeció", 21/9/2026). El razonamiento EN INGLÉS no se busca
 * acá: lo agarra `idioma.js` sobre la respuesta entera y la rechaza.
 */
const RAZONAMIENTO_INTERNO = [
    /\b(?:el|la) (?:cliente|usuari[oa]) (?:ya |me )?(?:agradeci[óo]|dijo|respondi[óo]|confirm[óo]|pregunt[óo]|escribi[óo]|mand[óo]|envi[óo]|est[áa]|quiere|no requiere)/i,
    /\bseg[úu]n (?:las|mis) instrucciones\b/i,
    /\b(?:no debo|no deber[íi]a) (?:responder|contestar|escribir)/i,
    /\bmi (?:[úu]ltimo|pr[óo]ximo) (?:mensaje|turno)\b/i,
];

/**
 * Anotaciones que el pipeline le pone al HISTORIAL entre corchetes (bot-cloud.js
 * `armarHistorial`). El 8 y el 9/10 el modelo las copió y el cliente recibió
 * "Respetá lo que ya dijo y no lo repitas.] Hola Juanma buen dia!…" — incluso
 * sin el corchete de apertura. Una anotación en la salida significa que el
 * modelo está regurgitando la charla (el 8/10 reenvió 7 mensajes de Mile):
 * no se rescata nada, se RECHAZA la respuesta.
 */
const CLAVES_DE_ANOTACION = String.raw`(?:Lo escribi[óo]|NO vos|Respet[áa] lo que ya dijo|no lo repitas|Imagen adjunta|Mensaje del cliente|El cliente (?:adjunt[óo]|envi[óo])|audio transcrito|Texto que la acompa[ñn]aba|del equipo de la [óo]ptica)`;
const ANOTACION_CERRADA = new RegExp(String.raw`\[?[^\[\]\n]*${CLAVES_DE_ANOTACION}[^\[\]\n]*\]`, 'i');
const ANOTACION_ABIERTA = new RegExp(String.raw`\[[^\]\n]*${CLAVES_DE_ANOTACION}[^\]\n]*$`, 'im');

/** Placeholders en minúscula que el modelo dejó sin completar ("desde [precio]"). */
const PLACEHOLDER_MINUSCULA = /\[\s*(?:precio|monto|importe|fecha|hora|link|url|direcci[óo]n|cliente|nombre del cliente|producto|modelo)\s*\]/i;

/**
 * Listas de patrones que se usan con `.test()`. NINGUNA puede llevar la bandera
 * `g`: con `g`, `.test()` recuerda `lastIndex` entre llamadas y la SEGUNDA
 * vez que se prueba el mismo patrón empieza a buscar por la mitad — un filtro
 * que funciona un mensaje sí y otro no. Se exporta para que el check lo mire.
 */
const PATRONES_CON_TEST = {
    FRASES_DE_DERIVACION, MARCADORES_DE_LINEA, FRASES_DE_IDENTIDAD, RAZONAMIENTO_INTERNO,
    ANOTACION_CERRADA: [ANOTACION_CERRADA], ANOTACION_ABIERTA: [ANOTACION_ABIERTA],
    PLACEHOLDER_MINUSCULA: [PLACEHOLDER_MINUSCULA], PROMESA_DE_VOLVER: [PROMESA_DE_VOLVER],
};

const incluyeAlguna = (o, frases) => { const l = o.toLowerCase(); return frases.some(f => l.includes(f)); };

/** Entrada → lista de bloques. Acepta un string o un array de mensajes. */
function aBloques(entrada) {
    const lista = Array.isArray(entrada) ? entrada : [entrada];
    return lista
        .map(x => String(x ?? ''))
        .flatMap(x => x.split(/\n[ \t]*\n+/))
        .map(b => b.replace(/\r/g, ''));
}

/**
 * Sanea la salida del modelo.
 *
 * @param {string|string[]} entrada  texto crudo, o los `mensajes` de `responder_al_cliente`
 * @param {{ textoParaIdioma?: string }} [opciones]  la respuesta entera, si `entrada` es una sola burbuja
 * @returns {{
 *   bloques: string[],               // una entrada por burbuja, ya limpias
 *   quitado: string[],               // qué se sacó (para el log)
 *   rechazo: null | { tipo: 'anotacion'|'idioma', motivo: string },
 *   derivo: boolean,                 // se sacó una frase de derivación
 *   promete: boolean,                // promete volver a escribir
 * }}
 */
function sanearBloques(entrada, { textoParaIdioma } = {}) {
    const quitado = [];
    const sinRechazo = (bloques, extra = {}) => ({ bloques, quitado, rechazo: null, derivo: false, promete: false, ...extra });

    // Los signos de apertura se sacan por regla de estilo (tono humano en AR).
    let bloques = aBloques(entrada).map(b => b.replace(/¿/g, '').replace(/¡/g, ''));
    const todo = bloques.join('\n\n');
    if (!todo.trim()) return sinRechazo([]);

    // ── Lo que no tiene arreglo: se rechaza entero ──────────────────────────
    if (ANOTACION_CERRADA.test(todo) || ANOTACION_ABIERTA.test(todo)) {
        return { bloques: [], quitado: ['anotación del historial'], rechazo: { tipo: 'anotacion', motivo: 'copió una anotación del historial' }, derivo: false, promete: false };
    }
    // El idioma se juzga sobre la respuesta ENTERA (15/10/2026): el punto de
    // salida vuelve a sanear cada burbuja suelta, y una burbuja corta ("Ray-Ban
    // Clubmaster, Round Metal") podía parecer inglés por sí sola y caerse a
    // mitad de una respuesta castellana. Quien sanea una burbuja pasa el texto
    // completo en `textoParaIdioma`.
    const idioma = detectarIdioma(textoParaIdioma && String(textoParaIdioma).trim() ? String(textoParaIdioma) : todo);
    if (idioma.idioma !== 'es') {
        return { bloques: [], quitado: [`respuesta en ${idioma.idioma}`], rechazo: { tipo: 'idioma', motivo: `no está en castellano (${idioma.idioma}: en=${idioma.en} es=${idioma.es} pt=${idioma.pt})` }, derivo: false, promete: false };
    }

    // ── Por línea: marcadores internos y sellos de hora ─────────────────────
    bloques = bloques.map(b => {
        const lineas = b.split('\n').filter(l => {
            if (MARCADORES_DE_LINEA.some(re => re.test(l))) { quitado.push('marcador interno (línea completa)'); return false; }
            return true;
        });
        let t = lineas.join('\n');
        SELLO_DE_HORA.lastIndex = 0;
        if (SELLO_DE_HORA.test(t)) { quitado.push('sello de hora del historial'); SELLO_DE_HORA.lastIndex = 0; t = t.replace(SELLO_DE_HORA, ''); }
        // Un "[PRECIO]" sin completar NO se saca como token: quedaría "desde ."
        // con la oración rota. Lo deja pasar para que se vaya la oración entera.
        t = t.replace(TOKEN_INTERNO, (m) => {
            if (PLACEHOLDER_MINUSCULA.test(m)) return m;
            quitado.push('placeholder del prompt');
            return '';
        });
        return t;
    });

    // ── Por oración (entera, nunca a la mitad) ──────────────────────────────
    let derivo = false;
    let identidad = false;
    bloques = bloques.map(b => quitarOraciones(b, (o) => {
        if (PLACEHOLDER_MINUSCULA.test(o)) { quitado.push('placeholder sin completar (oración)'); return true; }
        if (RAZONAMIENTO_INTERNO.some(re => re.test(o))) { quitado.push('razonamiento interno (oración)'); return true; }
        if (FRASES_DE_DERIVACION.some(re => re.test(o))) { derivo = true; quitado.push('frase de derivación (oración)'); return true; }
        if (FRASES_DE_IDENTIDAD.some(re => re.test(o))) { identidad = true; quitado.push('autoidentificación como automático'); return true; }
        if (incluyeAlguna(o, NARRACION_DEL_SISTEMA)) { quitado.push('narración del sistema (oración)'); return true; }
        if (incluyeAlguna(o, FRASES_DE_RELLENO) && !llevaDato(o)) { quitado.push('relleno (oración)'); return true; }
        return false;
    }).bloque);

    // Normalizar lo que dejaron los borrados, SIN tocar la estructura: espacios
    // dobles y colgando, y líneas vacías de más DENTRO de un bloque.
    bloques = bloques
        .map(b => b.split('\n').map(l => l.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/, '')).join('\n').replace(/\n{2,}/g, '\n').trim())
        .filter(b => b.replace(/[\s.,!?:;–—-]/g, '') !== '');

    // Sacar la identidad puede dejar un resto inservible ("Hola!"). Con muy
    // poco texto útil se repone una línea que atiende de verdad.
    if (identidad) {
        const util = bloques.join('').replace(/[\s.,!?:;–—-]/g, '');
        if (util.length < 18) {
            bloques.push(RESPUESTA_SIN_IDENTIDAD);
            quitado.push('(se repuso una respuesta, para no dejar al cliente con un saludo suelto)');
        }
    }

    const promete = bloques.some(b => PROMESA_DE_VOLVER.test(b));
    return { bloques, quitado: [...new Set(quitado)], rechazo: null, derivo, promete };
}

/**
 * Versión de texto (string → string), para lo que todavía trabaja con texto
 * plano (scripts de evaluación, checks). Un rechazo devuelve texto vacío.
 */
function limpiarSalidaBot(crudo) {
    const r = sanearBloques(crudo);
    return { texto: r.rechazo ? '' : r.bloques.join('\n\n'), quitado: r.rechazo ? [...r.quitado, `RECHAZADA: ${r.rechazo.motivo}`] : r.quitado };
}

/** Compatibilidad: true si la línea, sola, no está en castellano. */
function esLineaEnIngles(linea) {
    return detectarIdioma(linea).idioma === 'en';
}


// ─────────────────────────────────────────────────────────────────────────────
// Repetirse.
//
// El bot volvía a decir lo que ya había dicho un minuto antes, con otras
// palabras. El 5/9 se despidió con "Cuando tengas tu receta o quieras venir a
// probarte los armazones, te esperamos en el local" y, al toque, con "Cuando
// tengas tu recetita o quieras ver los armazones, aquí estamos". Para una
// persona es la MISMA frase; para una comparación literal, dos textos distintos.
// Acá se compara por palabras con peso, que es lo que hace que dos frases se
// sientan iguales aunque cambien los diminutivos y el orden.
// ─────────────────────────────────────────────────────────────────────────────

/** Palabras vacías: no aportan a decidir si dos frases dicen lo mismo. */
const VACIAS = new Set(['de','la','el','los','las','un','una','unos','unas','y','o','a','en','que','con','por','para','del','al','se','su','tu','es','lo','te','me','si','ya','mas','más','pero','como','cuando','donde','muy','ni','no','sos','soy']);

/** Minúsculas, sin acentos ni puntuación: "recetita" y "receta" siguen distintas, pero "Receta." y "receta" no. */
function normalizar(t) {
    return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Raíz aproximada: aplasta diminutivos y plurales ("recetita"/"recetas" → "recet"). */
function raiz(palabra) {
    // El recorte va DESPUÉS de sacar el sufijo y es corto a propósito: si no,
    // "recetita" quedaba en "recet" y "receta" en "receta", o sea distintas.
    return palabra.replace(/(cita|cito|itas|itos|ita|ito|ciones|cion|es|s)$/, '').slice(0, 5);
}

function palabrasClave(frase) {
    return new Set(normalizar(frase).split(' ').filter(p => p.length > 2 && !VACIAS.has(p)).map(raiz));
}

/**
 * Qué parte de la frase NUEVA ya está dicha en la vieja, 0 a 1. Es contención,
 * no Jaccard: la pregunta es "¿esto que voy a decir ya lo dije?".
 */
function yaEstaDicho(nueva, vieja) {
    const A = palabrasClave(nueva); const B = palabrasClave(vieja);
    if (!A.size || !B.size) return 0;
    let comunes = 0;
    for (const p of A) if (B.has(p)) comunes++;
    return comunes / A.size;
}

/**
 * Umbral DELIBERADAMENTE alto. Lo que se borra acá no se puede recuperar, y
 * entre "el bot se despidió dos veces" y "el bot se comió el precio", lo caro
 * es lo segundo.
 */
const UMBRAL_PARECIDO = 0.75;

/**
 * Saca las oraciones que ya se dijeron en los mensajes previos.
 *
 * Trabaja sobre BLOQUES y los devuelve como bloques (10/10/2026): la versión
 * anterior recibía un string, lo partía por `\n`, descartaba las líneas vacías
 * y lo volvía a unir con `\n` — o sea, convertía cada `\n\n` en `\n`. Como las
 * burbujas se separan por `\n\n`, después de este paso TODA la respuesta salía
 * en una sola burbuja (y `limitarEmojis` le dejaba un solo emoji).
 *
 * @param {string[]|string} bloques
 * @param {string[]} mensajesPreviosDelBot
 * @returns {{ bloques: string[], texto: string, quitadas: string[] }}
 */
function quitarRepeticiones(bloques, mensajesPreviosDelBot = []) {
    const lista = Array.isArray(bloques) ? bloques : aBloques(bloques);
    const previos = (mensajesPreviosDelBot || []).map(String).filter(Boolean);
    if (!previos.length) return { bloques: lista, texto: lista.join('\n\n'), quitadas: [] };
    const previosNorm = previos.map(normalizar);

    const quitadas = [];
    const salida = lista.map(b => {
        // Un precio o un link no se borran por "repetidos": el cliente puede
        // necesitarlo de nuevo, y es lo único caro de perder.
        const r = quitarOraciones(b, (o) => {
            if (normalizar(o).length < 25 || llevaDato(o)) return false;
            const n = normalizar(o);
            return previos.some((p, i) => previosNorm[i].includes(n) || yaEstaDicho(o, p) >= UMBRAL_PARECIDO);
        });
        quitadas.push(...r.quitadas);
        return r.bloque.trim();
    }).filter(b => b !== '');
    return { bloques: salida, texto: salida.join('\n\n'), quitadas };
}


// ─────────────────────────────────────────────────────────────────────────────
// Escribir como escribe el equipo.
//
// Medido en producción (30 días, 341 mensajes del bot contra 4.820 del equipo):
//
//                        BOT    EQUIPO
//   largo mediano         129        31
//   % de 40 o menos        11%       57%
//   % con emoji            52%       19%
//
// Una regla de estilo en el prompt es una sugerencia; la que se cumple es la
// que está en el código.
// ─────────────────────────────────────────────────────────────────────────────

const EMOJI = /(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)/gu;

/** Deja como mucho UN emoji por burbuja: el primero. */
function limitarEmojis(texto) {
    let visto = false;
    return texto.replace(EMOJI, m => {
        if (visto) return '';
        visto = true;
        return m;
    }).replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+([,!?])/g, '$1').replace(/[ \t]+\.(?!\d)/g, '.').trim();
}

/**
 * ¿Este bloque tiene estructura que NO hay que partir? Los presupuestos, la
 * dirección con el mapa y las listas de opciones se leen mejor juntos.
 */
function tieneEstructura(bloque) {
    return /^\s*[•\-*]\s/m.test(bloque)
        || /\*\$[\d.]+\*/.test(bloque)
        || /\[IMAGE:/i.test(bloque)
        || /https?:\/\//.test(bloque)
        || (bloque.match(/\n/g) || []).length >= 2;
}

/** A partir de acá una burbuja de prosa se siente un párrafo, no un mensaje. */
const LARGO_MAXIMO_BURBUJA = 160;

/**
 * Parte un bloque largo de PROSA en varias burbujas, cortando por oración (con
 * el mismo divisor que protege precios y links). Nunca deja una burbuja
 * huérfana de menos de 25 caracteres: se la pega a la anterior.
 */
function partirEnBurbujas(bloque) {
    if (bloque.length <= LARGO_MAXIMO_BURBUJA || tieneEstructura(bloque) || bloque.includes('\n')) return [bloque];

    const os = oraciones(bloque);
    if (os.length < 2) return [bloque];

    const burbujas = [];
    let actual = '';
    for (const o of os) {
        if (!actual) { actual = o; continue; }
        if ((actual + ' ' + o).length <= LARGO_MAXIMO_BURBUJA) actual += ' ' + o;
        else { burbujas.push(actual); actual = o; }
    }
    if (actual) {
        if (actual.length < 25 && burbujas.length) burbujas[burbujas.length - 1] += ' ' + actual;
        else burbujas.push(actual);
    }
    return burbujas;
}

module.exports = {
    sanearBloques, limpiarSalidaBot, quitarRepeticiones, limitarEmojis, partirEnBurbujas,
    FRASES_DE_RELLENO, NARRACION_DEL_SISTEMA, FRASES_DE_IDENTIDAD, FRASE_EN_VEZ_DE_DERIVAR,
    PATRONES_CON_TEST, esLineaEnIngles,
};
