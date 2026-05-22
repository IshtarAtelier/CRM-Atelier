const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { SystemMessage } = require("@langchain/core/messages");
const { prisma } = require('./db');
const { addTagToClient } = require('./tools');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let passiveModelInstance = null;

function getPassiveModel() {
    if (!passiveModelInstance) {
        passiveModelInstance = new ChatGoogleGenerativeAI({
                model: 'gemini-2.5-flash',
            maxOutputTokens: 256,
            temperature: 0.1,
            apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
        });
    }
    return passiveModelInstance;
}

async function processPassiveExtraction(chatId, waId, profileName) {
    try {
        console.log(`  🕵️ Extractor Pasivo analizando conversación de ${profileName}...`);
        
        // Obtenemos los últimos 15 mensajes
        const recentMessages = await prisma.whatsAppMessage.findMany({
            where: { chatId: chatId },
            orderBy: { createdAt: 'desc' },
            take: 15
        });

        if (recentMessages.length === 0) return;

        const chatInfo = await prisma.whatsAppChat.findUnique({
            where: { id: chatId },
            include: { client: { include: { tags: true } } }
        });

        if (!chatInfo || !chatInfo.clientId) return; // Solo funciona si hay cliente registrado

        // Reconstruimos el texto
        const conversationText = recentMessages.reverse().map(m => {
            const role = m.direction === 'OUTBOUND' ? 'Óptica:' : 'Cliente:';
            return `${role} ${m.content || '[Adjunto/Media]'}`;
        }).join('\n');

        const existingTags = chatInfo.client.tags.map(t => t.name).join(', ') || 'Ninguna';

        const prompt = `
Eres un analista invisible de CRM para una óptica. 
Tu trabajo es leer la última parte de una conversación entre el vendedor (Óptica) y el Cliente, y determinar si el cliente mostró un interés CLARO en una de las siguientes categorías de productos que aún no tenga en sus etiquetas actuales.

Categorías principales:
- Multifocal (o multifocales, progresivos)
- Monofocal (o anteojos de cerca, de lejos, simples)
- Armazón (o marco, receta sola)
- Sol (o gafas de sol)
- Lentes de Contacto (o pupilentes)

Etiquetas actuales del cliente: [${existingTags}]

Conversación:
${conversationText}

Responde ÚNICAMENTE con un JSON estrictamente válido que contenga una propiedad "interestTag" con la categoría exacta (con mayúscula inicial). 
Si el cliente no mostró un interés claro, o si ya tiene esa etiqueta, responde {"interestTag": null}.
No incluyas markdown ni explicaciones, solo el JSON puro.
`;

        const model = getPassiveModel();
        const res = await model.invoke([new SystemMessage(prompt)]);
        let resultText = res.content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let parsed;
        try {
            parsed = JSON.parse(resultText);
        } catch(e) {
            console.error("  ❌ Error parseando JSON pasivo:", resultText);
            return;
        }

        if (parsed && parsed.interestTag) {
            console.log(`  🏷️ Interés detectado para ${profileName}: ${parsed.interestTag}`);
            await addTagToClient({ clientId: chatInfo.clientId, tagName: parsed.interestTag });
            // Emitir evento para refrescar UI
            if (global.io) {
                global.io.emit('chat_updated', { chatId });
            }
        } else {
            console.log(`  🕵️ Sin nuevos intereses para ${profileName}.`);
        }

    } catch (err) {
        console.error('  ❌ Error Extractor Pasivo:', err.message);
    }
}

module.exports = { processPassiveExtraction };
