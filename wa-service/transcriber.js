const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage } = require("@langchain/core/messages");
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
        const model = getTranscriberModel();
        // LangChain arroja error si el mimeType incluye parámetros extra como "; codecs=opus"
        const cleanMimeType = mimeType.split(';')[0].trim();
        
        const msg = new HumanMessage({
            content: [
                { type: "text", text: "Transcribe exactamente lo que dice este audio. No agregues comentarios, notas ni formato especial, solo el texto hablado. Si no se escucha nada, responde '(Audio inaudible)'." },
                { type: "image_url", image_url: { url: `data:${cleanMimeType};base64,${base64Data}` } }
            ]
        });
        const res = await model.invoke([msg]);
        return res.content.trim();
    } catch (err) {
        console.error("  ❌ Error transcribiendo audio:", err.message);
        return null;
    }
}

module.exports = { transcribeAudio };
