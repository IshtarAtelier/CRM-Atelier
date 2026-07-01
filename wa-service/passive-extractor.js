const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage } = require("@langchain/core/messages");
const { prisma } = require('./db');
const { addTagToClient, convertIntoLead, updateClientData, reportInvoiceRequest } = require('./tools');
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
            const dateObj = new Date(m.createdAt);
            const formatter = new Intl.DateTimeFormat('es-AR', {
                timeZone: 'America/Argentina/Cordoba',
                weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const timestamp = `[${formatter.format(dateObj)}]`;
            const role = m.direction === 'OUTBOUND' ? 'Óptica:' : 'Cliente:';
            return `${timestamp} ${role} ${m.content || '[Adjunto/Media]'}`;
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

Your task is to return a strictly valid JSON object with the following fields:
1. "clientName": string or null.
2. "interestTag": string or null.
3. "insurance": string or null.
4. "summary": string or null.
5. "suggestedTask": object or null {"description": string, "dueDate": "YYYY-MM-DD"}.
6. "invoiceRequested": boolean.
7. "shouldPostponeFollowup": boolean. (Set to true if the client explicitly asks to postpone, wait, says they don't have the prescription yet, will have it in a week/few days, is busy and asks to be contacted later, or states they cannot buy/visit until a certain future date like next week, next month, etc.)
8. "postponeUntilDate": "YYYY-MM-DD" or null. (If shouldPostponeFollowup is true, estimate the best future date to resume contact based on their message, e.g. next week = 7 days from now, next month = 30 days from now, or use the specific date they mentioned. Default to 7 days from now if unclear. Today is: ${new Date().toISOString().split('T')[0]}).

Respond ONLY with the raw JSON. No markdown.
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

        if (!currentClientId) {
            console.log("  👤 [Ficha Inteligente] Omitiendo extracción: no existe ficha vinculada (la ficha solo se crea al registrar una receta).");
            return;
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
            
            // Crear Tarea Inteligente si fue detectada
            if (parsed.suggestedTask && parsed.suggestedTask.description) {
                // Check if a similar task already exists for this client (to avoid duplicates in every message)
                const existingTasks = await prisma.clientTask.findMany({
                    where: { 
                        clientId: currentClientId, 
                        status: 'PENDING',
                        description: `[Extracción Inteligente] ${parsed.suggestedTask.description}`
                    }
                });
                
                if (existingTasks.length === 0) {
                    const rawDate = parsed.suggestedTask.dueDate ? new Date(parsed.suggestedTask.dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);
                    // Asegurar que la tarea caiga a las 10:00 AM del día pautado
                    rawDate.setHours(10, 0, 0, 0);

                    console.log(`  📅 [Ficha Inteligente] Creando Tarea: ${parsed.suggestedTask.description}`);
                    await prisma.clientTask.create({
                        data: {
                            clientId: currentClientId,
                            description: `[Extracción Inteligente] ${parsed.suggestedTask.description}`,
                            type: 'TASK',
                            dueDate: rawDate,
                            createdBy: 'Sistema (Pasivo)'
                        }
                    }).catch(e => console.error("Error creando tarea pasiva:", e.message));

                    // Notificar al sistema
                    if (global.io) {
                        global.io.emit('task_created', {
                            clientId: currentClientId,
                            description: `[Extracción Inteligente] ${parsed.suggestedTask.description}`
                        });
                    }
                }
            }

            // Handle postponement request
            if (parsed.shouldPostponeFollowup) {
                console.log(`  ⏱️ [Ficha Inteligente] Solicitud de postergación de seguimiento detectada para ${currentClientId}`);
                
                // 1. Delete all current active followup tasks (to stop active automated sequence)
                await prisma.clientTask.deleteMany({
                    where: {
                        clientId: currentClientId,
                        type: 'FOLLOWUP',
                        status: 'PENDING'
                    }
                }).catch(() => {});

                // 2. Add "Sin Seguimiento" tag to client
                const tag = await prisma.tag.upsert({
                    where: { name: 'Sin Seguimiento' },
                    update: {},
                    create: { name: 'Sin Seguimiento', color: '#ef4444' }
                });
                await prisma.client.update({
                    where: { id: currentClientId },
                    data: {
                        tags: {
                            connect: { id: tag.id }
                        }
                    }
                }).catch(() => {});

                // 3. Update WhatsAppChat labels: remove active followups, set bot to disabled, add SIN_SEGUIMIENTO
                let updatedLabels = [...(chatInfo.chatLabels || [])].filter((l) => !l.startsWith('SEGUIMIENTO_DIA_'));
                if (!updatedLabels.includes('SIN_SEGUIMIENTO')) {
                    updatedLabels.push('SIN_SEGUIMIENTO');
                }
                await prisma.whatsAppChat.update({
                    where: { id: chatId },
                    data: {
                        chatLabels: updatedLabels,
                        botEnabled: false
                    }
                }).catch(() => {});

                // 4. Reschedule a FUTURE follow-up trigger task for the determined date
                const resumeDate = parsed.postponeUntilDate ? new Date(parsed.postponeUntilDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                resumeDate.setHours(11, 0, 0, 0); // Schedule for 11:00 AM

                await prisma.clientTask.create({
                    data: {
                        clientId: currentClientId,
                        description: `[SISTEMA] Reanudación Automática de Seguimientos`,
                        type: 'TASK',
                        status: 'PENDING',
                        dueDate: resumeDate,
                        createdBy: 'Bot Trigger'
                    }
                }).catch(() => {});

                // 5. Create a calendar follow-up task for the SALESPERSON (humano)
                const humanTaskDescription = `[Seguimiento Manual] Contactar a ${chatInfo.client?.name || 'cliente'} - Razón: "${parsed.summary || 'Postergación detectada'}"`;
                await prisma.clientTask.create({
                    data: {
                        clientId: currentClientId,
                        description: humanTaskDescription,
                        type: 'TASK',
                        status: 'PENDING',
                        dueDate: resumeDate,
                        createdBy: 'Sistema (Pasivo)'
                    }
                }).catch((e) => console.error("Error creating human task:", e.message));

                console.log(`  ✅ [Ficha Inteligente] Proactive followups paused. Rescheduled resume task and created human task for ${resumeDate.toLocaleDateString()}`);
            }
        }

        // 3. Evaluar si pidió Factura
        if (parsed.invoiceRequested) {
            console.log(`  🚨 [Ficha Inteligente] Solicitud de Factura detectada para ${currentClientId}`);
            await reportInvoiceRequest({ clientId: currentClientId });
        }

        // 4. Actualizar el chatSummary (PROTEGIDO: no sobreescribir resúmenes ricos del agente)
        if (parsed.summary) {
            const existingSummary = chatInfo.chatSummary || '';
            
            if (!existingSummary || existingSummary.trim().length === 0) {
                // No hay resumen previo → escribir el nuevo
                console.log(`  📝 [Ficha Inteligente] Creando resumen inicial del chat.`);
                await prisma.whatsAppChat.update({
                    where: { id: chatId },
                    data: { chatSummary: parsed.summary }
                }).catch(e => console.error("Error update chatSummary pasivo:", e.message));
            } else if (parsed.summary.length > existingSummary.length * 1.5) {
                // El nuevo resumen es significativamente más completo → reemplazar
                console.log(`  📝 [Ficha Inteligente] Actualizando resumen del chat (más completo que el anterior).`);
                await prisma.whatsAppChat.update({
                    where: { id: chatId },
                    data: { chatSummary: parsed.summary }
                }).catch(e => console.error("Error update chatSummary pasivo:", e.message));
            } else {
                // Ya existe un resumen (probablemente del agente, más rico) → NO sobreescribir
                console.log(`  📝 [Ficha Inteligente] Resumen existente preservado (${existingSummary.length} chars). Extractor pasivo NO sobreescribe.`);
            }
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
