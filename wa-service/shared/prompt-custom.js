'use strict';

/**
 * ¿Se usa el prompt custom de la base (`SystemSetting.bot_prompt` /
 * `bot_prompt_executive`) o se cae al del repo?
 *
 * POR QUÉ existe (auditoría del 15/10/2026): `graph.js` descartaba el prompt
 * vivo si contenía /contact[oó]log/ en CUALQUIER lugar. Había prompts legacy
 * que presentaban al bot como "Matías Turchi, Óptico Contactólogo", y el
 * filtro era para eso. Pero el prompt vivo de producción dice justamente lo
 * contrario — "Nunca te inventes un nombre propio, un apellido ni un título
 * (óptica, contactóloga, doctora)" — y por esa frase se descartaba ENTERO, en
 * silencio: el bot respondía con el prompt del repo y nadie se enteraba de
 * que lo que se editaba en el panel no tenía efecto.
 *
 * Ahora se descarta solo por una AUTOPRESENTACIÓN con apellido o título
 * ("soy Matías Turchi", "te habla … contactóloga", una firma "Óptico
 * Contactólogo"), no por la palabra; una frase que lo PROHÍBE ("nunca digas
 * que sos contactóloga") no cuenta. Y cada descarte se loguea con el motivo
 * (`graph.js`), y `npm run check:prompt-bot -- --prod` avisa si el vivo
 * sería descartado.
 *
 * Puro: sin base ni red.
 */

/** Por debajo de esto no es un prompt: es un resto o una prueba. */
const LARGO_MINIMO_PROMPT_CUSTOM = 301;

const PRESENTACION = '(?:soy|te habla|les habla|me llamo|mi nombre es|sos|ser[aá]s|actu[aá]s como)';

/** Autopresentaciones con apellido o título: lo que el filtro tiene que atajar. */
const AUTOPRESENTACIONES_PROHIBIDAS = [
    { motivo: 'se presenta con el apellido Turchi', re: new RegExp(`\\b${PRESENTACION}\\b[^.\\n]{0,60}\\bturchi\\b`, 'i') },
    { motivo: 'se presenta como contactólogo/a', re: new RegExp(`\\b${PRESENTACION}\\b[^.\\n]{0,60}contact[oó]log`, 'i') },
    { motivo: 'se presenta como ejecutivo/a de cuentas', re: new RegExp(`\\b${PRESENTACION}\\b[^.\\n]{0,60}ejecutiv[oa]\\s+de\\s+cuentas`, 'i') },
    // Firma suelta en su propia línea: "— Matías, Óptico Contactólogo". Sin
    // `\b` delante de la Ó: en JS `\b` es solo ASCII y no la ve como letra.
    { motivo: 'firma como "Óptico Contactólogo"', re: /^[\s\-–—*_]*[^\n]{0,40}(?:^|[\s,])[oó]ptic[oa]\s+contact[oó]log[oa][\s.*_]*$/im },
];

/** Si antes de la coincidencia (en la misma oración) hay una negación, la frase lo PROHÍBE. */
const NEGACION = /\b(?:no|nunca|jam[aá]s|prohibid[oa]|ni)\b/i;

function esProhibicion(texto, indice) {
    const antes = texto.slice(Math.max(0, indice - 80), indice);
    const oracion = antes.split(/[.\n]/).pop();
    return NEGACION.test(oracion);
}

/**
 * @param {string} custom
 * @returns {string|null} el motivo para descartarlo, o null si se usa
 */
function motivoParaDescartarPromptCustom(custom) {
    const texto = String(custom || '');
    if (!texto.trim()) return 'está vacío';
    if (texto.trim().length < LARGO_MINIMO_PROMPT_CUSTOM) return `tiene ${texto.trim().length} caracteres (mínimo ${LARGO_MINIMO_PROMPT_CUSTOM})`;
    for (const { motivo, re } of AUTOPRESENTACIONES_PROHIBIDAS) {
        const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
        for (const m of texto.matchAll(global)) {
            // La negación se busca antes del VERBO de presentación ("nunca
            // digas que sos contactóloga"), no antes del título.
            if (!esProhibicion(texto, m.index + (m[0].length - m[0].trimStart().length))) {
                return `${motivo}: "${m[0].trim().slice(0, 80)}"`;
            }
        }
    }
    return null;
}

/**
 * ¿El bot de VENTAS usa el prompt vivo (`SystemSetting.bot_prompt`) o el del
 * repo? Decisión EXPLÍCITA desde el 15/10/2026.
 *
 * Hasta hoy, en producción, el prompt vivo se descartaba siempre por el
 * filtro viejo (ver arriba) y el bot respondía con el del repo. Arreglar el
 * filtro lo habría puesto en uso de golpe, y el vivo no dice lo mismo: receta
 * ilegible → 'pedir_ayuda' y silencio (el repo, CORE_RULES #7: 'create_task' y
 * seguir la charla), cotizar siempre en PDF con create_quote + send_quote_pdf,
 * etc. Hasta que Ishtar decida cuál es la fuente de verdad, se PRESERVA lo que
 * hace producción: el prompt del repo. El vivo solo se usa si
 * `SystemSetting.bot_prompt_activo` = 'true'. Sin la fila, o con cualquier
 * otro valor → el del repo.
 */
const CLAVE_PROMPT_ACTIVO = 'bot_prompt_activo';

/** @param {{ value?: string }|null|undefined} fila  la de SystemSetting (o nada) */
function promptVivoActivo(fila) {
    return Boolean(fila && String(fila.value || '').trim().toLowerCase() === 'true');
}

/**
 * @param {{ activo: boolean, vivo: string }} p
 * @returns {{ custom: string, fuente: 'vivo'|'repo', motivo: string }}
 *   `custom` es lo que se le pasa al grafo como prompt custom ('' = el del repo).
 */
function promptDeVentas({ activo, vivo }) {
    if (!activo) return { custom: '', fuente: 'repo', motivo: `${CLAVE_PROMPT_ACTIVO} no está en 'true' (se preserva el comportamiento de producción)` };
    const descarte = motivoParaDescartarPromptCustom(vivo);
    if (descarte) return { custom: '', fuente: 'repo', motivo: `${CLAVE_PROMPT_ACTIVO}=true pero el prompt vivo se descarta: ${descarte}` };
    return { custom: String(vivo), fuente: 'vivo', motivo: `${CLAVE_PROMPT_ACTIVO}=true` };
}

module.exports = { LARGO_MINIMO_PROMPT_CUSTOM, AUTOPRESENTACIONES_PROHIBIDAS, motivoParaDescartarPromptCustom, CLAVE_PROMPT_ACTIVO, promptVivoActivo, promptDeVentas };
