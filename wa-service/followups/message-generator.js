/**
 * Generación de mensajes de seguimiento con Gemini.
 * Separado de la lógica de envío para testear/validar independientemente.
 */

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { SystemMessage, HumanMessage } = require("@langchain/core/messages");
const { withTimeout } = require('../utils');
const { validateMessage, validateNameFrequency, sanitizeMessage } = require('./message-validator');
const {
    MAX_OUTPUT_TOKENS,
    TEMPERATURE,
    MODEL_NAME,
    GENERATION_TIMEOUT_MS,
    MAX_RETRIES,
} = require('./config');

// Singleton del modelo — evitar instanciar uno por cada llamada
let _model = null;
function getModel() {
    if (!_model) {
        _model = new ChatGoogleGenerativeAI({
            model: MODEL_NAME,
            temperature: TEMPERATURE,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
        });
    }
    return _model;
}

// ──────────────────────────────────────────────
// System prompt compartido para todos los tipos
// ──────────────────────────────────────────────
const SYSTEM_PROMPT =
    "Sos el asistente virtual de Atelier Óptica. Tu único objetivo es escribir un mensaje de seguimiento de ventas muy cálido, natural y simpático a través de WhatsApp.\n\n" +
    "REGLAS DE ESCRITURA CRÍTICAS (DEBÉS CUMPLIRLAS ESTRICTAMENTE):\n" +
    "1. NUNCA uses el signo de interrogación de apertura (¿). Solo usá el de cierre (?). Ejemplo: 'cómo andás?' en lugar de '¿cómo andás?'.\n" +
    "2. Usá 'voseo' argentino (ej: 'venite', 'querés', 'pensás', 'mirá', 'comentame').\n" +
    "3. Escribí de forma relajada y descontracturada, sin mayúsculas exageradas ni puntuación sumamente rígida.\n" +
    "4. MÁXIMO 35 PALABRAS EN TOTAL. Contá las palabras antes de responder. Si tu mensaje tiene más de 35 palabras, reescribilo más corto.\n" +
    "5. Usá 1 o 2 emojis máximo, de forma sutil (😊, ☕, 👓, 👋). Terminá siempre el mensaje con un emoji o signo de pregunta.\n" +
    "6. Sé original: no copies plantillas.\n" +
    "7. Hacé referencia al contexto de los últimos mensajes si es pertinente.\n" +
    "8. PROHIBIDO: lunfardo callejero ('che', 'copado', 'piola', 're', 'mortal', 'todo súper', 'qué onda', 'geniazo'). La palabra 'dale' sí está permitida.\n" +
    "9. PROHIBIDO: mencionar IDs, códigos, presupuestos por número, datos técnicos internos.\n" +
    "10. Respondé ÚNICAMENTE con el texto del mensaje. Sin comillas, sin explicaciones, sin introducciones.";

// ──────────────────────────────────────────────
// Instrucciones por tipo de seguimiento
// ──────────────────────────────────────────────
const TIER_INSTRUCTIONS = {
    DIA_1: `TIPO DE SEGUIMIENTO: DÍA 1 (24 horas después del presupuesto).\n` +
           `OBJETIVO: Preguntar amablemente si le quedó alguna duda sobre la cotización. Invitalo a pasar por el Atelier a probarse los armazones en persona o coordinar online. Preguntale cuándo le queda cómodo venir o si prefiere hacerlo online.`,

    DIA_4: `TIPO DE SEGUIMIENTO: DÍA 4 (4 días después del presupuesto).\n` +
           `OBJETIVO: Comentarle amigablemente que los precios de laboratorio pueden actualizarse pronto. Recordarle que puede señar para congelar el valor o usar cuotas. Si prometió pasar por el local, hacé referencia directa a eso.`,

    DIA_15: `TIPO DE SEGUIMIENTO: DÍA 15 (15 días después del presupuesto).\n` +
            `OBJETIVO: Retomar la conversación de forma casual. Preguntarle si pudo al final hacer los anteojitos o si todavía está interesado, y si quiere que retomen la compra. Usá el nombre de pila del cliente en el saludo.`,
};

/**
 * Formatea los detalles de un presupuesto para el prompt.
 */
