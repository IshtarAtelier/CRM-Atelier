/**
 * Ejecutor Automático de Tareas Inteligentes.
 * Lee las ClientTasks creadas por la Extracción Pasiva que estén vencidas
 * por más de 2 horas y las ejecuta enviando un mensaje automático por WhatsApp.
 */

const { prisma } = require('../db');
const { isBusinessHours } = require('../shared/business-hours');
const { sendFollowUp } = require('./sender');
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { SystemMessage, HumanMessage } = require("@langchain/core/messages");
const { withTimeout } = require('../utils');
const { validateMessage, sanitizeMessage } = require('./message-validator');
const {
    MAX_OUTPUT_TOKENS,
    TEMPERATURE,
    MODEL_NAME,
    GENERATION_TIMEOUT_MS,
    MAX_RETRIES,
} = require('./config');

let isTaskExecutorRunning = false;

// Configuración de Gracia: 2 horas
const GRACE_PERIOD_HOURS = 2;

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

const SYSTEM_PROMPT = 
    "Sos el asistente virtual de Atelier Óptica. Tu único objetivo es escribir un mensaje muy cálido, natural y simpático a través de WhatsApp para cumplir con una TAREA PENDIENTE.\n\n" +
    "DATOS IMPORTANTES DEL LOCAL:\n" +
    "- Dirección: José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba.\n" +
    "- Link de Google Maps: https://www.google.com/search?q=Atelier+Optica+Cordoba\n\n" +
    "REGLAS DE ESCRITURA CRÍTICAS:\n" +
    "1. NUNCA uses el signo de interrogación de apertura (¿). Solo usá el de cierre (?).\n" +
    "2. Usá 'voseo' argentino (ej: 'venite', 'pasate', 'querés', 'mirá').\n" +
    "3. Escribí de forma descontracturada, sin mayúsculas exageradas ni puntuación sumamente rígida.\n" +
    "4. MÁXIMO 40 PALABRAS EN TOTAL. Si tu mensaje tiene más de 40 palabras, reescribilo más corto.\n" +
    "5. Usá 1 o 2 emojis máximo (😊, 📍, 👋). Terminá siempre el mensaje con un emoji o signo de pregunta.\n" +
    "6. PROHIBIDO decir que sos un bot o inteligencia artificial.\n" +
    "7. PROHIBIDO usar lenguaje formal extremo ('estimado', 'quedo a su entera disposición').\n" +
    "8. Respondé ÚNICAMENTE con el texto del mensaje. Sin comillas ni notas extras.";

function formatChatHistory(messages) {
    if (!messages || messages.length === 0) return "(Sin historial reciente)";
    return messages
        .slice()
        .reverse()
        .map(m => `[${m.direction === 'OUTBOUND' ? 'Nosotros' : 'Cliente'}]: ${m.content || '(media)'}`)
        .join('\n');
}

async function generateSmartTaskMessage(client, taskDescription, recentMessages) {
    const model = getModel();

    let userPrompt = `INFORMACIÓN DEL CLIENTE:\n- Nombre: ${client.name || 'Cliente'}\n\n`;
    userPrompt += `TAREA A REALIZAR:\n"${taskDescription}"\n(Redactá un mensaje de WhatsApp que cumpla con esta tarea. Si la tarea pide enviar dirección o ubicación, asegúrate de incluirla).\n\n`;
    userPrompt += `HISTORIAL DE CHAT RECIENTE (para contexto):\n${formatChatHistory(recentMessages)}\n\n`;

    const systemMessage = new SystemMessage(SYSTEM_PROMPT);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            let promptToUse = userPrompt;
            if (attempt > 0) {
                promptToUse += '\n\nIMPORTANTE: Tu intento anterior fue rechazado por ser muy largo o mal formateado. Escribí un mensaje MÁS CORTO y natural. Solo el texto.';
            }

            const response = await withTimeout(
                model.invoke([systemMessage, new HumanMessage(promptToUse)]),
                GENERATION_TIMEOUT_MS,
                'Timeout generando mensaje de smart task'
            );

            let text = response.content.toString().trim();
            text = sanitizeMessage(text);

            if (!text) continue;

            const validation = validateMessage(text);
            if (!validation.valid) {
                console.warn(`  ⚠️ [SmartTaskGen] Rechazado para ${client.name}: ${validation.reason}`);
                continue;
            }

            return { text };

        } catch (err) {
            console.error(`  ❌ [SmartTaskGen] Error Gemini (intento ${attempt + 1}):`, err.message);
            if (attempt === MAX_RETRIES) return { text: null, error: err.message };
        }
    }
    return { text: null, error: 'Intentos agotados' };
}

