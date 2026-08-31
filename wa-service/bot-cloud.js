'use strict';

/**
 * El agente de ventas ("Matías") sobre la API OFICIAL de WhatsApp.
 *
 * Es el turno de bot de `index.js` (grafo LangGraph + guardrails + envío) sin
 * nada de lo que la Cloud API vuelve innecesario: sin cola anti-ban, sin
 * Chromium, sin simulación de tipeo, sin seguimientos proactivos. Todo lo que
 * sale de acá pasa por `transport/cloud-transport.js`, que valida la ventana de
 * 24 h antes de gastar una llamada a Meta.
 *
 * Cómo se engancha (ver `cloud.js`): el webhook llama a una CADENA de
 * manejadores del entrante y cada uno decide si le toca. Este devuelve `true`
 * solo cuando se hace cargo del mensaje; si devuelve `false` (bot apagado,
 * fuera de horario, chat excluido) el siguiente de la cadena —hoy el
 * auto-respondedor fuera de horario— tiene su chance.
 *
 * Reglas que este módulo garantiza:
 *  1. Nada sale sin pasar por el transporte cloud (ventana de 24 h incluida).
 *  2. `bot_enabled` (SystemSetting) se lee de la base EN CADA TURNO: la dueña
 *     lo apaga desde el panel y deja de contestar sin deploy. Si la bandera no
 *     se puede leer, el bot NO contesta (fail-safe).
 *  3. Un mismo mensaje no se contesta dos veces (dedup por wamid en la cadena
 *     de `cloud.js` + `botReplyingTo` + re-chequeo de mensajes nuevos).
 *  4. Solo se disparan mensajes ENTRANTES reales: los ecos del celular
 *     (`smb_message_echoes`) van por `persistEcho` y nunca llegan acá.
 *  5. Una falla del bot jamás rompe la persistencia del entrante ni el 200 del
 *     webhook: el turno corre desprendido y todo error termina en un log.
 */

const { HumanMessage, AIMessage } = require('@langchain/core/messages');
const { graph, esFallaTransitoriaDeHerramienta } = require('./graph');
const { BotService } = require('./services/bot.service');
const { runOutputGuardrail } = require('./services/ai.service');
const { generateAndSaveHandoffSummary } = require('./tools');
const { TAGS_SIN_BOT } = require('./utils');
const { isBusinessHours } = require('./shared/business-hours');
const { resolveWaMessageId } = require('./shared/message-id');
const { setSender } = require('./shared/sender');

// Cuánto se espera antes de contestar, para juntar las burbujas que el cliente
// manda seguidas (mismo criterio que el transporte legacy). Configurable por
// entorno para poder probar la cadena sin esperar.
const DEBOUNCE_MS = Number(process.env.BOT_DEBOUNCE_MS || 25000);
// Corte duro del turno: si el grafo no cerró en este tiempo, se aborta EN SILENCIO.
const GRAPH_TIMEOUT_MS = Number(process.env.BOT_GRAPH_TIMEOUT_MS || 30000);
const RECURSION_LIMIT = 10;
// Cuántos mensajes del historial se le arman al modelo.
const HISTORY_SIZE = 30;
// Las imágenes van en base64 dentro del contexto: no pueden ser todas.
const MAX_IMAGENES_AL_MODELO = 3;
const MEDIA_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CONSECUTIVE_FAILED_TURNS = 3;
// Cada cuánto se refresca la config en memoria (la que muestra el panel).
const CONFIG_POLL_MS = 60 * 1000;

const PROHIBITED_FILLER_PHRASES = [
    'dame un segundito', 'esperame que busco', 'ahí te paso',
    'dejame verificar', 'te calculo los precios', 'ahí te busco',
    'dejame chequear', 'ya te busco', 'un momentito',
    'reviso en el sistema', 'consulto en el sistema', 'verifico en el sistema',
    'busco en el sistema', 'en el sistema veo', 'en el sistema figura',
    'según nuestros registros', 'segun nuestros registros',
    'estoy revisando', 'estoy consultando', 'estoy verificando',
    'dejame revisar', 'aguardame un momento',
];

/** Mimetype por extensión: la Cloud API decide imagen/documento por el mimetype. */
function guessMimetype(url = '') {
    const ext = String(url).split('?')[0].split('#')[0].split('.').pop().toLowerCase();
    switch (ext) {
        case 'png': return 'image/png';
        case 'webp': return 'image/webp';
        case 'gif': return 'image/gif';
        case 'pdf': return 'application/pdf';
        case 'mp4': return 'video/mp4';
        case 'jpg': case 'jpeg': default: return 'image/jpeg';
    }
}

