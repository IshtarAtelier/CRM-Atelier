/**
 * Ejecutor de Seguimientos Basado en Tareas.
 * Lee las ClientTasks programadas y despacha el mensaje de WhatsApp.
 */

const { prisma } = require('./db');
const { isBusinessHours } = require('./shared/business-hours');
const { checkEligibility } = require('./followups/eligibility');
const { generateFollowUpMessage } = require('./followups/message-generator');
const { sendFollowUp } = require('./followups/sender');
const { addTagToClient } = require('./tools');

let isFollowUpRunning = false;
let botReplyingToRef = null;

async function checkAndSendSalesFollowUps({ isAgentEnabled, botReplyingTo, broadcastChatUpdate }) {
    if (isFollowUpRunning) return;

    botReplyingToRef = botReplyingTo;
    const now = new Date();

    if (!isBusinessHours(now)) return;
    // Las tareas de seguimiento de ventas se ejecutan incluso con el asistente global apagado.

    isFollowUpRunning = true;
    console.log('\n[Bot Executor] Buscando tareas de seguimiento pendientes y vencidas...');

    try {
        // Buscar tareas PENDIENTES que ya vencieron (ej: llegaron las 18:00 hs)
        const pendingTasks = await prisma.clientTask.findMany({
            where: {
                type: 'FOLLOWUP',
                status: 'PENDING',
                dueDate: { lte: now }
            },
            include: {
                client: {
                    include: {
                        whatsappChats: true,
                        tags: true
                    }
                }
            }
        });

        if (pendingTasks.length === 0) {
            console.log('[Bot Executor] No hay tareas de seguimiento pendientes para ejecutar.');
            isFollowUpRunning = false;
            return;
        }

        let queueDelay = 0;

        for (const task of pendingTasks) {
            const client = task.client;
            if (!client || !client.whatsappChats || client.whatsappChats.length === 0) {
                await cancelTask(task.id, 'Cliente sin chat de WhatsApp asociado');
                continue;
            }

            const chat = client.whatsappChats[0];

            // Buscar la cotización más reciente para validar elegibilidad
            const latestQuote = await prisma.order.findFirst({
                where: {
                    clientId: client.id,
                    orderType: 'QUOTE',
                    isDeleted: false,
                },
                orderBy: { createdAt: 'desc' }
            });

            if (!latestQuote) {
                await cancelTask(task.id, 'Presupuesto original eliminado o no encontrado');
                continue;
            }

            // Validar elegibilidad "just-in-time" por si compró desde que se generó la tarea
            const { eligible, followUpType, label, reason } = await checkEligibility({ client, chat, quote: latestQuote, now });

            if (!eligible) {
                console.log(`  🚫 [Bot Executor] Tarea cancelada para ${client.name}: ${reason}`);
                await cancelTask(task.id, `Ya no es elegible: ${reason}`);
                continue;
            }

            // Si es elegible, generamos el mensaje con Gemini
            const recentMessages = await prisma.whatsAppMessage.findMany({
                where: { chatId: chat.id },
                orderBy: { createdAt: 'desc' },
                take: 10
            });

            console.log(`  🤖 [Bot Executor] Generando mensaje para ${client.name} (${followUpType})...`);
            const generated = await generateFollowUpMessage({
                client,
                chat,
                quote: latestQuote,
                followUpType,
                recentMessages
            });

            if (!generated.text) {
                console.error(`  ❌ [Bot Executor] Falló generación para ${client.name}: ${generated.error}`);
                continue; // No cancelamos la tarea, probamos en el próximo ciclo
            }

            // Anti-duplicado in-memory
            if (botReplyingToRef && botReplyingToRef.has(chat.waId)) {
                console.log(`  ⚠️ Bot ya respondiendo a ${client.name}. Omitiendo.`);
                continue;
            }

            // Marcar label INMEDIATAMENTE para evitar race conditions
            try {
                let updatedLabels = [...(chat.chatLabels || [])];
                if (!updatedLabels.includes(label)) updatedLabels.push(label);
                
                await prisma.whatsAppChat.update({
                    where: { id: chat.id },
                    data: { chatLabels: updatedLabels }
                });
            } catch (err) {}

            // Programar el envío diferido en la cola
            const delayMin = 3;
            const delayMax = 7;
            const randomDelayMinutes = Math.random() * (delayMax - delayMin) + delayMin;
            queueDelay += randomDelayMinutes * 60 * 1000;

            console.log(`  🕒 [Bot Executor] Programando envío a ${client.name} en ${(queueDelay / 60000).toFixed(1)} minutos.`);

            // Transition status to QUEUED immediately to avoid race condition/duplication
            await prisma.clientTask.update({
                where: { id: task.id },
                data: { status: 'QUEUED', updatedAt: new Date() }
            }).catch(err => console.error(`Error transitioning task ${task.id} to QUEUED:`, err.message));

            setTimeout(() => {
                executeTaskAndSend(task.id, client.id, chat.waId, chat.id, generated.text, label, client.name, followUpType)
                    .then(() => { if (broadcastChatUpdate) broadcastChatUpdate(chat.id); })
                    .catch(err => console.error(`❌ Error enviando a ${client.name}:`, err.message));
            }, queueDelay);
        }

    } catch (error) {
        console.error('❌ Error en Bot Executor:', error.message);
    } finally {
        isFollowUpRunning = false;
    }
}

// Auxiliares
async function cancelTask(taskId, reason) {
    await prisma.clientTask.update({
        where: { id: taskId },
        data: { status: 'CANCELLED', updatedAt: new Date() } // Usamos CANCELLED (o DONE)
    }).catch(e => {});
}

async function executeTaskAndSend(taskId, clientId, waId, chatId, text, label, clientName, followUpType) {
    // Enviar WhatsApp
    const { sent, reason } = await sendFollowUp({
        waId, text, chatId, label, clientName, followUpType
    });

    if (sent) {
        // 1. Marcar Tarea como DONE
        await prisma.clientTask.update({
            where: { id: taskId },
            data: { status: 'DONE', updatedAt: new Date() }
        });

        // 2. Registrar Interacción en la ficha del cliente
        await prisma.interaction.create({
            data: {
                clientId: clientId,
                type: 'FOLLOWUP',
                content: `📍 [BOT] Tarea de Seguimiento completada (${followUpType}).\nMensaje enviado: "${text}"`
            }
        });

        // 3. Agregar Tag al CRM (Embudo de Etiquetas)
        const funnelTag = `Seguimiento ${followUpType.replace('DIA_', '')}`;
        await addTagToClient({ clientId, tagName: funnelTag }).catch(e=>{});

        console.log(`  ✅ [Bot Executor] Ejecución completa para ${clientName} (${funnelTag})`);
    } else {
        console.error(`  ❌ [Bot Executor] Falló envío a ${clientName}: ${reason}`);
    }
}

module.exports = { checkAndSendSalesFollowUps };
