/**
 * AI Services (Guardrails & Payment Receipt Detection)
 */

const { HumanMessage } = require("@langchain/core/messages");
const { withTimeout } = require('../utils');

/**
 * Capa de Seguridad (Output Guardrail)
 * Verifica si el texto contiene estructuras JSON o IDs de base de datos tipo CUID
 */
function runOutputGuardrail(text) {
    if (!text) return { safe: true };

    // 1. Detectar IDs de base de datos tipo CUID (ej: cmpiyd5790000dzris5hpt628)
    const cuidRegex = /\bc[a-z0-9]{23,29}\b/gi;
    const hasCuid = cuidRegex.test(text);

    // 2. Detectar estructuras JSON (ej: { "precio": 30000 })
    const jsonRegex = /\{[\s\S]*?\}/;
    const hasJson = jsonRegex.test(text) && (text.includes('"') || text.includes(':'));

    // 3. Detectar si revela que es un bot o menciona desactivar el bot por temas personales/humanos
    const botRevealKeywords = [
        'carácter personal', 'caracter personal', 'desactivo el bot', 'desactivar el bot',
        'conversación personal', 'conversacion personal', 'soy un bot', 'soy un asistente virtual',
        'asistente de inteligencia artificial', 'ia de la optica', 'bot de whatsapp', 'desactivo para que',
        'desactivo el agente', 'desactivar el agente', 'desactivo respuestas', 'desactivo la ia',
        'me despido por ahora',
        // Ampliación de guardrail (Auditoría 2026-05-26)
        'soy una inteligencia artificial', 'soy un asistente de ia', 'soy un programa',
        'fui programada', 'fui diseñada para', 'como modelo de lenguaje', 'soy una ia',
        'soy un chatbot', 'no soy humana', 'no soy una persona real', 'asistente automatizado',
        'respuesta automática', 'respuesta automatica', 'sistema automatizado', 'no soy humano',
        'no soy una persona', 'inteligencia artificial de', 'algoritmo de', 'modelo de ia'
    ];
    const lowerText = text.toLowerCase();
    const revealsBot = botRevealKeywords.some(keyword => lowerText.includes(keyword));

    if (hasCuid || hasJson || revealsBot) {
        return {
            safe: false,
            reason: hasCuid ? 'ID de Base de Datos Detectado' : (hasJson ? 'Estructura JSON Detectada' : 'Revelación de Identidad de Bot o Desactivación Manual'),
            matched: hasCuid ? text.match(cuidRegex) : null
        };
    }

    return { safe: true };
}

/**
 * Clasifica si una imagen es un comprobante de transferencia o pago utilizando Gemini multimodal.
 */
async function detectPaymentReceipt(mediaBase64, mimeType) {
    try {
        const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
        const model = new ChatGoogleGenerativeAI({
            model: 'gemini-2.5-flash',
            temperature: 0,
            apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY
        });

        const response = await withTimeout(
            model.invoke([
                new HumanMessage({
                    content: [
                        { 
                            type: "text", 
                            text: `Clasificá esta imagen. Respondé ÚNICAMENTE con la palabra "COMPROBANTE" si parece ser un ticket de transferencia, recibo de pago, comprobante de Mercado Pago o captura de pantalla de transferencia de pago confirmada. Si es cualquier otra cosa (receta médica, foto de un anteojo, foto de una persona, saludo, etc.), respondé con "OTRO".` 
                        },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${mediaBase64}` } }
                    ]
                })
            ]),
            30000,
            'Gemini payment receipt detection timeout'
        );

        const text = response.content.toString().trim().toUpperCase();
        return text.includes('COMPROBANTE') && !text.includes('OTRO');
    } catch (e) {
        console.error('Error en detectPaymentReceipt:', e.message);
        return false;
    }
}

module.exports = {
    runOutputGuardrail,
    detectPaymentReceipt
};
