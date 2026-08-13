/**
 * Módulo de seguimiento por inactividad del cliente.
 * Envía un recordatorio automático si el bot respondió hace más de 24 horas
 * y el cliente no contestó.
 * 
 * DEDUP: Usa lastFollowUpAt en la DB para no enviar más de 1 follow-up cada 24hs.
 * EXCLUSIÓN MUTUA: Respeta etiquetas de sales-followups.
 */
const { prisma } = require('../db');
const { evaluarElegibilidad } = require('../followups/politica');
const { sendMessage, sendTypingState } = require('../whatsapp/client');
const { isBusinessHours } = require('../shared/business-hours');
const { ALL_FOLLOWUP_LABELS } = require('../followups/config');
const { generateFollowUpMessage } = require('../followups/message-generator');
const { evaluateConversationGate, applyCancelVerdict } = require('../followups/conversation-gate');
const { runOutputGuardrail } = require('../services/ai.service');
const { resolveWaMessageId, rememberBotMessage } = require('../shared/message-id');

// Pool de variantes de RESPALDO: solo se usa si la generación personalizada falla.
// Reglas: una sola pregunta por mensaje, sin referencias temporales fijas ("ayer"),
// sin empujar el cierre/seña — solo sondear.
const FOLLOW_UP_TEXT_VARIANTS = [
    "Hola! Te escribo para saber si te quedó alguna duda o si querés que sigamos viendo opciones 😊",
    "Buenas! Te escribo para ver si pudiste revisar la info sobre los armazones o lentes 👍",
    "Hola! Quería saber si tenías alguna consulta sobre el presupuesto o si querés que busquemos otras alternativas de cristales 👓",
    "Hola! Pudiste ver las opciones que te pasé? Si buscabas algo un poco más económico también vemos alternativas 👓",
    "Hola! Espero que estés bien. Te quedó alguna duda pendiente de lo que estuvimos charlando de los lentes? 😊"
];

// Variantes viejas ya enviadas en chats: se mantienen solo para el dedup
// (si el último mensaje del chat es una de estas, no mandar otro follow-up).
const FOLLOW_UP_TEXT_VARIANTS_LEGACY = [
    "Buenas! Cómo estás? Te escribo para ver si pudiste revisar la info y si te quedó alguna consulta sobre los armazones o lentes 👍",
    "Hola! Qué tal? Pudiste ver las opciones que te pasé? Contame qué te parecieron, o si buscabas algo un poco más económico y vemos alternativas 👓",
    "Hola! Espero que estés bien. Te quedó alguna duda pendiente de lo que charlamos ayer o querés coordinar los lentes? 😊"
];
const ALL_FOLLOW_UP_VARIANTS = [...FOLLOW_UP_TEXT_VARIANTS, ...FOLLOW_UP_TEXT_VARIANTS_LEGACY];

// Cooldown mínimo entre follow-ups para el mismo chat (48 horas según políticas anti-ban)
const FOLLOW_UP_COOLDOWN_MS = 48 * 60 * 60 * 1000;

// Tope de recordatorios por ciclo. Sin tope, una mañana de lunes con 30 chats
// elegibles acumulados del fin de semana generaba una ráfaga — el patrón de
// spam más detectable que existe para una cuenta personal.
const MAX_INACTIVITY_PER_CYCLE = 5;

// Guarda de reentrada: el intervalo es de 15 min pero el ciclo espera los
// envíos de la cola anti-ban (45-90s + pausas de lote cada uno), así que una
// corrida puede durar MÁS que el intervalo. Sin esta guarda, la corrida
// siguiente re-procesaba los mismos chats y duplicaba recordatorios x4-5.
let isInactivityRunning = false;

/**
 * Chequea y envía follow-ups por inactividad.
 * @param {Object} deps - Dependencias inyectadas
 * @param {Function} deps.isAgentEnabled - Función que retorna si el agente está habilitado
 * @param {Function} deps.isFollowupsEnabled - Función que retorna si los seguimientos están habilitados
 * @param {Set} deps.botReplyingTo - Set de waIds activos
 * @param {Function} deps.broadcastChatUpdate - Emite actualización de chat por WebSocket
 */
