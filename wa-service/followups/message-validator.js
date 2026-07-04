/**
 * Validación exhaustiva de mensajes de seguimiento ANTES de enviarlos.
 * Cada check devuelve { valid, reason } para logging claro.
 */

const {
    MIN_MESSAGE_LENGTH,
    MAX_MESSAGE_LENGTH,
    MAX_WORD_COUNT,
} = require('./config');

// Regex para detectar CUIDs internos de Prisma (ej: clxyz123abc...)
const CUID_REGEX = /\bc[a-z0-9]{23,}\b/gi;

// Regex para detectar JSON embebido
const JSON_REGEX = /\{[\s\S]*?\}/;

// Emojis y caracteres que se consideran finales válidos de un mensaje
const VALID_ENDINGS = /[.!?\)😊☕👓👋🙌✨💪🤗😄🫶🤙💐🌟🥰😉👀🏠🔬💎🕶️📋❤️🤝👍🙏😁💙🫠🤓✌️☀️🌞🧡💜]$/u;

/**
 * Valida un mensaje generado por la IA antes de enviarlo al cliente.
 * @param {string} text - Texto del mensaje
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateMessage(text) {
    if (!text || typeof text !== 'string') {
        return { valid: false, reason: 'Mensaje vacío o no es string' };
    }

    const trimmed = text.trim();

    // 1. Longitud mínima
    if (trimmed.length < MIN_MESSAGE_LENGTH) {
        return { valid: false, reason: `Muy corto (${trimmed.length} chars, mínimo ${MIN_MESSAGE_LENGTH})` };
    }

    // 2. Longitud máxima en caracteres
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
        return { valid: false, reason: `Muy largo (${trimmed.length} chars, máximo ${MAX_MESSAGE_LENGTH})` };
    }

    // 3. Conteo de palabras
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount > MAX_WORD_COUNT) {
        return { valid: false, reason: `Demasiadas palabras (${wordCount}, máximo ${MAX_WORD_COUNT})` };
    }

    // 4. CUIDs internos
    if (CUID_REGEX.test(trimmed)) {
        CUID_REGEX.lastIndex = 0; // Reset del regex global
        return { valid: false, reason: 'Contiene CUIDs internos' };
    }

    // 5. JSON embebido
    if (JSON_REGEX.test(trimmed) && (trimmed.includes('"') || trimmed.includes(':'))) {
        return { valid: false, reason: 'Contiene estructuras JSON' };
    }

    // 6. Datos internos del sistema
    const internalPatterns = [
        /\b(clientId|chatId|orderId|waMessageId)\b/i,
        /\/api\//i,
        /prisma/i,
        /\b(function|module\.exports|require)\b/i,
        /localhost/i,
    ];
    for (const pattern of internalPatterns) {
        if (pattern.test(trimmed)) {
            return { valid: false, reason: `Contiene datos internos del sistema (${pattern.source})` };
        }
    }

    // 7. Signos de apertura prohibidos
    if (/[¿¡]/.test(trimmed)) {
        return { valid: false, reason: 'Contiene signos de apertura (¿ o ¡)' };
    }

    // 8. Diálogos simulados (la IA a veces "actúa" ambos lados)
    const dialogPatterns = [
        /\[(Cliente|Nosotros|Bot|Atelier)\]:/i,
        /^(Cliente|Bot|Nosotros|Agente):/mi,
        /---/,
    ];
    for (const pattern of dialogPatterns) {
        if (pattern.test(trimmed)) {
            return { valid: false, reason: `Contiene diálogo simulado (${pattern.source})` };
        }
    }

    // 9. Nombre del cliente repetido más de 1 vez (señal de que el LLM está divagando)
    // Se chequea externamente pasando el nombre

    // 10. Terminación limpia
    if (!VALID_ENDINGS.test(trimmed)) {
        return { valid: false, reason: `No termina limpio. Último char: "${trimmed.slice(-3)}"` };
    }

    return { valid: true };
}

/**
 * Verifica que el mensaje sea un seguimiento de VENTAS: debe hacer referencia
 * concreta a la compra pendiente (producto, presupuesto, cuotas, etc.).
 * Un saludo genérico sin contenido comercial se rechaza.
 * @param {string} text - Texto del mensaje
 * @returns {{ valid: boolean, reason?: string }}
 */
const SALES_CONTENT_KEYWORDS = [
    'anteoj', 'lente', 'presupuesto', 'cotiza', 'armaz', 'cristal', 'marco',
    'cuota', 'señ', 'sena', 'descuento', 'cupón', 'cupon', 'multifocal',
    'monofocal', 'bifocal', 'gafa', 'receta', 'precio', 'valor', 'promo',
    'compra', 'pedido', 'probarte', 'probar', 'recet'
];

function validateSalesContent(text) {
    const lower = (text || '').toLowerCase();
    const hasSalesContent = SALES_CONTENT_KEYWORDS.some(kw => lower.includes(kw));
    if (!hasSalesContent) {
        return { valid: false, reason: 'Sin contenido de venta (saludo genérico): no menciona el presupuesto, producto ni ninguna referencia comercial' };
    }
    return { valid: true };
}

/**
 * Verifica que el nombre del cliente no aparezca más de 1 vez en el mensaje.
 * @param {string} text - Texto del mensaje
 * @param {string} clientName - Nombre completo del cliente
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateNameFrequency(text, clientName) {
    if (!clientName) return { valid: true };

    // Extraer primer nombre para chequear
    const firstName = clientName.split(/\s+/)[0];
    if (firstName.length < 3) return { valid: true }; // Nombres muy cortos no son fiables

    const regex = new RegExp(firstName, 'gi');
    const matches = text.match(regex);
    if (matches && matches.length > 2) {
        return { valid: false, reason: `Nombre "${firstName}" repetido ${matches.length} veces` };
    }

    return { valid: true };
}

/**
 * Sanitiza un mensaje generado: limpia caracteres problemáticos.
 * @param {string} text - Texto crudo de la IA
 * @returns {string} Texto limpio
 */
function sanitizeMessage(text) {
    if (!text) return '';

    let clean = text.trim();

    // Eliminar signos de apertura
    clean = clean.replace(/[¿¡]/g, '');

    // Eliminar comillas envolventes
    clean = clean.replace(/^["']+|["']+$/g, '');

    // Eliminar asteriscos de markdown
    clean = clean.replace(/\*+/g, '');

    // Colapsar espacios múltiples
    clean = clean.replace(/\s{2,}/g, ' ');

    return clean.trim();
}

module.exports = {
    validateMessage,
    validateNameFrequency,
    validateSalesContent,
    sanitizeMessage,
};
