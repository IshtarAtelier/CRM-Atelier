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
            // Solo partes de TEXTO. Gemini 2.5 devuelve su razonamiento como
            // partes `type: 'thinking'` (y otros proveedores, 'reasoning'):
            // concatenarlas a ciegas es mandarle al cliente lo que el modelo
            // pensó. El 4/10/2026 un cliente recibió "I should not respond
            // further…". Una parte sin `type` se trata como texto (formato viejo).
            .map(p => (typeof p === 'string' ? p : (p && typeof p.text === 'string' && (!p.type || p.type === 'text') ? p.text : '')))
            .join('');
    }
    if (content && typeof content.text === 'string') return content.text;
    return '';
}

module.exports = { contenidoATexto };
