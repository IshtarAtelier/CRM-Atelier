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
 * Es el ÚNICO lugar donde se limpia la salida: lo usan los dos bots
 * (`bot-cloud.js` para la Cloud API y `index.js` para Baileys), que hasta ahora
 * tenían la lista de frases duplicada y divergiendo.
 *
 * REGLA: `[IMAGE: url]` NO se toca — lo consume el que parte los bloques, más
 * abajo en el pipeline, para adjuntar la foto.
 */

/** Frases que narran trabajo interno. Se borra la ORACIÓN entera, no la subcadena. */
const FRASES_DE_RELLENO = [
    'dame un segundito', 'esperame que busco', 'ahí te paso',
    'dejame verificar', 'te calculo los precios', 'ahí te busco',
    'dejame chequear', 'ya te busco', 'un momentito',
    // Narración de trabajo interno / sistema (el cliente jamás debe verlo)
    'reviso en el sistema', 'consulto en el sistema', 'verifico en el sistema',
    'busco en el sistema', 'en el sistema veo', 'en el sistema figura',
    'según nuestros registros', 'segun nuestros registros',
    'estoy revisando', 'estoy consultando', 'estoy verificando',
    'dejame revisar', 'aguardame un momento',
];

/** Marcadores que, si aparecen, se llevan la LÍNEA entera: lo que sigue es interno. */
const MARCADORES_DE_LINEA = [
    /^\s*.{0,3}\[\s*INSTRUCCI[ÓO]N\s+INTERNA\s*\].*$/gim,
    /^\s*.{0,3}\[\s*HITO\s*\].*$/gim,
    // Ecos del historial que se le inyecta al modelo entre corchetes.
    /^\s*\[\s*(?:El cliente|Imagen adjunta|Mensaje vacío|Mensaje vacio|Media)\b.*$/gim,
];

/**
 * Placeholders del prompt y marcadores sueltos. Un token TODO-MAYÚSCULAS entre
 * corchetes nunca es texto que le escribiríamos a un cliente; `IMAGE` es la
 * única excepción y va explícita.
 */
const TOKEN_INTERNO = /\[(?!IMAGE\s*:)\s*(?:[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9_]*(?:[ _][A-ZÁÉÍÓÚÑ0-9_]+)*|nombre|telefono|teléfono)\s*(?::[^\]]*)?\]/g;

/** Sello de hora del historial (`[09:33] `) al principio de una línea. */
const SELLO_DE_HORA = /^\s*\[\s*\d{1,2}:\d{2}(?::\d{2})?\s*\]\s*/gm;


/**
 * Autoidentificación como automático. PROHIBIDO decirlo (decisión de Ishtar,
 * 5/9/2026, que reemplaza a la del 31/8 en la que el bot lo aclaraba solo).
 *
 * POR QUÉ SE LIMPIA ACÁ Y NO EN EL GUARDRAIL: el guardrail no borra, DESCARTA
 * el mensaje entero y encima apaga el bot en ese chat. Hasta el 31/8 estas
 * mismas palabras estaban ahí y el resultado era que a un "sos un bot?" el
 * cliente no recibía NADA, nunca más. Acá se saca la ORACIÓN y el resto del
 * mensaje sale igual: el cliente siempre recibe una respuesta.
 *
 * El prompt ya no lo enseña, pero el prompt vivo sale de `SystemSetting.
 * bot_prompt` y puede seguir teniendo el texto viejo. Esta capa rige igual.
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
 * Limpia el texto crudo del modelo. Devuelve `{ texto, quitado }` — `quitado`
 * lista qué se sacó, para que el log diga por qué el mensaje salió distinto.
 */
function limpiarSalidaBot(crudo) {
    const quitado = [];
    // Los signos de apertura se sacan por regla de estilo (tono humano en AR).
    let texto = String(crudo ?? '').replace(/¿/g, '').replace(/¡/g, '');

    for (const re of MARCADORES_DE_LINEA) {
        re.lastIndex = 0;
        if (re.test(texto)) {
            re.lastIndex = 0;
            texto = texto.replace(re, '');
            quitado.push('marcador interno (línea completa)');
        }
    }

    SELLO_DE_HORA.lastIndex = 0;
    if (SELLO_DE_HORA.test(texto)) {
        SELLO_DE_HORA.lastIndex = 0;
        texto = texto.replace(SELLO_DE_HORA, '');
        quitado.push('sello de hora del historial');
    }

    TOKEN_INTERNO.lastIndex = 0;
    if (TOKEN_INTERNO.test(texto)) {
        TOKEN_INTERNO.lastIndex = 0;
        texto = texto.replace(TOKEN_INTERNO, '');
        quitado.push('placeholder del prompt');
    }

    // La autoidentificación se saca por ORACIÓN, antes que el relleno.
    for (const re of FRASES_DE_IDENTIDAD) {
        if (!re.test(texto)) continue;
        const global = new RegExp(`[^.!?\\n]*${re.source}[^.!?\\n]*[.!?]*`, 'gi');
        texto = texto.replace(global, '');
        quitado.push('autoidentificación como automático');
    }
    // Sacar la oración puede dejar un resto inservible ("Hola!"): el emoji y las
    // comas no cortan oración, así que a veces se lleva puesto lo que seguía.
    // Con muy poco texto útil se repone una línea que atiende de verdad — el
    // cliente nunca se queda sin respuesta ni con un saludo suelto.
    if (quitado.includes('autoidentificación como automático')) {
        const util = texto.replace(/[\s.,!?¿¡:;–—-]/g, '');
        if (util.length < 18) {
            texto = texto.trim() ? `${texto.trim()} ${RESPUESTA_SIN_IDENTIDAD}` : RESPUESTA_SIN_IDENTIDAD;
            quitado.push('(se repuso una respuesta, para no dejar al cliente con un saludo suelto)');
        }
    }

    for (const frase of FRASES_DE_RELLENO) {
        if (texto.toLowerCase().includes(frase)) {
            const esc = frase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            texto = texto.replace(new RegExp(`[^.!?\\n]*${esc}[^.!?\\n]*[.!?]*`, 'gi'), '');
            quitado.push(`relleno: "${frase}"`);
        }
    }

    // Normalizar lo que dejaron los borrados: espacios dobles, líneas vacías de
    // más (pero conservando el \n\n, que es lo que parte los mensajes) y
    // espacios colgando al final de cada línea.
    texto = texto
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return { texto, quitado };
}


