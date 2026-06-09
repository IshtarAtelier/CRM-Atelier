const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage } = require("@langchain/core/messages");
const { prisma } = require('./db');
const { addTagToClient, convertIntoLead, updateClientData } = require('./tools');
const { withTimeout } = require('./utils');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let passiveModelInstance = null;

function getPassiveModel() {
    if (!passiveModelInstance) {
        passiveModelInstance = new ChatGoogleGenerativeAI({
            model: 'gemini-2.5-flash',
            maxOutputTokens: 500,
            temperature: 0.1,
            apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
        });
    }
    return passiveModelInstance;
}

async function processPassiveExtraction(chatId, waId, profileName) {
    try {
        console.log(`  🕵️ Extractor Pasivo analizando conversación de ${profileName || waId}...`);
        
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

        if (!chatInfo) return; 

        // Reconstruimos el texto
        const conversationText = recentMessages.reverse().map(m => {
            const role = m.direction === 'OUTBOUND' ? 'Óptica:' : 'Cliente:';
            return `${role} ${m.content || '[Adjunto/Media]'}`;
        }).join('\n');

        const isKnownClient = !!chatInfo.clientId;
        const existingTags = isKnownClient && chatInfo.client && chatInfo.client.tags ? chatInfo.client.tags.map(t => t.name).join(', ') : 'Ninguna';
        const clientNameHint = profileName ? `Nombre de perfil de WA: ${profileName}` : 'Desconocido';

        const prompt = `
Eres un analista invisible de CRM para una óptica. Tu trabajo es leer la última parte de una conversación entre el vendedor (Óptica) y el Cliente y armar una "Ficha Inteligente".
Esta extracción ocurre silenciosamente.

Información actual:
- ¿El cliente ya está en la base de datos?: ${isKnownClient ? 'SÍ' : 'NO'}
- ${clientNameHint}
- Etiquetas actuales: [${existingTags}]

Conversación reciente:
${conversationText}

Tu tarea es devolver un JSON estrictamente válido con los siguientes campos:
1. "clientName": string o null. (Si el cliente NO está en la base, intenta extraer su nombre real de la conversación. Si no dice su nombre pero el perfil de WA tiene un nombre humano coherente, úsalo. Si es puramente anónimo, null).
2. "interestTag": string o null. (Si el cliente mostró interés en "Multifocal", "Monofocal", "Armazón", "Sol", "Lentes de Contacto". Solo si es nuevo y no está en sus etiquetas actuales).
3. "insurance": string o null. (Si mencionó su obra social o prepaga, ej: "OSDE", "Galeno", "PAMI").
4. "summary": string o null. (Un breve resumen de 1 o 2 oraciones sobre lo que el cliente quiere o el estado actual de la charla, para actualizar el historial. Si no hay nada relevante, null).

Responde ÚNICAMENTE con el JSON puro. Sin markdown.
`;

        const model = getPassiveModel();
        const res = await withTimeout(
            model.invoke([new HumanMessage(prompt)]),
            30000,
            'Gemini passive extractor timeout'
        );
        
        let resultText = res.content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let parsed;
        try {
            parsed = JSON.parse(resultText);
        } catch(e) {
            console.error("  ❌ Error parseando JSON pasivo:", resultText);
            return;
        }

        let currentClientId = chatInfo.clientId;

        // 1. Crear Lead si no existe y detectó nombre
        if (!currentClientId && parsed.clientName) {
            console.log(`  👤 [Ficha Inteligente] Creando nuevo cliente: ${parsed.clientName}`);
            const leadResult = await convertIntoLead({
                phone: chatInfo.realPhone || waId.split('@')[0],
                name: parsed.clientName,
                contactSource: 'WhatsApp',
                interest: parsed.interestTag || 'Otros',
                insurance: parsed.insurance || null,
                chatId: chatId
            });
            if (leadResult && leadResult.contact) {
                currentClientId = leadResult.contact.id;
                
                // Notificar frontend
                if (global.io) {
                    global.io.emit('lead_created', {
                        id: currentClientId,
                        name: parsed.clientName,
                        phone: chatInfo.realPhone || waId.split('@')[0],
                        interest: parsed.interestTag || 'No especificado',
                        source: 'WhatsApp'
                    });
                }
            }
        }

        // 2. Si ya hay cliente (o se acaba de crear), actualizar datos
        if (currentClientId) {
            // Actualizar Obra Social si fue detectada
            if (parsed.insurance) {
                console.log(`  🏥 [Ficha Inteligente] Actualizando Obra Social a: ${parsed.insurance}`);
                await updateClientData({ id: currentClientId, insurance: parsed.insurance }).catch(e => console.error("Error updateClientData pasivo:", e.message));
            }

            // Agregar Tag si fue detectado
            if (parsed.interestTag) {
                console.log(`  🏷️ [Ficha Inteligente] Interés detectado: ${parsed.interestTag}`);
                await addTagToClient({ clientId: currentClientId, tagName: parsed.interestTag }).catch(e => console.error("Error addTagToClient pasivo:", e.message));
            }
        }

        // 3. Actualizar el chatSummary
        if (parsed.summary) {
            console.log(`  📝 [Ficha Inteligente] Actualizando resumen del chat.`);
            await prisma.whatsAppChat.update({
                where: { id: chatId },
                data: { chatSummary: parsed.summary }
            }).catch(e => console.error("Error update chatSummary pasivo:", e.message));
        }

        // Emitir evento para refrescar UI
        if (global.io) {
            global.io.emit('chat_updated', { chatId });
        }

    } catch (err) {
        console.error('  ❌ Error Extractor Pasivo:', err.message);
    }
}

module.exports = { processPassiveExtraction };
