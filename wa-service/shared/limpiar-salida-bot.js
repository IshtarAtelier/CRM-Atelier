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

module.exports = { limpiarSalidaBot, FRASES_DE_RELLENO };