async function checkAndSendSmartTasks({ isAgentEnabled, botReplyingTo, broadcastChatUpdate }) {
    if (isTaskExecutorRunning) return;

    const now = new Date();
    if (!isBusinessHours(now)) return;
    // Las tareas inteligentes se ejecutan incluso con el asistente global apagado.

    isTaskExecutorRunning = true;
    console.log('\n[Smart Task Executor] Buscando tareas conversacionales atrasadas...');

    try {
        const graceLimit = new Date(now.getTime() - GRACE_PERIOD_HOURS * 60 * 60 * 1000);

        const pendingTasks = await prisma.clientTask.findMany({
            where: {
                type: 'TASK',
                status: 'PENDING',
                createdBy: 'Sistema (Pasivo)',
                dueDate: { lte: graceLimit } // Vencida por más del grace period
            },
            include: {
                client: {
                    include: {
                        whatsappChats: true
                    }
                }
            }
        });

        if (pendingTasks.length === 0) {
            console.log('[Smart Task Executor] No hay tareas inteligentes pendientes y atrasadas.');
            isTaskExecutorRunning = false;
            return;
        }

        let queueDelay = 0;

        for (const task of pendingTasks) {
            const client = task.client;
            if (!client || !client.whatsappChats || client.whatsappChats.length === 0) {
                await cancelTask(task.id);
                continue;
            }

            const chat = client.whatsappChats[0];

            // Validar que el chat siga con bot activado
            if (!chat.botEnabled) {
                console.log(`  🚫 [Smart Task Executor] Tarea cancelada: Bot apagado para ${client.name}`);
                await cancelTask(task.id);
                continue;
            }

            // Validar si hubo actividad reciente (el humano le contestó)
            if (chat.lastMessageAt) {
                // Consideramos que si el humano habló en las últimas 2 horas, tal vez ya cumplió la tarea.
                const hoursSinceActivity = (now.getTime() - new Date(chat.lastMessageAt).getTime()) / 3600000;
                if (hoursSinceActivity < GRACE_PERIOD_HOURS) {
                    console.log(`  🚫 [Smart Task Executor] Cancelada por actividad reciente en el chat de ${client.name}.`);
                    await cancelTask(task.id);
                    continue;
                }
            }

            // Generar Mensaje
            const recentMessages = await prisma.whatsAppMessage.findMany({
                where: { chatId: chat.id },
                orderBy: { createdAt: 'desc' },
                take: 10
            });

            console.log(`  🤖 [Smart Task Executor] Redactando mensaje para tarea de ${client.name}...`);
            const generated = await generateSmartTaskMessage(client, task.description, recentMessages);

            if (!generated.text) {
                console.error(`  ❌ [Smart Task Executor] Falló generación para ${client.name}: ${generated.error}`);
                continue; // Reintentamos la proxima vez
            }

            // Anti-colisión
            if (botReplyingTo && botReplyingTo.has(chat.waId)) {
                console.log(`  ⚠️ Bot activo hablando con ${client.name}. Omitiendo.`);
                continue;
            }

            // Cola de espera
            const delayMin = 1;
            const delayMax = 4;
            const randomDelayMinutes = Math.random() * (delayMax - delayMin) + delayMin;
            queueDelay += randomDelayMinutes * 60 * 1000;

            console.log(`  🕒 [Smart Task Executor] Envío a ${client.name} en ${(queueDelay / 60000).toFixed(1)} min.`);
 
            // Transition status to QUEUED atomically to avoid race condition/duplication
            const updateRes = await prisma.clientTask.updateMany({
                where: { id: task.id, status: 'PENDING' },
                data: { status: 'QUEUED', updatedAt: new Date() }
            }).catch(err => {
                console.error(`Error transitioning smart task ${task.id} to QUEUED:`, err.message);
                return { count: 0 };
            });

            if (updateRes.count === 0) {
                console.log(`  ⚠️ Smart task ${task.id} ya fue tomada o encolada por otro proceso.`);
                continue;
            }

            setTimeout(() => {
                executeSmartTaskAndSend(task.id, client.id, chat.waId, chat.id, generated.text, client.name, task.description)
                    .then(() => { if (broadcastChatUpdate) broadcastChatUpdate(chat.id); })
                    .catch(err => console.error(`❌ Error en smart task a ${client.name}:`, err.message));
            }, queueDelay);
        }

    } catch (error) {
        console.error('❌ Error en Smart Task Executor:', error.message);
    } finally {
        isTaskExecutorRunning = false;
    }
}

async function cancelTask(taskId) {
    await prisma.clientTask.update({
        where: { id: taskId },
        data: { status: 'CANCELLED', updatedAt: new Date() }
    }).catch(e => {});
}

async function executeSmartTaskAndSend(taskId, clientId, waId, chatId, text, clientName, taskDescription) {
    // Label general para estas interacciones
    const label = 'Asistencia Bot';

    const { sent, reason } = await sendFollowUp({
        waId, text, chatId, label, clientName, followUpType: 'SMART_TASK'
    });

    if (sent) {
        await prisma.clientTask.update({
            where: { id: taskId },
            data: { status: 'DONE', updatedAt: new Date() }
        });

        await prisma.interaction.create({
            data: {
                clientId: clientId,
                type: 'FOLLOWUP',
                content: `📍 [BOT] Ejecutó tarea conversacional pendiente.\nTarea: ${taskDescription}\nMensaje: "${text}"`
            }
        });

        console.log(`  ✅ [Smart Task Executor] Éxito para ${clientName}. Tarea cumplida.`);
    } else {
        console.error(`  ❌ [Smart Task Executor] Falló envío a ${clientName}: ${reason}`);
    }
}

module.exports = { checkAndSendSmartTasks };
