/**
 * Ejecutor Automático de Tareas Inteligentes.
 * Lee las ClientTasks creadas por la Extracción Pasiva que estén vencidas
 * por más de 2 horas y las ejecuta enviando un mensaje automático por WhatsApp.
 */

const { prisma } = require('../db');
const { contenidoATexto } = require('../shared/ai-content');
const { isBusinessHours } = require('../shared/business-hours');
const { sendFollowUp } = require('./sender');
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { SystemMessage, HumanMessage } = require("@langchain/core/messages");
const { withTimeout } = require('../utils');
const { evaluateConversationGate, applyCancelVerdict } = require('./conversation-gate');
const { validateMessage, sanitizeMessage } = require('./message-validator');
const {
    MAX_OUTPUT_TOKENS,
    TEMPERATURE,
    MODEL_NAME,
    GENERATION_TIMEOUT_MS,
    MAX_RETRIES,
    MAX_TASKS_PER_CYCLE,
    AUTO_SENDABLE_TASK_PREFIXES,
    AUTO_SENDABLE_TASK_CREATORS,
    STALE_CLAIM_MINUTES,
    SEND_DELAY_MIN_MINUTES,
    SEND_DELAY_MAX_MINUTES,
    CIERRE_TIENDA,
    LINK_TIENDA,
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
    "Sos Matías, de Atelier Óptica. Escribís un mensaje de WhatsApp para cumplir con una TAREA PENDIENTE, y debe parecer escrito A MANO por vos, una persona real. 100% humano.\n\n" +
    "REGLA DE ORO: usá el nombre de pila del cliente y, si el historial lo permite, retomá un detalle concreto de la conversación. PROHIBIDO el tono de campaña o plantilla: nada de 'oferta especial', 'promoción exclusiva', 'imperdible', 'estimado/a'. Nunca repitas frases que ya aparezcan en el historial.\n\n" +
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
    "8. Respondé ÚNICAMENTE con el texto del mensaje. Sin comillas ni notas extras.\n" +
    "9. PROHIBIDO presentarte de nuevo ('soy Matías', 'te habla Matías'): el cliente ya te conoce de la charla previa. JAMÁS uses apellidos ni títulos profesionales (óptico, contactólogo, ejecutivo de cuentas).\n" +
    "10. MÁXIMO UNA pregunta por mensaje, y JAMÁS le pidas ningún dato (nombre, teléfono, DNI, email).";

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

    const rawFirstName = ((client.name || '').trim().split(/\s+/)[0]) || '';
    const hasValidName = /^[a-záéíóúüñ]{2,20}$/i.test(rawFirstName) && rawFirstName.toLowerCase() !== 'cliente';
    let userPrompt = `INFORMACIÓN DEL CLIENTE:\n- Nombre: ${hasValidName ? rawFirstName : '(no lo tenemos: escribí sin nombre, NO lo inventes ni uses genéricos como "Cliente")'}\n\n`;
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

            let text = contenidoATexto(response.content).trim();
            text = sanitizeMessage(text);

            if (!text) continue;

            const validation = validateMessage(text);
            if (!validation.valid) {
                console.warn(`  ⚠️ [SmartTaskGen] Rechazado para ${client.name}: ${validation.reason}`);
                continue;
            }

            // El link a la tienda se pega DESPUÉS de validar, no se le pide al
            // modelo: una URL dentro del prompt vuelve deformada seguido (sin la
            // barra, con un punto pegado al final, con otro dominio), y un link
            // roto en un mensaje comercial es peor que no mandar ninguno.
            // Si el propio mensaje ya mandó un link nuestro, no se duplica.
            const yaTieneLink = text.includes('atelieroptica.com.ar');
            return { text: yaTieneLink ? text : text + CIERRE_TIENDA };

        } catch (err) {
            console.error(`  ❌ [SmartTaskGen] Error Gemini (intento ${attempt + 1}):`, err.message);
            if (attempt === MAX_RETRIES) return { text: null, error: err.message };
        }
    }
    return { text: null, error: 'Intentos agotados' };
}

