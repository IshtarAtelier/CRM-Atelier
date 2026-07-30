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
const {
    MAX_TASKS_PER_CYCLE,
    STALE_CLAIM_MINUTES,
    SEND_DELAY_MIN_MINUTES,
    SEND_DELAY_MAX_MINUTES,
} = require('./followups/config');

let isFollowUpRunning = false;
let botReplyingToRef = null;

async function checkAndSendSalesFollowUps({ isAgentEnabled, isFollowupsEnabled, botReplyingTo, broadcastChatUpdate }) {
    if (isFollowUpRunning) return;

    botReplyingToRef = botReplyingTo;
    const now = new Date();

    if (!isBusinessHours(now)) return;

    // Los seguimientos son independientes del asistente conversacional (ese flag
    // decide si el bot CONTESTA), pero respetan su propio interruptor: es el
    // botón de pánico para frenar todo lo saliente sin dejar de atender chats.
    if (isFollowupsEnabled && !isFollowupsEnabled()) {
        console.log('[Bot Executor] Seguimientos apagados desde el CRM. Sin envíos.');
        return;
    }

    isFollowUpRunning = true;
    console.log('\n[Bot Executor] Buscando tareas de seguimiento pendientes y vencidas...');

    try {
        // Tareas vencidas listas para ejecutar, más las que quedaron reclamadas
        // (SENDING) sin resolverse: ésas son envíos que se perdieron cuando el
        // proceso se reinició con el setTimeout todavía en memoria. Recuperarlas
        // es seguro porque checkEligibility vuelve a correr: si el mensaje SÍ
        // había salido, la etiqueta y el cooldown la marcan como no elegible.
        const staleClaimLimit = new Date(now.getTime() - STALE_CLAIM_MINUTES * 60 * 1000);

        const pendingTasks = await prisma.clientTask.findMany({
            where: {
                type: 'FOLLOWUP',
                OR: [
                    { status: 'PENDING', dueDate: { lte: now } },
                    { status: 'SENDING', updatedAt: { lte: staleClaimLimit } },
                ],
            },
            include: {
                client: {
                    include: {
                        // Sin orderBy el chat elegido es arbitrario: los clientes
                        // con dos chats (@c.us y @lid) recibían el mensaje en uno
                        // y la etiqueta en el otro.
                        whatsappChats: { orderBy: { lastMessageAt: 'desc' } },
                        tags: true
                    }
                }
            },
            orderBy: { dueDate: 'asc' },
            take: MAX_TASKS_PER_CYCLE,
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
            const isManual = task.createdBy === 'Bot Trigger';
            const { eligible, followUpType, label, reason } = await checkEligibility({
                client,
                chat,
                quote: latestQuote,
                now,
                isManual,
                taskDescription: task.description
            });

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

            // Reclamar la tarea antes de encolarla.
            //
            // Antes acá se escribía la etiqueta de seguimiento para evitar que el
            // ciclo siguiente reprogramara el mismo envío. El problema: la etiqueta
            // quedaba puesta aunque el mensaje nunca saliera (el envío vive en un
            // setTimeout en memoria y Railway reinicia), y entonces checkEligibility
            // veía la etiqueta y CANCELABA la tarea dando por hecho que se mandó.
            // Así se perdieron 9 de 13 seguimientos.
            //
            // Ahora el candado va sobre la tarea, no sobre el chat: la etiqueta la
            // escribe sender.js recién cuando el mensaje salió de verdad. Si el
            // proceso muere, la tarea queda en SENDING y se vuelve a tomar sola
            // pasados STALE_CLAIM_MINUTES.
            const claimed = await prisma.clientTask.updateMany({
                where: { id: task.id, status: task.status },
                data: { status: 'SENDING', updatedAt: new Date() }
            });
            if (claimed.count === 0) {
                console.log(`  ⚠️ Tarea de ${client.name} ya fue tomada por otra corrida. Omitiendo.`);
                continue;
            }

            // Programar el envío diferido en la cola
            const randomDelayMinutes = Math.random() * (SEND_DELAY_MAX_MINUTES - SEND_DELAY_MIN_MINUTES) + SEND_DELAY_MIN_MINUTES;
            queueDelay += randomDelayMinutes * 60 * 1000;

            console.log(`  🕒 [Bot Executor] Programando envío a ${client.name} en ${(queueDelay / 60000).toFixed(1)} minutos.`);

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
    // Un fallo acá se registra: si la cancelación no se graba, la tarea vuelve a
    // aparecer en la corrida siguiente y el cliente recibe un mensaje que ya se
    // había decidido no mandar. Tragarse el error deja eso invisible.
    await prisma.clientTask.update({
        where: { id: taskId },
        data: { status: 'CANCELLED', updatedAt: new Date() }
    }).catch(e => console.error(`  ❌ No se pudo cancelar la tarea ${taskId} (${reason}):`, e.message));
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
        
        await prisma.clientTask.update({
            where: { id: taskId },
            data: { status: 'FAILED', updatedAt: new Date() }
        }).catch(() => {});

        await prisma.interaction.create({
            data: {
                clientId: clientId,
                type: 'NOTE',
                content: `❌ [BOT] Falló envío de Seguimiento (${followUpType}). Motivo: ${reason}`
            }
        }).catch(() => {});
    }
}

module.exports = { checkAndSendSalesFollowUps };