/**
 * Sin mimetype, `cloud-api.mediaKind('')` clasifica cualquier URL como
 * DOCUMENTO y la foto de un armazón le llega al cliente como archivo adjunto.
 */
function adaptMedia(media) {
    if (!media) return null;
    if (media.mimetype) return media;
    if (media.url) return { ...media, mimetype: guessMimetype(media.url) };
    return media;
}

/**
 * @param {object} deps
 * @param {import('@prisma/client').PrismaClient} deps.prisma
 * @param {import('socket.io').Server} deps.io
 * @param {{ sendMessage: Function }} deps.transport transporte cloud
 * @param {Set<string>} deps.botReplyingTo
 * @param {(chatId: string) => void} deps.broadcastChatUpdate
 * @param {(date?: Date) => boolean} [deps.isBusinessHours] inyectable para tests
 */
function createCloudBot({ prisma, io, transport, botReplyingTo, broadcastChatUpdate, isBusinessHours: horario = isBusinessHours }) {
    // Estado que lee y escribe el panel (routes/api.js#GET|POST /agent).
    // `followupsEnabled` queda en false y no se usa: con la API oficial no hay
    // seguimientos proactivos por IA (fuera de la ventana solo entran plantillas).
    const agentState = {
        agentEnabled: false,
        followupsEnabled: false,
        agentPrompt: '',
        dailyContext: '',
    };

    const debounceTimers = new Map();   // chatId → Timeout
    const chatErrorCounts = new Map();  // chatId → turnos fallidos seguidos
    let configTimer = null;

    // ── Salida: SIEMPRE por el transporte cloud ─────────────────────────────
    // `options.chat` le ahorra al transporte la consulta de la ventana cuando ya
    // tenemos el chat; el chequeo de 24 h corre igual.
    const sendViaCloud = (waId, content, media = null, options = {}) =>
        transport.sendMessage(waId, content, adaptMedia(media), options);

    const botService = new BotService({
        prisma, io, botReplyingTo,
        broadcastChatUpdate,
        generateAndSaveHandoffSummary,
        graph, agentState,
        sendMessage: sendViaCloud,
        sendTypingState: async () => null,
        TAGS_SIN_BOT,
    });
    botService.botDebounceTimers = debounceTimers;
    botService.chatErrorCounts = chatErrorCounts;

    const disableBotForChatById = (chatId, reason) => botService.disableBotForChatById(chatId, reason);

    // ── Config ──────────────────────────────────────────────────────────────

    /**
     * Lee la bandera maestra. Fail-safe: si la base no responde, el bot NO
     * contesta (mejor mudo que hablando cuando la dueña creía haberlo apagado).
     */
    async function isEnabled() {
        try {
            const row = await prisma.systemSetting.findUnique({ where: { key: 'bot_enabled' } });
            const on = row ? row.value === 'true' : false;
            agentState.agentEnabled = on;
            return on;
        } catch (e) {
            agentState.agentEnabled = false;
            console.error('[BotCloud] No se pudo leer bot_enabled — el bot NO contesta (fail-safe):', e.message);
            return false;
        }
    }

    /** Prompt y contexto del día. Si falla, quedan los valores en memoria. */
    async function loadConfig() {
        try {
            const [enabled, prompt, contexto] = await Promise.all([
                prisma.systemSetting.findUnique({ where: { key: 'bot_enabled' } }),
                prisma.systemSetting.findUnique({ where: { key: 'bot_prompt' } }),
                prisma.systemSetting.findUnique({ where: { key: 'bot_daily_context' } }),
            ]);
            agentState.agentEnabled = enabled ? enabled.value === 'true' : false;
            if (prompt) agentState.agentPrompt = prompt.value || '';
            if (contexto) agentState.dailyContext = contexto.value || '';
        } catch (e) {
            agentState.agentEnabled = false; // fail-safe, igual que isEnabled()
            console.error('[BotCloud] No se pudo cargar la config del bot:', e.message);
        }
        return agentState;
    }

    async function init() {
        await loadConfig();
        if (!configTimer) {
            configTimer = setInterval(() => loadConfig().catch(() => {}), CONFIG_POLL_MS);
            configTimer.unref?.();
        }
        console.log(`🤖 [BotCloud] Agente ${agentState.agentEnabled ? 'ENCENDIDO' : 'apagado'} (SystemSetting bot_enabled) · debounce ${DEBOUNCE_MS}ms`);
        return agentState;
    }

    function stop() {
        if (configTimer) clearInterval(configTimer);
        configTimer = null;
        for (const t of debounceTimers.values()) clearTimeout(t);
        debounceTimers.clear();
    }

    // ── Entrada: ¿le toca al bot este mensaje? ───────────────────────────────

    /**
     * Manejador de la cadena de `cloud.js`.
     *
     * @param {object} msg   entrante normalizado por transport/webhook.js
     * @param {{ chat: object }} res  lo que devolvió persistInbound
     * @returns {Promise<boolean>} true si el bot se hace cargo (corta la cadena)
     */
    async function handleInbound(msg, res) {
        const chat = res && res.chat;
        if (!chat) return false;

        if (!(await isEnabled())) return false;

        // Fuera de horario NO contesta: ese turno es del auto-respondedor.
        if (!horario()) {
            console.log(`  🌙 [BotCloud] Fuera de horario comercial: el bot no atiende ${chat.waId}.`);
            return false;
        }

        const fresh = await prisma.whatsAppChat.findUnique({
            where: { id: chat.id },
            select: { id: true, waId: true, realPhone: true, profileName: true, botEnabled: true, chatLabels: true, clientId: true },
        });
        if (!fresh || !fresh.botEnabled) return false;

        if (await tieneExclusion(fresh, msg)) return false;

        programarTurno(fresh, msg);
        return true;
    }

    /**
     * Etiquetas que apagan el bot (de la ficha o del chat). Un mensaje que viene
     * de un anuncio de Meta las pisa: es una consulta nueva, no la vieja.
     */
    async function tieneExclusion(chat, msg) {
        const esDeAnuncio = /\[meta[^\]]*\]/i.test(msg && msg.text ? msg.text : '') || Boolean(msg && msg.referral);
        let tags = [];
        if (chat.clientId) {
            const client = await prisma.client.findUnique({
                where: { id: chat.clientId },
                select: { tags: { select: { name: true } } },
            }).catch(() => null);
            tags = (client && client.tags) || [];
        }
        const excluido = tags.some(t => TAGS_SIN_BOT.some(x => (t.name || '').toLowerCase().includes(x)))
            || (chat.chatLabels || []).some(l => TAGS_SIN_BOT.some(x => (l || '').toLowerCase().includes(x)));
        if (!excluido) return false;
        if (esDeAnuncio) {
            console.log(`  🎯 [BotCloud] Etiqueta de exclusión pisada por mensaje de anuncio en ${chat.waId}.`);
            return false;
        }
        console.log(`  🚫 [BotCloud] Chat ${chat.waId} excluido por etiqueta.`);
        return true;
    }

    /** Junta las burbujas seguidas del cliente en un solo turno. */
    function programarTurno(chat, msg) {
        if (debounceTimers.has(chat.id)) clearTimeout(debounceTimers.get(chat.id));
        const waId = chat.waId;
        const profileName = msg.profileName || chat.profileName || 'Cliente';
        const realPhone = chat.realPhone || msg.from || null;
        const t = setTimeout(() => {
            debounceTimers.delete(chat.id);
            processBotTurn(chat, waId, profileName, realPhone)
                .catch(e => console.error('  ❌ [BotCloud] Error async en processBotTurn:', e.message));
        }, DEBOUNCE_MS);
        t.unref?.();
        debounceTimers.set(chat.id, t);
        console.log(`  🕒 [BotCloud] Respuesta programada para ${profileName} en ${DEBOUNCE_MS}ms.`);
    }

    // ── Imágenes del historial ──────────────────────────────────────────────

    function cachearMedia(chatId, item) {
        if (!chatId || !item) return item;
        if (!global.mediaCache) global.mediaCache = {};
        if (!Array.isArray(global.mediaCache[chatId])) global.mediaCache[chatId] = [];
        global.mediaCache[chatId].push(item);
        const t = setTimeout(() => {
            if (global.mediaCache[chatId]) {
                global.mediaCache[chatId] = global.mediaCache[chatId].filter(i => i !== item);
                if (global.mediaCache[chatId].length === 0) delete global.mediaCache[chatId];
            }
        }, MEDIA_CACHE_TTL_MS);
        t.unref?.();
        return item;
    }

    /**
     * La imagen que el cliente mandó, para que el modelo la VEA. Primero la
     * caché (la usa también save_prescription_data para adjuntar la receta a la
     * ficha); si no está, se baja del CRM.
     */
    async function obtenerImagenDelMensaje(m, chatId) {
        const cached = ((global.mediaCache || {})[chatId] || []).find(i => i.waMessageId === m.waMessageId);
        if (cached) return cached;
        if (!m.mediaUrl) return null;
        try {
            const axios = require('axios');
            const base = (process.env.CRM_API_URL || '').replace(/\/api(\/bot)?$/, '');
            const url = /^https?:\/\//i.test(m.mediaUrl) ? m.mediaUrl : `${base}${m.mediaUrl}`;
            const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: 15 * 1024 * 1024 });
            const mimeType = (r.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
            if (!mimeType.startsWith('image/')) return null;
            return cachearMedia(chatId, {
                waMessageId: m.waMessageId,
                base64: Buffer.from(r.data).toString('base64'),
                mimeType,
                timestamp: Date.now(),
            });
        } catch (e) {
            console.error(`  ⚠️ [BotCloud] No se pudo recuperar la imagen ${m.waMessageId}: ${e.message}`);
            return null;
        }
    }

    /**
     * Historial en formato LangChain. Mismo armado que el transporte legacy:
     * timestamp visible, imágenes multimodales, limpieza de la marca [metaXxx]
     * y fusión de burbujas seguidas del bot para no gastar slots de contexto.
     */
    async function armarHistorial(mensajes, chatId) {
        const cronologicos = mensajes.slice().reverse();
        const imagenes = new Map();
        const candidatas = cronologicos
            .filter(m => m.direction !== 'OUTBOUND' && m.type === 'IMAGE')
            .slice(-MAX_IMAGENES_AL_MODELO);
        for (const m of candidatas) {
            const img = await obtenerImagenDelMensaje(m, chatId);
            if (img) imagenes.set(m.waMessageId, img);
        }

        const formatter = new Intl.DateTimeFormat('es-AR', {
            timeZone: 'America/Argentina/Cordoba',
            weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });

        const crudos = cronologicos.map(m => {
            const ts = `[${formatter.format(new Date(m.createdAt))}] `;
            if (m.direction === 'OUTBOUND') return { role: 'ai', content: ts + (m.content || '') };
            if (m.type === 'IMAGE') {
                const img = imagenes.get(m.waMessageId);
                if (img) {
                    return { role: 'human', multimodal: true, content: [
                        { type: 'text', text: `${ts}[Imagen adjunta. Mensaje del cliente: "${m.content || '(sin texto)'}"]` },
                        { type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } },
                    ] };
                }
                // Nunca decir "antigua": el modelo lo leía como que la RECETA era vieja.
                return { role: 'human', content: `${ts}[El cliente adjuntó una imagen que no podemos mostrarte en este turno. NO comentes su antigüedad, su fecha ni su contenido, y NO le pidas que te dicte los datos de la receta. Si ya la leíste antes en esta charla, usá esos valores y seguí normalmente. Texto que la acompañaba: "${m.content || '(sin texto)'}"]` };
            }
            if (m.type === 'AUDIO') return { role: 'human', content: `${ts}[El cliente envió un audio transcrito. Mensaje: ${m.content}]` };
            let limpio = m.content || '';
            if (/\[meta[^\]]*\]/i.test(limpio)) {
                limpio = limpio.replace(/\[meta[^\]]*\]/gi, '').trim();
                if (!limpio) limpio = 'Hola, vengo de un anuncio de Facebook/Instagram y estoy interesado.';
            }
            return { role: 'human', content: ts + (limpio || '[Mensaje vacío]') };
        });

        const fusionados = [];
        for (let i = 0; i < crudos.length; i++) {
            const cur = crudos[i];
            if (cur.role === 'ai') {
                let contenido = cur.content;
                while (i + 1 < crudos.length && crudos[i + 1].role === 'ai') {
                    i++;
                    contenido += '\n\n' + crudos[i].content;
                }
                fusionados.push(new AIMessage(contenido));
            } else {
                fusionados.push(cur.multimodal ? new HumanMessage({ content: cur.content }) : new HumanMessage(cur.content));
            }
        }
        return fusionados;
    }

    // ── Fallas ──────────────────────────────────────────────────────────────

    /**
     * El cliente NUNCA se entera de un error interno: el turno se aborta en
     * silencio y el bot queda activo. Recién tras varios turnos seguidos
     * fallidos se apaga el bot en ese chat y se avisa al panel.
     */
    async function fallaTransitoria(chat, waId, profileName, motivo) {
        const fallas = (chatErrorCounts.get(chat.id) || 0) + 1;
        chatErrorCounts.set(chat.id, fallas);
        if (fallas < MAX_CONSECUTIVE_FAILED_TURNS) {
            console.warn(`  🔇 [BotCloud] Turno abortado en silencio (${fallas}/${MAX_CONSECUTIVE_FAILED_TURNS}) para ${profileName || waId}. Motivo: ${motivo}`);
            return false;
        }
        chatErrorCounts.delete(chat.id);
        console.error(`  🛑 [BotCloud] ${MAX_CONSECUTIVE_FAILED_TURNS} turnos fallidos seguidos para ${profileName || waId}. Se apaga el bot en ese chat.`);
        await disableBotForChatById(chat.id, `Errores técnicos persistentes (${String(motivo).substring(0, 50)})`);
        if (io) io.emit('bot_error', { chatId: chat.id, name: profileName || 'Cliente', phone: waId, error: `Desactivado por errores persistentes: ${String(motivo).substring(0, 80)}` });
        return true;
    }

    // ── El turno ────────────────────────────────────────────────────────────

    async function processBotTurn(chat, waId, profileName, realPhone) {
        try {
            const freshChat = await prisma.whatsAppChat.findUnique({
                where: { id: chat.id },
                include: { client: { include: { tags: true, prescriptions: { orderBy: { date: 'desc' }, take: 3 }, interactions: { orderBy: { createdAt: 'desc' }, take: 5 } } } },
            });
            if (!freshChat || !freshChat.botEnabled) {
                console.log(`  🚫 [BotCloud] Turno cancelado para ${profileName || waId}: el bot está apagado en ese chat.`);
                return;
            }
            // La dueña pudo apagarlo durante el debounce.
            if (!(await isEnabled())) {
                console.log('  🚫 [BotCloud] Turno cancelado: bot_enabled se apagó durante el debounce.');
                return;
            }

            const recientes = await prisma.whatsAppMessage.findMany({
                where: { chatId: chat.id },
                orderBy: { createdAt: 'desc' },
                take: HISTORY_SIZE,
            });
            const masNuevoProcesado = recientes[0] || null;
            const messages = await armarHistorial(recientes, chat.id);

            const state = {
                messages,
                userPhone: realPhone || freshChat.realPhone || '',
                userName: profileName,
                waId,
                chatId: chat.id,
                customPrompt: agentState.agentPrompt,
                dailyContext: agentState.dailyContext,
                clientData: freshChat.client || null,
                chatSummary: freshChat.chatSummary || null,
            };
            // recursionLimit acá y no en compile(): LangGraph lo ignora en compile().
            const config = { configurable: { thread_id: waId }, recursionLimit: RECURSION_LIMIT };

            let result;
            try {
                result = await Promise.race([
                    graph.invoke(state, config),
                    new Promise((_, rej) => setTimeout(() => rej(new Error(`Bot timeout: graph.invoke superó ${GRAPH_TIMEOUT_MS}ms`)), GRAPH_TIMEOUT_MS)),
                ]);
            } catch (graphErr) {
                console.error(`  ❌ [BotCloud] graph.invoke: ${graphErr.message}`);
                result = { messages: [] };
            }

            const salida = Array.isArray(result && result.messages) ? result.messages : [];

            // ── Apagado silencioso pedido por el propio agente ───────────────
            const pidioApagado = salida.some(m => Array.isArray(m.tool_calls) && m.tool_calls.some(c => c.name === 'disable_bot_for_personal_chat' || c.name === 'cancel_bot'));
            if (pidioApagado) {
                console.log(`  ⏹️ [BotCloud] Apagado silencioso (${chat.id}): no se responde nada.`);
                await disableBotForChatById(chat.id, 'Detección de chat personal/cancelación silenciosa');
                broadcastChatUpdate(chat.id);
                return;
            }

            // ── Caída REAL de una herramienta: silencio absoluto ─────────────
            //
            // Se clasifica con la señal que deja `safeToolRun` en el origen
            // (agent-tools.js), NO olfateando el texto del resultado. El patrón
            // anterior matcheaba \b404\b y \b500\b sueltos, y los precios de la
            // óptica los contienen: medido contra la base real, el 5,3% de los
            // productos y el 15% de los presupuestos de 3 opciones disparaban la
            // falsa alarma, y el turno se descartaba entero — el cliente no
            // recibía NADA. Encima era ciego a caídas de verdad (ETIMEDOUT,
            // fetch failed, timeout). Lo cuida `npm run check:bot-errores`.
            const conError = salida.find(m => {
                const esTool = m.tool_call_id !== undefined || (typeof m.getType === 'function' && m.getType() === 'tool');
                return esTool && esFallaTransitoriaDeHerramienta(m);
            });
            if (conError) {
                console.log(`  ⏹️ [BotCloud] Error de API en herramienta (${chat.id}). Turno abortado en silencio.`);
                await fallaTransitoria(chat, waId, profileName, `Error de API en herramienta: ${String(conError.content || '').substring(0, 120)}`);
                return;
            }

            if (salida.length === 0) {
                await fallaTransitoria(chat, waId, profileName, 'Respuesta vacía: posible timeout o límite de recursión');
                return;
            }

            const responseText = salida[salida.length - 1].content;
            if (!responseText) return;

            // ── Guardrail de salida ─────────────────────────────────────────
            const guardrail = runOutputGuardrail(responseText);
            if (!guardrail.safe) {
                console.warn(`  ⚠️ [BotCloud] Respuesta bloqueada por el guardrail: ${guardrail.reason}`);
                if (guardrail.reason === 'Narración de Error Interno' || guardrail.reason === 'Solicitud de Dato Prohibido o Presentación Indebida') {
                    await fallaTransitoria(chat, waId, profileName, `Guardrail (${guardrail.reason})`);
                    return;
                }
                const esSospechaDeBot = guardrail.reason.includes('Revelación de Identidad');
                await disableBotForChatById(chat.id, `Brecha de seguridad (Guardrail: ${guardrail.reason})`);
                if (freshChat.clientId) {
                    await prisma.interaction.create({
                        data: {
                            clientId: freshChat.clientId,
                            type: 'NOTE',
                            userName: 'Bot',
                            content: `⚠️ [Output Guardrail] Bot desactivado. ${esSospechaDeBot ? 'El cliente sospecha que habla con un bot; se apagó en silencio.' : 'Se bloqueó una respuesta con datos internos.'} Respuesta original: "${String(responseText).substring(0, 150)}..."`,
                        },
                    }).catch(e => console.error('[BotCloud] No se pudo guardar la nota del guardrail:', e.message));
                    if (esSospechaDeBot) {
                        await prisma.clientTask.create({
                            data: { clientId: freshChat.clientId, description: 'Acusación de IA: Cliente sospecha bot. Llamar urgente.', dueDate: new Date() },
                        }).catch(e => console.error('[BotCloud] No se pudo crear la tarea urgente:', e.message));
                    }
                }
                if (io) io.emit('bot_error', { chatId: chat.id, name: profileName || 'Cliente', phone: waId, error: esSospechaDeBot ? '🛡️ Sospecha de Bot (apagado silencioso)' : `Bloqueo de Seguridad (${guardrail.reason})` });
                broadcastChatUpdate(chat.id);
                return;
            }

            // ── ¿Escribió de nuevo mientras pensábamos? ─────────────────────
            if (masNuevoProcesado) {
                const nuevos = await prisma.whatsAppMessage.count({
                    where: { chatId: chat.id, direction: 'INBOUND', createdAt: { gt: masNuevoProcesado.createdAt } },
                });
                if (nuevos > 0) {
                    console.log('  ⏳ [BotCloud] Llegaron mensajes nuevos: se descarta esta respuesta.');
                    return; // botReplyingTo todavía no se marcó: no hay que limpiar nada
                }
            }

            botReplyingTo.add(waId);

            let texto = String(responseText).replace(/¿/g, '').replace(/¡/g, '');
            for (const frase of PROHIBITED_FILLER_PHRASES) {
                if (texto.toLowerCase().includes(frase)) {
                    const esc = frase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    texto = texto.replace(new RegExp(`[^.!?\\n]*${esc}[^.!?\\n]*[.!?]*`, 'gi'), '').replace(/\s{2,}/g, ' ').trim();
                    console.log(`  🚫 [BotCloud] Oración de relleno eliminada: "${frase}"`);
                }
            }
            if (!texto.trim()) {
                console.log('  ⏹️ [BotCloud] Respuesta vacía tras el filtrado. No se envía nada.');
                botReplyingTo.delete(waId);
                return;
            }

            const bloques = texto.split('\n\n').map(b => b.trim()).filter(Boolean);
            for (let i = 0; i < bloques.length; i++) {
                let bloque = bloques[i];
                const urls = [];
                const re = /\[IMAGE:\s*(https?:\/\/[^\]]+)\]/gi;
                let m;
                while ((m = re.exec(bloque)) !== null) urls.push(m[1]);
                bloque = bloque.replace(/\[IMAGE:\s*(https?:\/\/[^\]]+)\]/gi, '').trim();
                if (!bloque && urls.length === 0) continue;

                if (urls.length > 0) {
                    for (let j = 0; j < urls.length; j++) {
                        const caption = j === 0 ? bloque : '';
                        let enviado = null;
                        try {
                            enviado = await sendViaCloud(waId, caption, { url: urls[j] }, { chat: freshChat });
                        } catch (e) {
                            // Una foto caída no puede voltear el turno: se manda el texto solo.
                            console.error(`  ⚠️ [BotCloud] Falló la imagen ${urls[j].substring(0, 80)}: ${e.message}`);
                            if (caption) enviado = await sendViaCloud(waId, caption, null, { chat: freshChat }).catch(() => null);
                        }
                        await guardarSaliente(chat.id, waId, enviado, caption || '[Media]', urls[j] ? 'IMAGE' : 'TEXT');
                    }
                } else {
                    const enviado = await sendViaCloud(waId, bloque, null, { chat: freshChat });
                    await guardarSaliente(chat.id, waId, enviado, bloque, 'TEXT');
                }

                if (i < bloques.length - 1) await new Promise(r => setTimeout(r, 800));
            }

            // Margen para que el eco del propio envío no se lea como una persona.
            const t = setTimeout(() => botReplyingTo.delete(waId), 3000);
            t.unref?.();
            chatErrorCounts.delete(chat.id);
            broadcastChatUpdate(chat.id);
            console.log(`  ✅ [BotCloud] Respondido a ${profileName} con ${bloques.length} mensaje(s).`);
        } catch (err) {
            botReplyingTo.delete(waId);
            console.error('  ❌ [BotCloud] Error en el turno:', err.message);
            if (err.code === 'WINDOW_CLOSED') {
                // No es una falla del bot: el cliente no escribe hace más de 24 h.
                // Fuera de la ventana solo entran plantillas, y las manda un humano.
                console.warn(`  ⏳ [BotCloud] Ventana de 24 h cerrada para ${waId}: el bot no insiste.`);
                return;
            }
            if (/429|RESOURCE_EXHAUSTED/.test(err.message || '')) {
                chatErrorCounts.delete(chat.id);
                await disableBotForChatById(chat.id, 'Cuota agotada de API (Error 429)');
                if (io) io.emit('bot_error', { chatId: chat.id, name: profileName || 'Cliente', phone: waId, error: 'Crédito Agotado (Error 429)' });
                return;
            }
            await fallaTransitoria(chat, waId, profileName, err.message).catch(() => {});
        }
    }

    /** Deja la burbuja del bot en el buzón, firmada. */
    async function guardarSaliente(chatId, waId, enviado, contenido, tipo) {
        if (!enviado) return;
        try {
            const waMessageId = resolveWaMessageId(enviado, { waId, direction: 'OUTBOUND', content: contenido });
            await prisma.whatsAppMessage.upsert({
                where: { waMessageId },
                update: { senderName: 'Bot' },
                create: { chatId, direction: 'OUTBOUND', type: tipo, content: contenido, waMessageId, senderName: 'Bot', status: 'SENT' },
            });
        } catch (e) {
            console.error('[BotCloud] No se pudo guardar el saliente del bot:', e.message);
        }
    }

    // Desde acá en adelante, TODA salida de las herramientas del bot
    // (`tools.js`) va por el transporte cloud y pasa por la ventana de 24 h.
    setSender(sendViaCloud);

    return {
        init, stop, loadConfig, isEnabled,
        agentState,
        handleInbound,
        processBotTurn,
        disableBotForChatById,
        runOutputGuardrail,
        generateAndSaveHandoffSummary,
        graph,
        sendMessage: sendViaCloud,
    };
}

module.exports = { createCloudBot, guessMimetype, adaptMedia };
