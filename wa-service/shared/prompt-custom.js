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

module.exports = { LARGO_MINIMO_PROMPT_CUSTOM, AUTOPRESENTACIONES_PROHIBIDAS, motivoParaDescartarPromptCustom };
