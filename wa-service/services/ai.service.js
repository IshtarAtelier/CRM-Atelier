/**
 * AI Services (Guardrails & Payment Receipt Detection)
 */

const { HumanMessage } = require("@langchain/core/messages");
const { contenidoATexto } = require('../shared/ai-content');
const { withTimeout } = require('../utils');

// El guardrail se mudó a `shared/guardrail-salida.js` (10/10/2026): lo usa el
// punto de salida único y tiene que cargar sin dependencias. Se re-exporta acá
// para los que ya lo importaban de este archivo.
const { runOutputGuardrail } = require('../shared/guardrail-salida');

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

        const text = contenidoATexto(response.content).trim().toUpperCase();
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