function formatQuoteDetails(order) {
    if (!order || !order.items || order.items.length === 0) {
        return "Presupuesto sin detalles específicos.";
    }

    const itemsStr = order.items.map(item => {
        const name = item.productNameSnapshot || (item.product ? item.product.name : 'Producto');
        return `- ${item.quantity}x ${name} ($${item.price})`;
    }).join('\n');

    return `Items del presupuesto:\n${itemsStr}\nTotal: $${order.total}`;
}

/**
 * Formatea el historial reciente del chat para el prompt.
 */
function formatChatHistory(messages) {
    if (!messages || messages.length === 0) return "(Sin historial reciente)";

    return messages
        .slice()
        .reverse()
        .map(m => `[${m.direction === 'OUTBOUND' ? 'Nosotros' : 'Cliente'}]: ${m.content || '(media)'}`)
        .join('\n');
}

/**
 * Genera un mensaje de seguimiento para un cliente.
 * Reintenta hasta MAX_RETRIES veces si la validación falla.
 *
 * @param {Object} params
 * @param {Object} params.client - Cliente con name, etc.
 * @param {Object} params.chat - Chat con chatSummary, etc.
 * @param {Object} params.quote - Presupuesto con items, total, etc.
 * @param {string} params.followUpType - 'DIA_1', 'DIA_4', 'DIA_15'
 * @param {Array} params.recentMessages - Últimos N mensajes del chat
 * @returns {Promise<{ text: string|null, error?: string }>}
 */
async function generateFollowUpMessage({ client, chat, quote, followUpType, recentMessages }) {
    const model = getModel();

    const tierInstruction = TIER_INSTRUCTIONS[followUpType];
    if (!tierInstruction) {
        return { text: null, error: `Tipo de seguimiento desconocido: ${followUpType}` };
    }

    // Construir el prompt del usuario
    let userPrompt = `INFORMACIÓN DEL CLIENTE:\n- Nombre: ${client.name}\n`;
    if (chat.chatSummary) {
        userPrompt += `- Resumen de la conversación: "${chat.chatSummary}"\n`;
    }
    userPrompt += `- Detalles del Presupuesto Pendiente:\n${formatQuoteDetails(quote)}\n\n`;
    userPrompt += `HISTORIAL DE CHAT RECIENTE:\n${formatChatHistory(recentMessages)}\n\n`;
    userPrompt += tierInstruction;

    const systemMessage = new SystemMessage(SYSTEM_PROMPT);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            let promptToUse = userPrompt;
            if (attempt > 0) {
                // Retry con instrucción extra de ser más corto
                promptToUse += '\n\nIMPORTANTE: Tu intento anterior fue rechazado por ser muy largo o tener formato incorrecto. Escribí un mensaje MÁS CORTO (máximo 25 palabras). Solo el texto del mensaje, nada más.';
            }

            const response = await withTimeout(
                model.invoke([systemMessage, new HumanMessage(promptToUse)]),
                GENERATION_TIMEOUT_MS,
                'Timeout generando mensaje de seguimiento'
            );

            let text = response.content.toString().trim();

            // Sanitizar
            text = sanitizeMessage(text);

            if (!text) {
                console.warn(`  ⚠️ [MessageGen] Gemini devolvió respuesta vacía para ${client.name} (intento ${attempt + 1})`);
                continue;
            }

            // Validar mensaje
            const validation = validateMessage(text);
            if (!validation.valid) {
                console.warn(`  ⚠️ [MessageGen] Mensaje rechazado para ${client.name} (intento ${attempt + 1}): ${validation.reason}. Texto: "${text.substring(0, 80)}..."`);
                continue;
            }

            // Validar frecuencia del nombre
            const nameCheck = validateNameFrequency(text, client.name);
            if (!nameCheck.valid) {
                console.warn(`  ⚠️ [MessageGen] ${nameCheck.reason} para ${client.name} (intento ${attempt + 1})`);
                continue;
            }

            console.log(`  ✅ [MessageGen] Mensaje generado para ${client.name} (${followUpType}, intento ${attempt + 1}): "${text}"`);
            return { text };

        } catch (err) {
            console.error(`  ❌ [MessageGen] Error Gemini para ${client.name} (intento ${attempt + 1}):`, err.message);
            if (attempt === MAX_RETRIES) {
                return { text: null, error: err.message };
            }
        }
    }

    return { text: null, error: `Todos los intentos fallaron para ${client.name}` };
}

module.exports = {
    generateFollowUpMessage,
    formatQuoteDetails,
    formatChatHistory,
};