async function checkAndSendSmartTasks({ isAgentEnabled, isFollowupsEnabled, botReplyingTo, broadcastChatUpdate }) {
    if (isTaskExecutorRunning) return;

    const now = new Date();
    if (!isBusinessHours(now)) return;

    // Las tareas inteligentes son independientes del asistente conversacional
    // (ese flag decide si el bot CONTESTA, no si mandamos seguimientos), pero sí
    // respetan el interruptor propio de seguimientos: es el botón de pánico para
    // frenar todo lo saliente sin apagar el bot que atiende a los clientes.
    if (isFollowupsEnabled && !isFollowupsEnabled()) {
        console.log('[Smart Task Executor] Seguimientos apagados desde el CRM. Sin envíos.');
        return;
    }

    isTaskExecutorRunning = true;
    console.log('\n[Smart Task Executor] Buscando tareas conversacionales atrasadas...');

    try {
        const graceLimit = new Date(now.getTime() - GRACE_PERIOD_HOURS * 60 * 60 * 1000);

        // Igual que en sales-followups: además de las vencidas normales se
        // recuperan las que quedaron reclamadas (SENDING) por un reinicio con el
        // timer en memoria.
        const staleClaimLimit = new Date(now.getTime() - STALE_CLAIM_MINUTES * 60 * 1000);

        const pendingTasks = await prisma.clientTask.findMany({
            where: {
                type: 'TASK',
                // Doble lista blanca: quién creó la tarea Y con qué prefijo.
                // Sin esto entran notas internas del equipo ([RECETA POR FOTO],
                // [Seguimiento Manual]) y el cliente recibe un mensaje redactado
                // a partir de una instrucción que era para nosotros.
                createdBy: { in: AUTO_SENDABLE_TASK_CREATORS },
                // Prisma no tiene "startsWith con cualquiera de estos": se arma
                // como OR. Va dentro de AND para no chocar con el OR de estado.
                AND: [
                    { OR: AUTO_SENDABLE_TASK_PREFIXES.map((p) => ({ description: { startsWith: p } })) },
                ],
                OR: [
                    { status: 'PENDING', dueDate: { lte: graceLimit } },
                    { status: 'SENDING', updatedAt: { lte: staleClaimLimit } },
                ],
            },
            include: {
                client: {
                    include: {
                        // Sin orderBy, Postgres devuelve los chats en orden
                        // arbitrario: con dos chats (@c.us y @lid) el mensaje
                        // podía ir a uno y la etiqueta al otro.
                        whatsappChats: { orderBy: { lastMessageAt: 'desc' } }
                    }
                }
            },
            orderBy: { dueDate: 'asc' },
            take: MAX_TASKS_PER_CYCLE,
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

            // OJO: acá NO se cancela por `botEnabled`. Ese flag dice si el
            // AGENTE contesta en la charla y se apaga solo apenas responde una
            // persona — o sea, en casi todos los chats con presupuesto. Cancelar
            // por eso es lo que dejó 9 de las 13 tareas históricas en CANCELLED
            // sin que saliera un solo seguimiento. El corte por conversación es
            // la etiqueta SIN_SEGUIMIENTO, que valida el sender antes de enviar.

            // Pausa cruzada puesta por la compuerta o por otro sistema
            // ("hablamos a fin de mes"): sin gastar una llamada de LLM.
            //
            // La tarea se corre hasta que termina la pausa, y ESO ES LO QUE
            // IMPORTA. Con un `continue` pelado se quedaba clavada al frente de
            // la cola: como el lote se arma con `orderBy: dueDate asc` y se
            // toman MAX_TASKS_PER_CYCLE, seis tareas de chats pausados ocupaban
            // los seis lugares, se salteaban, y el ciclo siguiente volvía a
            // tomar exactamente las mismas seis. La cola nunca llegaba a la
            // séptima. Medido en producción el 10/8/2026: 4 enviadas de 934,
            // con 698 elegibles esperando y 66 chats pausados tapando la boca.
            // Todos los demás caminos de salteo de este archivo ya empujan el
            // vencimiento por esta misma razón; este era el que faltaba.
            if (chat.followUpPausedUntil && new Date(chat.followUpPausedUntil) > now) {
                await prisma.clientTask.updateMany({
                    where: { id: task.id, status: task.status },
                    data: { dueDate: new Date(chat.followUpPausedUntil) },
                }).catch(() => {});
                continue;
            }

            // Validar si es un contacto frío (debe tener al menos un mensaje entrante registrado)
            const inboundCount = await prisma.whatsAppMessage.count({
                where: {
                    chatId: chat.id,
                    direction: 'INBOUND',
                },
            });
            if (inboundCount === 0) {
                console.log(`  🚫 [Smart Task Executor] Tarea cancelada: ${client.name} es un contacto frío (sin mensajes entrantes).`);
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
                take: 15
            });

            // Compuerta de conversación: si el cliente ya dijo que no, la tarea
            // pendiente no justifica escribirle igual.
            const gate = await evaluateConversationGate({
                chat,
                recentMessages,
                context: `Tarea conversacional pendiente: ${task.description}`,
            });
            if (gate.decision === 'CANCEL') {
                await applyCancelVerdict({ chat, clientId: client.id, clientName: client.name, verdict: gate });
                await cancelTask(task.id);
                continue;
            }
            if (gate.decision === 'POSTPONE') {
                const days = gate.postponeDays || 7;
                // updateMany con guarda: no resucitar una tarea cancelada en el medio.
                await prisma.clientTask.updateMany({
                    where: { id: task.id, status: task.status },
                    data: { dueDate: new Date(now.getTime() + days * 24 * 3600 * 1000), status: 'PENDING' }
                }).catch(() => {});
                // Pausa cruzada: frena también inactividad y tiers para el chat.
                await prisma.whatsAppChat.update({
                    where: { id: chat.id },
                    data: { followUpPausedUntil: new Date(now.getTime() + days * 24 * 3600 * 1000) }
                }).catch(() => {});
                console.log(`  ⏸️ [Gate] Tarea de ${client.name} pospuesta ${days} días: ${gate.reason}`);
                continue;
            }
            if (gate.decision === 'SKIP') {
                // +2h para no re-consultar a la compuerta cada ciclo mientras la
                // situación no cambia.
                await prisma.clientTask.updateMany({
                    where: { id: task.id, status: task.status },
                    data: { dueDate: new Date(now.getTime() + 2 * 3600 * 1000), status: 'PENDING' }
                }).catch(() => {});
                console.log(`  ⏭️ [Gate] Tarea de ${client.name} salteada 2hs: ${gate.reason}`);
                continue;
            }

            console.log(`  🤖 [Smart Task Executor] Redactando mensaje para tarea de ${client.name}...`);
            const generated = await generateSmartTaskMessage(client, task.description, recentMessages);

            if (!generated.text) {
                console.error(`  ❌ [Smart Task Executor] Falló generación para ${client.name}: ${generated.error}`);
                // Empujar el vencimiento 3 horas y volver a PENDING con guarda:
                // una tarea cuya generación falla siempre no puede quedarse
                // clavada al frente de la cola, y una SENDING recuperada sin el
                // reset de status quedaba zombie.
                await prisma.clientTask.updateMany({
                    where: { id: task.id, status: task.status },
                    data: { dueDate: new Date(now.getTime() + 3 * 3600 * 1000), status: 'PENDING' }
                }).catch(() => {});
                continue;
            }

            // Anti-colisión: el bot está contestando en ese chat ahora mismo.
            // Se corre 15 minutos por lo mismo que la pausa de arriba — es una
            // espera corta, pero si no se empuja el vencimiento la tarea vuelve
            // a salir primera en el próximo ciclo y le come el lugar a otra.
            if (botReplyingTo && botReplyingTo.has(chat.waId)) {
                console.log(`  ⚠️ Bot activo hablando con ${client.name}. Omitiendo 15 min.`);
                await prisma.clientTask.updateMany({
                    where: { id: task.id, status: task.status },
                    data: { dueDate: new Date(now.getTime() + 15 * 60 * 1000) },
                }).catch(() => {});
                continue;
            }

            // Reclamo atómico (mismo patrón que sales-followups). El claimStamp
            // viaja hasta el preflight de la cola anti-ban: en el momento del
            // envío físico se verifica que la tarea siga SENDING con ESTE
            // updatedAt — un timer viejo nunca puede pisar a uno nuevo.
            const claimStamp = new Date();
            const claimed = await prisma.clientTask.updateMany({
                where: { id: task.id, status: task.status },
                data: { status: 'SENDING', updatedAt: claimStamp }
            });
            if (claimed.count === 0) {
                console.log(`  ⚠️ Tarea de ${client.name} ya fue tomada por otra corrida. Omitiendo.`);
                continue;
            }

            // Cola de espera
            const randomDelayMinutes = Math.random() * (SEND_DELAY_MAX_MINUTES - SEND_DELAY_MIN_MINUTES) + SEND_DELAY_MIN_MINUTES;
            queueDelay += randomDelayMinutes * 60 * 1000;

            console.log(`  🕒 [Smart Task Executor] Envío a ${client.name} en ${(queueDelay / 60000).toFixed(1)} min.`);

            setTimeout(() => {
                executeSmartTaskAndSend(task.id, client.id, chat.waId, chat.id, generated.text, client.name, task.description, claimStamp)
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

async function executeSmartTaskAndSend(taskId, clientId, waId, chatId, text, clientName, taskDescription, claimStamp) {
    // Label general para estas interacciones
    const label = 'Asistencia Bot';

    const { sent, reason } = await sendFollowUp({
        waId, text, chatId, label, clientName, followUpType: 'SMART_TASK',
        claim: { taskId, claimStamp }
    });

    if (sent) {
        // DONE solo si la tarea sigue SENDING: no pisar un CANCELLED que otra
        // corrida (o la compuerta) haya puesto mientras el envío esperaba en cola.
        const done = await prisma.clientTask.updateMany({
            where: { id: taskId, status: 'SENDING' },
            data: { status: 'DONE', updatedAt: new Date() }
        });
        if (done.count === 0) {
            console.warn(`  ⚠️ [Smart Task Executor] Mensaje a ${clientName} salió pero la tarea ya no estaba en SENDING. No se pisa su estado.`);
        }

        await prisma.interaction.create({
            data: {
                clientId: clientId,
                type: 'FOLLOWUP',
                // Firmada: la regla de trazabilidad del proyecto pide que toda
                // mutación de negocio diga quién la hizo, y esta salía sin
                // userName. En la ficha del cliente la interacción aparecía sin
                // autor, como si la hubiera escrito nadie.
                userName: 'Bot',
                content: `📍 [BOT] Ejecutó tarea conversacional pendiente.\nTarea: ${taskDescription}\nMensaje: "${text}"`
            }
        });

        console.log(`  ✅ [Smart Task Executor] Éxito para ${clientName}. Tarea cumplida.`);
    } else {
        const wasPreflight = (reason || '').startsWith('Preflight:');
        console.error(`  ${wasPreflight ? '🚦' : '❌'} [Smart Task Executor] Envío a ${clientName} no realizado: ${reason}`);

        if (!wasPreflight) {
            await prisma.clientTask.updateMany({
                where: { id: taskId, status: 'SENDING' },
                data: { status: 'FAILED', updatedAt: new Date() }
            }).catch(() => {});

            await prisma.interaction.create({
                data: {
                    clientId: clientId,
                    type: 'NOTE',
                    content: `❌ [BOT] Falló envío de Tarea Inteligente (${taskDescription}). Motivo: ${reason}`
                }
            }).catch(() => {});
        }
    }
}

module.exports = { checkAndSendSmartTasks };
