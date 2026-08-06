/**
 * Texto plano de una respuesta de LangChain/Gemini.
 *
 * `res.content` puede ser un string O un array de partes
 * ([{type:'text', text:'...'}, ...]) según el modelo y la respuesta. Tratarlo
 * como string a mano tenía dos modos de fallo reales, vistos en producción:
 * - `.replace(...)` directo → crash "res.content.replace is not a function"
 *   (el Extractor Pasivo moría y la conversación quedaba sin ficha/resumen).
 * - `.toString()` sobre el array → "[object Object]" silencioso en resúmenes
 *   y seguimientos.
 *
 * @param {string|Array|Object|null} content
 * @returns {string} el texto concatenado; '' si no hay texto.
 */
function contenidoATexto(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map(p => (typeof p === 'string' ? p : (p && typeof p.text === 'string' ? p.text : '')))
            .join('');
    }
    if (content && typeof content.text === 'string') return content.text;
    return '';
}

module.exports = { contenidoATexto };