// ─────────────────────────────────────────────────────────────────────────────
// Repetirse.
//
// El bot volvía a decir lo que ya había dicho un minuto antes, con otras
// palabras. El 5/9 se despidió con "Cuando tengas tu receta o quieras venir a
// probarte los armazones, te esperamos en el local" y, al toque, con "Cuando
// tengas tu recetita o quieras ver los armazones, aquí estamos". Para una
// persona es la MISMA frase; para una comparación literal, dos textos distintos.
//
// `bot-cloud.js` (el bot que está en uso) no tenía NINGÚN anti-repetición: el
// que existía vivía solo en `index.js`, el transporte viejo, y encima era
// literal. Acá se compara por palabras con peso, que es lo que hace que dos
// frases se sientan iguales aunque cambien los diminutivos y el orden.
// ─────────────────────────────────────────────────────────────────────────────

/** Palabras vacías: no aportan a decidir si dos frases dicen lo mismo. */
const VACIAS = new Set(['de','la','el','los','las','un','una','unos','unas','y','o','a','en','que','con','por','para','del','al','se','su','tu','es','lo','te','me','si','ya','mas','más','pero','como','cuando','donde','muy','ni','no','sos','soy']);

/** Minúsculas, sin acentos ni puntuación: "recetita" y "receta" siguen distintas, pero "Receta." y "receta" no. */
function normalizar(t) {
    return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Raíz aproximada: aplasta diminutivos y plurales ("recetita"/"recetas" → "recet"). */
function raiz(palabra) {
    // El recorte va DESPUÉS de sacar el sufijo y es corto a propósito: si no,
    // "recetita" quedaba en "recet" y "receta" en "receta", o sea distintas —
    // justo el par que había que emparejar.
    return palabra.replace(/(cita|cito|itas|itos|ita|ito|ciones|cion|es|s)$/, '').slice(0, 5);
}

function palabrasClave(frase) {
    return new Set(normalizar(frase).split(' ').filter(p => p.length > 2 && !VACIAS.has(p)).map(raiz));
}

/**
 * Qué parte de la frase NUEVA ya está dicha en la vieja, 0 a 1.
 *
 * Es contención, no Jaccard: la pregunta no es "se parecen", es "¿esto que voy
 * a decir ya lo dije?". Con Jaccard, una frase vieja más larga bajaba el
 * puntaje aunque contuviera entera a la nueva.
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
 * es lo segundo. Con 0.75 caen las frases prácticamente idénticas (cambios de
 * diminutivo, de orden, de puntuación) y no las que apenas comparten tema.
 * Las paráfrasis más sueltas quedan para el prompt, no para el filtro.
 */
const UMBRAL_PARECIDO = 0.75;

/**
 * Saca del texto las oraciones que ya se dijeron en los mensajes previos del bot.
 *
 * @param {string}   texto
 * @param {string[]} mensajesPreviosDelBot  los últimos salientes del bot (no de humanos)
 * @returns {{ texto: string, quitadas: string[] }}
 */
function quitarRepeticiones(texto, mensajesPreviosDelBot = []) {
    const previos = (mensajesPreviosDelBot || []).map(String).filter(Boolean);
    if (!previos.length) return { texto, quitadas: [] };

    const quitadas = [];
    // Se parte por oración pero se conservan los saltos: son los que separan burbujas.
    const salida = texto.split('\n').map(linea => {
        const oraciones = linea.split(/(?<=[.!?])\s+/);
        const quedan = oraciones.filter(o => {
            // Las frases muy cortas ("Dale!", "Perfecto") se repiten por naturaleza.
            if (normalizar(o).length < 25) return true;
            const repetida = previos.some(p =>
                normalizar(p).includes(normalizar(o)) || yaEstaDicho(o, p) >= UMBRAL_PARECIDO);
            if (repetida) quitadas.push(o.trim());
            return !repetida;
        });
        return quedan.join(' ').trim();
    }).filter(l => l !== '').join('\n');

    return { texto: salida.trim(), quitadas };
}

module.exports = { limpiarSalidaBot, quitarRepeticiones, FRASES_DE_RELLENO, FRASES_DE_IDENTIDAD };
