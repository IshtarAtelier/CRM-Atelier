/**
 * Generación de mensajes de seguimiento con Gemini.
 * Separado de la lógica de envío para testear/validar independientemente.
 */

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { SystemMessage, HumanMessage } = require("@langchain/core/messages");
const { withTimeout } = require('../utils');
const { validateMessage, validateNameFrequency, validateSalesContent, sanitizeMessage } = require('./message-validator');
const {
    MAX_OUTPUT_TOKENS,
    TEMPERATURE,
    MODEL_NAME,
    GENERATION_TIMEOUT_MS,
    MAX_RETRIES,
    DIA_15_COUPON,
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
    "Sos Matías, de Atelier Óptica. Escribís un mensaje de SEGUIMIENTO DE VENTAS por WhatsApp que debe parecer escrito A MANO por vos, una persona real que se acuerda de este cliente. 100% humano.\n\n" +
    "REGLA DE ORO #1 (HUMANIDAD): El mensaje debe leerse como si lo hubieras tecleado vos en el momento, acordándote de esa persona. Usá su nombre de pila y, si el historial o el resumen lo permiten, retomá UN detalle concreto de su conversación (algo que dijo, para qué quería los lentes, el armazón que le gustó). PROHIBIDO cualquier tono de campaña masiva o plantilla: nada de 'oferta especial', 'promoción exclusiva', 'imperdible', 'no te lo pierdas', 'última oportunidad', 'por tiempo limitado', 'estimado/a'. Nunca repitas frases que ya aparezcan en el historial del chat.\n\n" +
    "REGLA DE ORO #2 (VENTA): Esto es un seguimiento COMERCIAL, no un saludo social. El mensaje SIEMPRE debe hacer referencia concreta a la compra pendiente: el producto cotizado (anteojos, lentes, armazón), el presupuesto que le pasamos, o una acción de compra (probarse, señar, cuotas, retomar el pedido). PROHIBIDO enviar solo un 'hola, cómo andás?' sin contenido de venta.\n\n" +
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
function getDia15CouponText() {
    if (!DIA_15_COUPON.enabled) return '';
    // Fecha de vencimiento concreta ("el viernes 10") — suena a gesto personal, no a campaña
    const expiry = new Date(Date.now() + DIA_15_COUPON.validityDays * 24 * 60 * 60 * 1000);
    const expiryStr = expiry.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', timeZone: 'America/Argentina/Cordoba' });
    return `\nGESTO PERSONAL OBLIGATORIO: Contale que lo estuviste hablando en la óptica y le conseguiste un ${DIA_15_COUPON.percent}% de descuento ADICIONAL sobre SU presupuesto, y que se lo guardás a su nombre hasta el ${expiryStr}. Tiene que sonar a un favor que conseguiste especialmente para esta persona, nunca a promoción masiva. Es OBLIGATORIO mencionar el "${DIA_15_COUPON.percent}%" y hasta cuándo se lo guardás.`;
}

function getTierInstruction(followUpType) {
    const TIER_INSTRUCTIONS = {
        DIA_1: `TIPO DE SEGUIMIENTO: DÍA 1 (24 horas después del presupuesto).\n` +
               `OBJETIVO DE VENTA: Preguntar si le quedó alguna duda sobre la cotización, NOMBRANDO el producto cotizado (ej: "los multifocales", "los cristales que vimos"). Invitalo a pasar por el Atelier a probarse los armazones en persona o coordinar online. Preguntale cuándo le queda cómodo venir o si prefiere hacerlo online.\n` +
               `TONO: como quien retoma una charla de ayer con alguien que conoce, usando su nombre de pila.`,

        DIA_4: `TIPO DE SEGUIMIENTO: DÍA 4 (4 días después del presupuesto).\n` +
               `OBJETIVO DE VENTA: Comentarle amigablemente que los precios de laboratorio pueden actualizarse pronto, haciendo referencia al producto que cotizó. Recordarle que puede señar para congelar el valor o pagar en cuotas sin interés. Si prometió pasar por el local, hacé referencia directa a eso (ej: "me dijiste que pasabas por el local...").\n` +
               `TONO: cercano y genuino, como un aviso que le hacés de buena onda, no una presión de venta.`,

        INACTIVIDAD: `TIPO DE SEGUIMIENTO: RETOMAR CHARLA (el cliente no respondió tu último mensaje hace más de un día).\n` +
               `OBJETIVO DE VENTA: Retomar la conversación desde el punto exacto donde quedó (mirá el historial: qué le preguntaste o qué estaban por definir) y facilitarle el siguiente paso (ver opciones, pasar por el local, señar). Si había un producto o presupuesto en juego, nombralo.\n` +
               `TONO: como quien vuelve a escribir sin presionar ("quedamos en..." / "me quedé con la duda de..."). Nunca lo hagas sentir perseguido.`,

        DIA_15: `TIPO DE SEGUIMIENTO: DÍA 15 — ÚLTIMO CONTACTO. Este mensaje tiene que parecer escrito A MANO, 100% personal, de alguien que se acordó de este cliente puntual.\n` +
                `PERSONALIZACIÓN OBLIGATORIA:\n` +
                `- Usá su nombre de pila en el saludo.\n` +
                `- Nombrá el producto EXACTO que cotizó (mirá los items del presupuesto).\n` +
                `- Retomá UN detalle concreto de la conversación (algo que dijo, el armazón que le gustó, para qué los quería, su obra social). Si el resumen o historial lo permite, este detalle es lo primero que hace que el mensaje se sienta personal.\n` +
                `ESTILO HUMANO: escribí como si te hubieras acordado de él/ella hoy ("me quedé pensando en...", "estuve revisando tu presupuesto y..."). Una sola pregunta al final.\n` +
                `PROHIBIDO sonar a marketing: nada de "oferta especial", "promoción exclusiva", "imperdible", "no te lo pierdas", "última oportunidad".` +
                getDia15CouponText(),
    };
    return TIER_INSTRUCTIONS[followUpType];
}

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

    const tierInstruction = getTierInstruction(followUpType);
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

            // Validar que sea un seguimiento de VENTAS y no un saludo genérico
            const salesCheck = validateSalesContent(text);
            if (!salesCheck.valid) {
                console.warn(`  ⚠️ [MessageGen] ${salesCheck.reason} para ${client.name} (intento ${attempt + 1}). Texto: "${text.substring(0, 80)}..."`);
                continue;
            }

            // En el Día 15 el cupón adicional es obligatorio
            if (followUpType === 'DIA_15' && DIA_15_COUPON.enabled && !text.includes(`${DIA_15_COUPON.percent}%`)) {
                console.warn(`  ⚠️ [MessageGen] Mensaje DIA_15 sin el cupón del ${DIA_15_COUPON.percent}% para ${client.name} (intento ${attempt + 1})`);
                continue;
            }

            // Todos los seguimientos deben sonar personales: rechazar tono de campaña masiva
            const marketingPhrases = ['oferta especial', 'promoción exclusiva', 'promocion exclusiva', 'imperdible', 'no te lo pierdas', 'última oportunidad', 'ultima oportunidad', 'por tiempo limitado', 'estimado', 'estimada'];
            const lowerText = text.toLowerCase();
            const foundMarketing = marketingPhrases.find(p => lowerText.includes(p));
            if (foundMarketing) {
                console.warn(`  ⚠️ [MessageGen] Mensaje ${followUpType} con tono de campaña ("${foundMarketing}") para ${client.name} (intento ${attempt + 1})`);
                continue;
            }

            // Anti-repetición: no mandar un texto igual o casi igual a algo que ya se dijo en el chat
            const normalize = (s) => (s || '').toLowerCase().replace(/[^a-záéíóúüñ0-9\s]/gi, '').replace(/\s+/g, ' ').trim();
            const normalizedNew = normalize(text);
            const repeated = (recentMessages || []).some(m =>
                m.direction === 'OUTBOUND' && normalizedNew.length > 0 && (
                    normalize(m.content) === normalizedNew ||
                    (normalizedNew.length >= 30 && normalize(m.content).includes(normalizedNew))
                )
            );
            if (repeated) {
                console.warn(`  ⚠️ [MessageGen] Mensaje ${followUpType} repetido respecto al historial para ${client.name} (intento ${attempt + 1})`);
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