async function checkAndSendInactivityFollowUps({ isAgentEnabled, isFollowupsEnabled, botReplyingTo, broadcastChatUpdate }) {
    if (isInactivityRunning) return;

    const now = new Date();
    if (!isBusinessHours(now)) {
        return;
    }

    // Los recordatorios por inactividad siguen siendo independientes del asistente
    // conversacional: ese flag decide si el bot CONTESTA, no si retomamos una
    // charla que quedó colgada. Pero respetan el interruptor propio de
    // seguimientos, que es el botón de pánico para frenar todo lo saliente.
    if (isFollowupsEnabled && !isFollowupsEnabled()) {
        console.log('[Inactividad] Seguimientos apagados desde el CRM. Sin envíos.');
        return;
    }

    isInactivityRunning = true;
    let sentThisCycle = 0;
    try {

    const activeChats = await prisma.whatsAppChat.findMany({
        where: {
            botEnabled: true,
            archived: false,
            // Pausa puesta por la compuerta ("hablamos a fin de mes") o por un
            // SKIP previo: persistente, no depende de la memoria del proceso.
            OR: [
                { followUpPausedUntil: null },
                { followUpPausedUntil: { lte: now } },
            ],
        },
        include: {
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1
            }
        }
    });

    for (const chat of activeChats) {
        if (sentThisCycle >= MAX_INACTIVITY_PER_CYCLE) {
            console.log(`[Inactividad] Tope de ${MAX_INACTIVITY_PER_CYCLE} recordatorios por ciclo alcanzado. El resto espera al próximo.`);
            break;
        }
        if (chat.messages.length === 0) continue;
        const lastMsg = chat.messages[0];

        // Solo actuar si el último mensaje fue del Bot (outbound)
        if (lastMsg.direction === 'OUTBOUND' && lastMsg.senderName === 'Bot') {
            // DEDUP #1: Si el último mensaje ya es un follow-up de nuestro pool, saltar
            if (ALL_FOLLOW_UP_VARIANTS.includes(lastMsg.content)) {
                continue;
            }

            // EXCLUSIÓN MUTUA: Si sales-followups ya está gestionando este chat, no enviar
            if (chat.chatLabels && ALL_FOLLOWUP_LABELS.some(label => chat.chatLabels.includes(label))) {
                continue;
            }

            // El resto de los filtros los decide la POLÍTICA — hasta ahora este
            // cron era el único camino que enviaba SIN pasar por ninguno de los
            // controles comunes, con su propio cooldown (48hs escrito acá) y su
            // propia idea de "ya compró" (órdenes de los últimos 7 días). Ahora
            // hereda las mismas reglas que todo lo demás, incluida la señal de
            // convertido, que este flujo no miraba.
            //
            // La ventana de actividad va en 0: el disparador de este cron ES la
            // inactividad del chat, y se mide más abajo contra el último mensaje.
            const cliente = chat.clientId
                ? await prisma.client.findUnique({
                    where: { id: chat.clientId },
                    select: { id: true, name: true, status: true, tags: { select: { name: true } } },
                })
                : null;

            const veredicto = await evaluarElegibilidad({
                client: cliente || { id: chat.id, name: chat.profileName || chat.waId, tags: [] },
                chat, now,
                cooldownHoras: FOLLOW_UP_COOLDOWN_MS / 3600000,
                actividadHoras: 0,
                desde: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
                exigirEntrante: false,
            });
            if (!veredicto.ok) continue;

            const diffMs = now.getTime() - new Date(lastMsg.createdAt).getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours >= 24) {
                console.log(`  ✉️ [Follow-Up] Enviando recordatorio por inactividad de ${diffHours.toFixed(1)}hs a ${chat.profileName || chat.waId}`);
                
                try {
                    botReplyingTo.add(chat.waId);

                    const recentMessages = await prisma.whatsAppMessage.findMany({
                        where: { chatId: chat.id },
                        orderBy: { createdAt: 'desc' },
                        take: 15
                    });

                    // Compuerta de conversación. Caso típico que tapa: el cliente
                    // dijo "no me interesa", el bot respondió "ok, cualquier cosa
                    // avisame" → el último mensaje es nuestro y este cron lo
                    // perseguía igual a las 24hs.
                    const gate = await evaluateConversationGate({
                        chat,
                        recentMessages,
                        context: 'Recordatorio por inactividad (el cliente no respondió el último mensaje)',
                    });
                    if (gate.decision === 'CANCEL') {
                        await applyCancelVerdict({ chat, clientId: chat.clientId, clientName: chat.profileName, verdict: gate });
                        continue;
                    }
                    if (gate.decision !== 'SEND') {
                        // Persistir el veredicto: POSTPONE respeta la fecha que
                        // pidió el cliente; SKIP re-evalúa en 2hs. Antes esto no
                        // se guardaba y el LLM re-juzgaba el mismo chat cada 15
                        // minutos, y un "hablamos a fin de mes" moría en el
                        // primer reinicio.
                        const pauseMs = gate.decision === 'POSTPONE'
                            ? (gate.postponeDays || 7) * 24 * 3600 * 1000
                            : 2 * 3600 * 1000;
                        await prisma.whatsAppChat.update({
                            where: { id: chat.id },
                            data: { followUpPausedUntil: new Date(now.getTime() + pauseMs) }
                        }).catch(() => {});
                        console.log(`  ${gate.decision === 'POSTPONE' ? '⏸️' : '⏭️'} [Gate] Inactividad de ${chat.profileName || chat.waId} pausada ${(pauseMs / 3600000).toFixed(0)}hs: ${gate.reason}`);
                        continue;
                    }

                    // Generar un mensaje 100% personalizado que retome la charla donde quedó
                    let selectedText = null;
                    try {
                        const generated = await generateFollowUpMessage({
                            client: { name: chat.profileName || null },
                            chat,
                            quote: null,
                            followUpType: 'INACTIVIDAD',
                            recentMessages,
                            gateHint: gate.adaptHint
                        });
                        selectedText = generated.text;
                    } catch (genErr) {
                        console.warn(`  ⚠️ [Follow-Up] Falló generación personalizada para ${chat.profileName || chat.waId}: ${genErr.message}`);
                    }

                    // Respaldo: variante del pool (evitando repetir una ya enviada en este chat)
                    if (!selectedText) {
                        const previousContents = (await prisma.whatsAppMessage.findMany({
                            where: { chatId: chat.id, direction: 'OUTBOUND' },
                            orderBy: { createdAt: 'desc' },
                            take: 15
                        })).map(m => m.content);
                        const unused = FOLLOW_UP_TEXT_VARIANTS.filter(v => !previousContents.includes(v));
                        const pool = unused.length > 0 ? unused : FOLLOW_UP_TEXT_VARIANTS;
                        selectedText = pool[Math.floor(Math.random() * pool.length)];
                    }

                    // Guardrail de salida: mismo filtro final que el bot conversacional
                    const guardrail = runOutputGuardrail(selectedText);
                    if (!guardrail.safe) {
                        console.warn(`  🚫 [Follow-Up] Bloqueado por guardrail (${guardrail.reason}) para ${chat.profileName || chat.waId}: "${selectedText.substring(0, 80)}"`);
                        continue;
                    }

                    // Reclamo ANTES de encolar: si esta corrida se solapa con la
                    // siguiente (la cola anti-ban puede demorar más que los 15
                    // min del intervalo), el cooldown ya está tomado y el chat no
                    // se re-procesa. Si el envío después se descarta, se pierde
                    // un recordatorio — mejor eso que un duplicado.
                    await prisma.whatsAppChat.update({
                        where: { id: chat.id },
                        data: { lastFollowUpAt: new Date() }
                    });
                    sentThisCycle++;

                    await sendTypingState(chat.waId);
                    await new Promise(r => setTimeout(r, 2000));

                    const sent = await sendMessage(chat.waId, selectedText, null, {
                        isProactive: true,
                        // Revalidación al momento del envío físico: el mensaje
                        // puede esperar en la cola anti-ban mucho más que estos
                        // 2 segundos, y en el medio el cliente pudo escribir o
                        // pedir que no lo contacten.
                        preflight: async () => {
                            const fresh = await prisma.whatsAppChat.findUnique({ where: { id: chat.id } });
                            if (!fresh) return { ok: false, reason: 'el chat ya no existe' };

                            // Acá `botEnabled` SÍ corresponde, al revés que en los
                            // seguimientos de venta: este recordatorio es el bot
                            // retomando SU propia conversación (el último mensaje
                            // fue suyo). Si una persona tomó la charla, el bot no
                            // tiene nada que retomar.
                            if (!fresh.botEnabled || (fresh.chatLabels || []).includes('[SISTEMA - BOT APAGADO]')) {
                                return { ok: false, reason: 'la charla la tomó una persona' };
                            }

                            // El resto lo decide la política, con la ventana corta
                            // del último segundo. El cooldown no se re-mira: este
                            // envío ya fue aprobado hace instantes.
                            const v = await evaluarElegibilidad({
                                client: cliente || { id: fresh.id, name: fresh.profileName || fresh.waId, tags: [] },
                                chat: fresh,
                                mirarCooldown: false,
                                actividadHoras: 2,
                                exigirEntrante: false,
                            });
                            return v.ok ? { ok: true } : { ok: false, reason: v.motivo };
                        },
                    });

                    if (sent && sent.skipped) {
                        console.log(`  🚦 [Follow-Up] Recordatorio a ${chat.profileName || chat.waId} descartado en cola: ${sent.reason}`);
                        continue;
                    }

                    // Registrar como mensaje del bot para que el listener de salientes lo ignore
                    rememberBotMessage(sent, selectedText);

                    const waMessageId = resolveWaMessageId(sent, { waId: chat.waId, direction: 'OUTBOUND', content: selectedText });
                    await prisma.whatsAppMessage.upsert({
                        where: { waMessageId },
                        update: { senderName: 'Bot' },
                        create: {
                            chatId: chat.id,
                            direction: 'OUTBOUND',
                            type: 'TEXT',
                            content: selectedText,
                            waMessageId,
                            senderName: 'Bot',
                            status: 'SENT'
                        }
                    });

                    // Actualizar timestamps
                    await prisma.whatsAppChat.update({
                        where: { id: chat.id },
                        data: { 
                            lastMessageAt: new Date(),
                            lastFollowUpAt: new Date()
                        }
                    });
                    
                    broadcastChatUpdate(chat.id);
                } catch (err) {
                    console.error(`Error enviando follow-up a ${chat.waId}:`, err.message);
                } finally {
                    setTimeout(() => botReplyingTo.delete(chat.waId), 3000);
                }
            }
        }
    }

    } catch (cycleErr) {
        console.error('[Inactividad] Error en el ciclo:', cycleErr.message);
    } finally {
        isInactivityRunning = false;
    }
}

module.exports = { checkAndSendInactivityFollowUps };
