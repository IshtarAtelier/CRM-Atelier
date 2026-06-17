const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage } = require("@langchain/core/messages");
const { withTimeout } = require('./utils');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let transcriberModelInstance = null;

function getTranscriberModel() {
    if (!transcriberModelInstance) {
        transcriberModelInstance = new ChatGoogleGenerativeAI({
            model: 'gemini-2.5-flash',
            temperature: 0,
            apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
        });
    }
    return transcriberModelInstance;
}

async function transcribeAudio(base64Data, mimeType) {
    try {
        if (!base64Data) return null;
        
        // Validar tamaño del base64 (limitar a 15MB ~ 11MB raw audio) para evitar desborde de memoria
        if (base64Data.length > 15 * 1024 * 1024) {
            console.warn("  ⚠️ Audio omitido por exceder límite de tamaño (15MB base64)");
            return "(Audio muy largo para transcribir)";
        }

        const model = getTranscriberModel();
        // LangChain arroja error si el mimeType incluye parámetros extra como "; codecs=opus"
        const cleanMimeType = mimeType.split(';')[0].trim();
        
        const msg = new HumanMessage({
            content: [
                { type: "text", text: "Transcribe exactamente lo que dice este audio. No agregues comentarios, notas ni formato especial, solo el texto hablado. Si no se escucha nada, responde '(Audio inaudible)'." },
                { type: "image_url", image_url: { url: `data:${cleanMimeType};base64,${base64Data}` } }
            ]
        });
        
        // Timeout de 30 segundos para la llamada a Gemini
        const res = await withTimeout(
            model.invoke([msg]),
            30000,
            'Gemini transcription timeout'
        );
        return res.content.trim();
    } catch (err) {
        console.error("  ❌ Error transcribiendo audio:", err.message);
        return null;
    }
}

module.exports = { transcribeAudio };
