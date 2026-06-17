/**
 * WA-Service: Servidor unificado WhatsApp + Bot Multi-Agente
 * Combina el servidor de WhatsApp (whatsapp-web.js) con el cerebro del bot (LangGraph).
 * Se despliega como un servicio separado en Railway.
 */


const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { prisma } = require('./db');
const { graph, DEFAULT_SALES_PROMPT } = require('./graph');
const { logBotMessage, isPhrase, generateAndSaveHandoffSummary } = require('./tools');
const { HumanMessage } = require("@langchain/core/messages");
const path = require('path');
const fs = require('fs');
const os = require('os');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { initWhatsApp, getStatus, getClient, sendMessage, sendTypingState } = require('./whatsapp/client');
const { processPassiveExtraction } = require('./passive-extractor');
const { transcribeAudio } = require('./transcriber');
const { checkAndSendSalesFollowUps } = require('./sales-followups');
const { checkAndSendInactivityFollowUps } = require('./cron/inactivity-followups');
const { TAGS_SIN_BOT, getAdminWaId, withTimeout, getFileExtension } = require('./utils');

const configPath = path.join(__dirname, 'agent_config.json');

const app = express();
const server = http.createServer(app);
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'];
const io = new Server(server, {
    cors: { origin: ALLOWED_ORIGINS }
});

// Hacer io accesible globalmente para que los tools puedan emitir eventos
global.io = io;

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: '10mb' }));

io.on('connection', (socket) => {
    console.log('🔌 Nuevo cliente WebSocket conectado:', socket.id);
    const status = getStatus();
    socket.emit('bot_status', { ...status, connected: status.isReady, phone: status.connectedPhone, qr: status.qrCode, agentEnabled, prompt: agentPrompt });
});

// Función auxiliar para emitir eventos de chat actualizados
function broadcastChatUpdate(chatId) {
    io.emit('chat_updated', { chatId });
}

// ── Estado global ──────────────────────────────
let agentEnabled = false;
let agentPrompt = '';
let dailyContext = '';

// Cache global para las imágenes en base64 de cada chat, para que los sub-agentes puedan acceder
global.mediaCache = global.mediaCache || {};

// Load configuration from database SystemSetting with fallback to agent_config.json
async function loadConfig() {
    try {
        const enabledSetting = await prisma.systemSetting.findUnique({ where: { key: 'bot_enabled' } });
        const promptSetting = await prisma.systemSetting.findUnique({ where: { key: 'bot_prompt' } });
        const contextSetting = await prisma.systemSetting.findUnique({ where: { key: 'bot_daily_context' } });
        
        if (enabledSetting) {
            agentEnabled = enabledSetting.value === 'true';
        } else if (fs.existsSync(configPath)) {
            const conf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            agentEnabled = conf.enabled || false;
        }
        
        if (promptSetting) {
            agentPrompt = promptSetting.value || '';
        } else if (fs.existsSync(configPath)) {
            const conf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            agentPrompt = conf.prompt || '';
        }

        if (contextSetting) {
            dailyContext = contextSetting.value || '';
        } else if (fs.existsSync(configPath)) {
            const conf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            dailyContext = conf.dailyContext || '';
        }
        
        console.log(`🤖 Bot configuration loaded from DB. Enabled: ${agentEnabled}, Prompt length: ${agentPrompt.length}, Daily context length: ${dailyContext.length}`);
    } catch (e) {
        console.error("❌ Error loading configuration from DB, falling back to file:", e);
        if (fs.existsSync(configPath)) {
            try {
                const conf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                agentEnabled = conf.enabled || false;
                agentPrompt = conf.prompt || '';
                dailyContext = conf.dailyContext || '';
            } catch (fileErr) {
                console.error("Error reading fallback agent config file:", fileErr);
            }
        }
    }
}

const botDebounceTimers = new Map();
const passiveDebounceTimers = new Map();

// ── Constante global de etiquetas que desactivan el bot ──
// (TAGS_SIN_BOT se importa desde ./utils)

// ── Detección de Intervención Humana ───────────
global.botReplyingTo = new Set();
const botReplyingTo = global.botReplyingTo; // Trackear cuando el bot está enviando para evitar race conditions

// ── Contador de errores consecutivos por chat (auto-disable tras 3 fallos) ──
const chatErrorCounts = new Map();

const handleMessageCreate = async (msg) => {
    if (msg.fromMe) {
        const waId = msg.to;
        
        // Si el bot está activamente enviando un mensaje a este número, ignoramos la "intervención humana"
        const isBotReplying = botReplyingTo.has(waId);

        try {
            const chat = await prisma.whatsAppChat.findUnique({ where: { waId } });
            if (chat) {
                if (chat.botEnabled && !isBotReplying) {
                    await disableBotForChatById(chat.id, 'Intervención humana (mensaje saliente)');
                }

                // Actualizar timestamp de actividad y desarchivar chat por mensaje saliente
                await prisma.whatsAppChat.update({
                    where: { id: chat.id },
                    data: {
                        lastMessageAt: new Date(),
                        archived: false
                    }
                });
                
                // GUARDAR EL MENSAJE EN EL CRM (UPSERT para evitar race conditions con el envío directo)
                let messageType = msg.hasMedia ? 'IMAGE' : 'TEXT';
                let mediaUrl = null;
                
                if (msg.hasMedia) {
                    try {
                        const media = await msg.downloadMedia();
                        if (media) {
                            if (media.mimetype.startsWith('audio/')) messageType = 'AUDIO';
                            else if (media.mimetype.startsWith('video/')) messageType = 'VIDEO';
                            else messageType = 'IMAGE';

                            const buffer = Buffer.from(media.data, 'base64');
                            const ext = getFileExtension(media.mimetype);

                            const axios = require('axios');
                            const FormDataNode = require('form-data');
                            const form = new FormDataNode();
                            form.append('file', buffer, { filename: `wa_out_${Date.now()}.${ext}`, contentType: media.mimetype });
                            
                            let uploadUrl = process.env.CRM_API_URL;
                            if (uploadUrl.endsWith('/api/bot')) uploadUrl = uploadUrl.replace('/api/bot', '/api/upload');
                            else if (uploadUrl.endsWith('/api')) uploadUrl = uploadUrl + '/upload';
                            else uploadUrl = uploadUrl + '/upload';

                            const uploadRes = await axios.post(uploadUrl, form, {
                                headers: {
                                    ...form.getHeaders(),
                                    'x-api-key': process.env.BOT_API_KEY
                                }
                            });
                            
                            if (uploadRes.data && uploadRes.data.url) {
                                mediaUrl = uploadRes.data.url;
                            }
                        }
                    } catch (err) {
                        console.error('Error procesando media saliente:', err.message);
                    }
                }
                
                const createData = {
                    chatId: chat.id,
                    direction: 'OUTBOUND',
                    type: messageType,
                    content: msg.body || '[Media/Documento]',
                    waMessageId: msg.id._serialized,
                };
                if (mediaUrl) createData.mediaUrl = mediaUrl;

                await prisma.whatsAppMessage.upsert({
                    where: { waMessageId: msg.id._serialized },
                    update: {}, // No pisamos el senderName si ya fue creado por el POST /api/send
                    create: createData
                });
                broadcastChatUpdate(chat.id);

                // ── Portero: Activar extracción pasiva cuando el HUMANO chatea (no el bot) ──
                // Crea fichas automáticamente mientras el vendedor está conversando manualmente
                if (!isBotReplying && !chat.clientId) {
                    if (passiveDebounceTimers.has(chat.id)) {
                        clearTimeout(passiveDebounceTimers.get(chat.id));
                    }
                    const timer = setTimeout(() => {
                        passiveDebounceTimers.delete(chat.id);
                        processPassiveExtraction(chat.id, waId, chat.profileName || '')
                            .catch(e => console.error("❌ Error en passiveExtraction (outbound humano):", e.message));
                    }, 20000);
                    passiveDebounceTimers.set(chat.id, timer);
                }
            }
        } catch (e) {
            console.error("Error on message_create sync:", e);
        }
    }
};

const { runOutputGuardrail, detectPaymentReceipt } = require('./services/ai.service');
const { isBusinessHours, getNextBusinessMorning, getNextWeekdayDate } = require('./services/helper.service');
const { BotService } = require('./services/bot.service');

// Initialize BotService globally so functions can use it
const botService = new BotService({
    prisma,
    io,
    botReplyingTo: global.botReplyingTo,
    passiveDebounceTimers,
    graph,
    agentState: {
        get agentEnabled() { return agentEnabled; },
        get agentPrompt() { return agentPrompt; },
        get dailyContext() { return dailyContext; }
    },
    broadcastChatUpdate,
    generateAndSaveHandoffSummary,
    sendMessage,
    sendTypingState,
    TAGS_SIN_BOT,
    processPassiveExtraction
});
// Re-bind original global botDebounceTimers and chatErrorCounts to the botService so we don't break existing globals
botService.botDebounceTimers = botDebounceTimers;
botService.chatErrorCounts = chatErrorCounts;

/**
 * Desactiva el bot para un chat específico y genera el resumen de handoff.
 */
const disableBotForChatById = (chatId, reason) => botService.disableBotForChatById(chatId, reason);

/**
 * Desactiva el bot usando waId y genera el resumen de handoff.
 */
const disableBotForWaId = (waId, reason) => botService.disableBotForWaId(waId, reason);

/**
 * Detecta promesas de visita en el local y crea automáticamente una tarea de seguimiento.
 */
const detectAndCreateVisitTask = (clientId, text) => botService.detectAndCreateVisitTask(clientId, text);


// ── Bot Orchestrator (Extraído para Modularidad) ─
async function processBotTurn(chat, waId, profileName, realPhone) {
    try {
        // Consultar el estado actual en la base de datos para no responder si se apagó el bot en el debounce de 25s
        const freshChat = await prisma.whatsAppChat.findUnique({
            where: { id: chat.id },
            include: { client: { include: { tags: true, prescriptions: { orderBy: { date: 'desc' }, take: 3 }, interactions: { orderBy: { createdAt: 'desc' }, take: 5 } } } }
        });

        if (!freshChat || !freshChat.botEnabled) {
            console.log(`  🚫 Turno de bot cancelado para ${profileName || waId} porque el bot está desactivado.`);
            return;
        }


        const clientTags = freshChat.client?.tags || [];
        const chatLabels = freshChat.chatLabels || [];
        const tieneTagSinBot = clientTags.some(tag =>
            TAGS_SIN_BOT.some(t => tag.name.toLowerCase().includes(t))
        ) || chatLabels.some(label =>
            TAGS_SIN_BOT.some(t => label.toLowerCase().includes(t))
        );
        if (tieneTagSinBot) {
            console.log(`  🚫 Turno de bot cancelado para ${profileName || waId} por etiqueta de exclusión (etiquetas o labels de chat).`);
            return;
        }

        console.log(`  🤖 Bot procesando bloque de mensajes de ${profileName}...`);
        
        const recentMessages = await prisma.whatsAppMessage.findMany({
            where: { chatId: chat.id },
            orderBy: { createdAt: 'desc' },
            take: 12
        });

        const newestMessageProcessed = recentMessages[0]; // Referencia para el post-procesamiento

        const { AIMessage } = require("@langchain/core/messages");
        
        // Reconstruir el historial
        const allMessages = recentMessages.reverse().map(m => {
            if (m.direction === 'OUTBOUND') {
                return new AIMessage(m.content || '');
            } else {
                if (m.type === 'IMAGE') {
                    const cached = (global.mediaCache?.[chat.id] || []).find(item => item.waMessageId === m.waMessageId);
                    if (cached) {
                        console.log(`📸 Enviando imagen multimodal a Gemini para mensaje: ${m.waMessageId}`);
                        return new HumanMessage({
                            content: [
                                { type: "text", text: `[Imagen adjunta. Mensaje del cliente: "${m.content || '(sin texto)'}"]` },
                                { type: "image_url", image_url: { url: `data:${cached.mimeType};base64,${cached.base64}` } }
                            ]
                        });
                    } else {
                        return new HumanMessage(`[Imagen adjunta (antigua): ${m.content || '(sin texto)'}]`);
                    }
                } else if (m.type === 'AUDIO') {
                    // Ahora la transcripción es manejada antes de guardar el mensaje
                    return new HumanMessage(`[El cliente envió un audio transcrito. Mensaje: ${m.content}]`);
                } else {
                    return new HumanMessage(m.content || '[Mensaje vacío]');
                }
            }
        });

        const config = { configurable: { thread_id: waId } };
        const state = { 
            messages: allMessages,
            userPhone: realPhone || '',
            userName: profileName,
            waId: waId,
            chatId: chat.id,
            customPrompt: agentPrompt,
            dailyContext: dailyContext,
            clientData: freshChat?.client || chat.client || null,
            chatSummary: freshChat.chatSummary || null,
        };
        
        const result = await graph.invoke(state, config);
        
        // ── GUARDRAIL DE DESACTIVACIÓN SILENCIOSA ──
        let hasPersonalOrCancelToolCall = false;
        if (result && result.messages) {
            for (const msg of result.messages) {
                if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
                    for (const call of msg.tool_calls) {
                        if (call.name === 'disable_bot_for_personal_chat' || call.name === 'cancel_bot') {
                            hasPersonalOrCancelToolCall = true;
                            break;
                        }
                    }
                }
                if (hasPersonalOrCancelToolCall) break;
            }
        }

        if (hasPersonalOrCancelToolCall) {
            console.log(`  ⏹️ Desactivación silenciosa detectada por llamada a herramienta de desactivación (${chat.id}). Cancelando respuesta.`);
            await disableBotForChatById(chat.id, 'Detección de chat personal/cancelación silenciosa');
            broadcastChatUpdate(chat.id);
            return;
        }

        // ── GUARDRAIL DE ERRORES DE API SILENCIOSOS ──
        let hasApiError = false;
        let apiErrorMessage = '';
        if (result && result.messages) {
            for (const msg of result.messages) {
                const isToolMsg = msg.tool_call_id !== undefined || (typeof msg.getType === 'function' && msg.getType() === 'tool') || msg._getType === 'tool';
                if (isToolMsg && (msg.status === 'error' || (msg.content && (msg.content.includes('Error') || msg.content.includes('getaddrinfo') || msg.content.includes('ECONNREFUSED'))))) {
                    const content = msg.content || '';
                    if (content.includes('getaddrinfo') || content.includes('ECONNREFUSED') || content.includes('404') || content.includes('500') || content.includes('Network Error')) {
                        hasApiError = true;
                        apiErrorMessage = content;
                        break;
                    }
                }
            }
        }

        if (hasApiError) {
            console.log(`  ⏹️ Error de API detectado en ToolMessage (${chat.id}). Cancelando respuesta.`);
            try {
                // Notificar exclusivamente al admin especificado por el usuario
                const adminNotifyPhone = "5493541215971@c.us";
                const alertMsg = `🚨 *ERROR TÉCNICO EN BOT* 🚨\nConversación con bot apagado: ${profileName || 'Cliente'} (${realPhone || waId.split('@')[0]})\nMotivo: El bot sufrió un error y se apagó en silencio.`;
                await sendMessage(adminNotifyPhone, alertMsg);
                console.log(`  🔔 Alerta de error enviada al administrador (3541215971)`);
            } catch (alertErr) {
                console.error('Error enviando alerta de error de API al administrador:', alertErr.message);
            }
            
            // Apagar el bot EN ABSOLUTO SILENCIO
            try {
                await disableBotForChatById(chat.id, 'Error técnico (Apagado silencioso)');
                broadcastChatUpdate(chat.id);
            } catch (e) {
                console.error('Error al apagar bot en silencio:', e.message);
            }
            
            return; // RETORNAR EN ABSOLUTO SILENCIO SIN ENVIAR NADA AL CLIENTE
        }

        // Re-verificar si el bot sigue encendido
        const checkChat = await prisma.whatsAppChat.findUnique({ where: { id: chat.id } });
        if (!checkChat || !checkChat.botEnabled) {
            console.log(`  ⏹️ Respuesta cancelada: el bot se desactivó a sí mismo.`);
            broadcastChatUpdate(chat.id);
            return;
        }

        const lastMessage = result.messages[result.messages.length - 1];
        const responseText = lastMessage.content;

        if (responseText) {
            // ── Capa de Seguridad (Output Guardrail) ──
            const guardrail = runOutputGuardrail(responseText);
            if (!guardrail.safe) {
                console.warn(`  ⚠️ [Output Guardrail] Respuesta bloqueada para ${profileName} por: ${guardrail.reason}`);
                
                // 1. Apagar bot para este chat
                await disableBotForChatById(chat.id, `Brecha de seguridad (Guardrail: ${guardrail.reason})`);
                
                // 2. Registrar nota de seguridad en la ficha del cliente
                if (chat.clientId) {
                    await prisma.interaction.create({
                        data: {
                            clientId: chat.clientId,
                            type: 'NOTE',
                            content: `⚠️ [Output Guardrail] Bot desactivado. Se bloqueó una respuesta automática por contener datos internos o JSON: "${responseText.substring(0, 150)}..."`
                        }
                    }).catch(e => console.error('Error guardando nota:', e.message));
                }

                // 3. Notificar al panel vía WebSocket
                if (global.io) {
                    global.io.emit('bot_error', {
                        chatId: chat.id,
                        name: profileName || chat.profileName || 'Cliente',
                        phone: realPhone || chat.realPhone || waId.split('@')[0],
                        error: `Bloqueo de Seguridad (${guardrail.reason})`
                    });
                }
                
                broadcastChatUpdate(chat.id);
                return;
            }
            // VERIFICACIÓN POST-PROCESAMIENTO
            if (newestMessageProcessed) {
                const newMessagesCount = await prisma.whatsAppMessage.count({
                    where: {
                        chatId: chat.id,
                        direction: 'INBOUND',
                        createdAt: { gt: newestMessageProcessed.createdAt }
                    }
                });

                if (newMessagesCount > 0) {
                    console.log(`  ⏳ Nuevos mensajes detectados. Abortando respuesta actual.`);
                    return; // botReplyingTo aún no fue seteado, no hay leak
                }
            }

            // Seteamos DESPUÉS del check de mensajes nuevos para evitar leak en early return
            botReplyingTo.add(waId);
            // Limpiar signos de interrogación de apertura para seguir la regla de estilo humano
            const cleanResponseText = responseText.replace(/¿/g, '');
            const messageBlocks = cleanResponseText.split('\n\n').map(b => b.trim()).filter(b => b.length > 0);
            
            for (let i = 0; i < messageBlocks.length; i++) {
                let block = messageBlocks[i];
                let mediaObj = null;

                // Extraer URL de imagen si el bot la incluyó con el formato [IMAGE: url]
                const imgMatch = block.match(/\[IMAGE:\s*(https?:\/\/[^\]]+)\]/i);
                if (imgMatch) {
                    mediaObj = { url: imgMatch[1] };
                    block = block.replace(imgMatch[0], '').trim();
                }

                if (block.length > 0 || mediaObj) {
                    // Simular que el bot está escribiendo (demora dinámica basada en la longitud)
                    await sendTypingState(waId);
                    // Calculamos un tiempo humano: ~50ms por caracter, mínimo 1.5s, máximo 5s
                    const typingTimeMs = Math.min(Math.max(block.length * 50, 1500), 5000);
                    await new Promise(r => setTimeout(r, typingTimeMs));

                    const sent = await sendMessage(waId, block, mediaObj);
                    
                    if (sent && sent.id && sent.id._serialized) {
                        try {
                            await prisma.whatsAppMessage.upsert({
                                where: { waMessageId: sent.id._serialized },
                                update: { senderName: 'Bot' },
                                create: {
                                    chatId: chat.id,
                                    direction: 'OUTBOUND',
                                    type: mediaObj ? 'IMAGE' : 'TEXT',
                                    content: block || '[Media]',
                                    waMessageId: sent.id._serialized,
                                    senderName: 'Bot',
                                    status: 'SENT'
                                }
                            });
                        } catch (e) {
                            console.error('Error guardando senderName del Bot:', e.message);
                        }
                    }
                }
                
                // Pausa extra entre mensajes si manda más de uno seguido
                if (i < messageBlocks.length - 1) {
                    await new Promise(r => setTimeout(r, 800));
                }
            }

            // Mantener botReplyingTo activo con grace period DESPUÉS de enviar todos los bloques
            // (antes se borraba con setTimeout(2000) que podía expirar mientras aún se enviaban bloques)
            setTimeout(() => botReplyingTo.delete(waId), 3000);
            // Resetear contador de errores consecutivos tras envío exitoso
            chatErrorCounts.delete(chat.id);
            console.log(`  ✅ Bot respondió a ${profileName} (${result.agentType || 'UNKNOWN'}) con ${messageBlocks.length} mensajes`);
        }
    } catch (err) {
        botReplyingTo.delete(waId); // B1: limpiar tracking en caso de error
        console.error('  ❌ Error bot:', err.message);

        // Apagar el bot inmediatamente ante cualquier falla
        try {
            await disableBotForChatById(chat.id, `Error técnico (${err.message?.substring(0, 50)})`);
            broadcastChatUpdate(chat.id);
        } catch (e) {
            console.error('Error al apagar bot tras falla general:', e.message);
        }

        // Emitir notificación por WebSocket al CRM
        if (global.io) {
            global.io.emit('bot_error', {
                chatId: chat.id,
                name: profileName || chat.profileName || 'Cliente',
                phone: realPhone || chat.realPhone || waId.split('@')[0],
                error: `Desactivado por error: ${err.message?.substring(0, 80)}`
            });
        }

        // Notificar al administrador especificado (3541215971)
        try {
            const adminNotifyPhone = "5493541215971@c.us";
            const alertMsg = `🚨 *ERROR TÉCNICO EN BOT* 🚨\nConversación con bot apagado: ${profileName || 'Cliente'} (${realPhone || waId.split('@')[0]})\nMotivo: ${err.message?.substring(0, 100)}`;
            await sendMessage(adminNotifyPhone, alertMsg);
            console.log(`  🔔 Alerta de falla enviada al administrador (3541215971)`);
        } catch (alertErr) {
            console.error('Error enviando alerta de falla al administrador:', alertErr.message);
        }

        if (err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED'))) {
            // 1. Apagar bot en la DB para este chat
            chatErrorCounts.delete(chat.id);
            await disableBotForChatById(chat.id, 'Cuota agotada de API (Error 429)');

            // 2. Emitir notificación de error por WebSocket a todos los usuarios del CRM
            if (global.io) {
                global.io.emit('bot_error', {
                    chatId: chat.id,
                    name: profileName || chat.profileName || 'Cliente',
                    phone: realPhone || chat.realPhone || waId.split('@')[0],
                    error: 'Crédito Agotado (Error 429)'
                });
            }

            // 3. Enviar correo de alerta
            const axios = require('axios');
            const alertUrl = (process.env.CRM_API_URL || '').replace('/api/bot', '') + '/api/admin/alert';
            axios.post(alertUrl, {
                subject: '🚨 ALERTA: Crédito Agotado en Bot de WhatsApp (Gemini)',
                message: 'El bot de WhatsApp intentó procesar un mensaje pero la solicitud fue rechazada por falta de créditos (Error 429: RESOURCE_EXHAUSTED).\n\nPor favor, recargá saldo en tu cuenta de Google Cloud / AI Studio para que el bot y el sistema vuelvan a funcionar.\n\nLink: https://aistudio.google.com/app/billing'
            }).catch(e => console.error('Error enviando alerta de email:', e.message));
        }
    }
}

// ── Recepción de mensajes ──────────────────────
const handleMessage = async (msg) => {
    if (msg.from.includes('@g.us') || msg.from === 'status@broadcast') return;

    let oldLastMessageAt = null;

    // 1. Ignorar mensajes de sistema (cambio de número, e2e, etc) para que el bot no se active solo
    const validTypes = ['chat', 'image', 'video', 'audio', 'document', 'ptt', 'sticker', 'location', 'vcard'];
    if (!validTypes.includes(msg.type)) {
        console.log(`  Ignorando mensaje de sistema tipo: ${msg.type}`);
        return;
    }

    const waId = msg.from;
    const contact = await msg.getContact();

    // ── Helper: validate that a string looks like a real phone number ──
    const isValidPhone = (str, currentWaId = '') => {
        if (!str || typeof str !== 'string') return false;
        const digits = str.replace(/[^0-9]/g, '');
        // REJECT if it's identical to the LID prefix
        if (currentWaId.includes('@lid')) {
            const lidPrefix = currentWaId.split('@')[0];
            if (digits === lidPrefix) return false;
        }
        // Real Argentine/international numbers: 10-15 digits, starts with country code
        return digits.length >= 10 && digits.length <= 15 && /^[1-9]/.test(digits);
    };

    // ── Resolve Profile Name ──────────────────────────
    const rawName = contact.pushname || contact.name || '';
    let profileName = rawName.replace(/[^a-zA-Z0-9 áéíóúÁÉÍÓÚñÑüÜ.,\-']/g, '').trim();
    // Reject garbage names: empty, pure numbers, too short, looks like an ID code, or if it is a phrase/sentence
    if (!profileName || /^\d+$/.test(profileName) || profileName.length < 2 || /^[0-9a-f]{10,}$/i.test(profileName) || isPhrase(profileName)) {
        profileName = '';
    }

    // ── Resolve Real Phone Number ─────────────────────
    let realPhone = '';

    // Source 1: contact.number (direct from WhatsApp contact card)
    if (isValidPhone(contact.number, waId)) {
        realPhone = contact.number;
    }

    // Source 2: Resolve LID → phone via WhatsApp API
    if (!realPhone && waId.includes('@lid')) {
        const wc = getClient();
        try {
            // Method A: getContactLidAndPhone (official API) with retry
            if (wc && typeof wc.getContactLidAndPhone === 'function') {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    const mapping = await wc.getContactLidAndPhone([waId]);
                    if (mapping && mapping.length > 0 && mapping[0].pn) {
                        const cleaned = mapping[0].pn.replace('@c.us', '').replace('@s.whatsapp.net', '');
                        if (isValidPhone(cleaned, waId)) {
                            realPhone = cleaned;
                            console.log(`  📞 [M1] LID → phone: ${realPhone} (Attempt ${attempt})`);
                            break;
                        }
                    }
                    if (attempt < 3) {
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                }
            }

            // Method B: getFormattedNumber on contact
            if (!realPhone && typeof contact.getFormattedNumber === 'function') {
                const formatted = await contact.getFormattedNumber();
                const cleaned = (formatted || '').replace(/[^0-9]/g, '');
                if (isValidPhone(cleaned, waId)) {
                    realPhone = cleaned;
                    console.log(`  📞 [M2] getFormattedNumber → ${realPhone}`);
                }
            }

            // Method C: getFormattedNumber on client (different signature)
            if (!realPhone && wc && typeof wc.getFormattedNumber === 'function') {
                try {
                    const formatted = await wc.getFormattedNumber(waId);
                    const cleaned = (formatted || '').replace(/[^0-9]/g, '');
                    if (isValidPhone(cleaned, waId)) {
                        realPhone = cleaned;
                        console.log(`  📞 [M3] client.getFormattedNumber → ${realPhone}`);
                    }
                } catch (e) { /* ignore */ }
            }

            // Method D: getChatById and extract user field
            if (!realPhone && wc) {
                try {
                    const chatObj = await wc.getChatById(waId);
                    const user = chatObj?.id?.user || '';
                    if (isValidPhone(user, waId)) {
                        realPhone = user;
                        console.log(`  📞 [M4] getChatById.id.user → ${realPhone}`);
                    }
                } catch (e) { /* ignore */ }
            }
        } catch (resolveErr) {
            console.error('  ⚠️ Error resolving phone from LID:', resolveErr.message);
        }
    }

    // Source 3: Standard @c.us contacts (classic format)
    if (!realPhone && waId.includes('@c.us')) {
        const extracted = waId.replace('@c.us', '');
        if (isValidPhone(extracted, waId)) {
            realPhone = extracted;
        }
    }

    // Debug log — only on first message or when phone can't be resolved
    console.log(`  👤 ${profileName || '(sin nombre)'} | waId: ${waId.substring(0, 20)}... | phone: ${realPhone || 'PENDING'}`);

    let body = msg.body || '';

    try {
        // 2. Buscar o crear el Chat en la base de datos evaluando si es una charla vieja
        let chat = await prisma.whatsAppChat.findUnique({ where: { waId } });

        if (!chat) {
            let shouldEnableBot = true;
            try {
                const waChat = await msg.getChat();
                const prevMsgs = await waChat.fetchMessages({ limit: 15 });
                
                // Si en el historial reciente de WhatsApp vemos mensajes enviados por nosotros (fromMe)
                // significa que este chat ya estaba siendo atendido por un humano previamente.
                const hasOutbound = prevMsgs.some(m => m.fromMe);
                if (hasOutbound) {
                    shouldEnableBot = false;
                    console.log(`  Conversación humana previa detectada para ${profileName}. Bot apagado por defecto.`);
                }
            } catch (err) {
                console.error("Error fetching prev msgs:", err.message);
            }

            try {
                chat = await prisma.whatsAppChat.create({
                    data: { waId, realPhone: realPhone || null, profileName: profileName || null, status: 'OPEN', botEnabled: shouldEnableBot, lastMessageAt: new Date(), unreadCount: 1 }
                });
            } catch (createErr) {
                if (createErr.code === 'P2002') {
                    const p2002Data = { lastMessageAt: new Date(), unreadCount: { increment: 1 } };
                    if (profileName) p2002Data.profileName = profileName;
                    if (realPhone) p2002Data.realPhone = realPhone;
                    chat = await prisma.whatsAppChat.update({
                        where: { waId },
                        data: p2002Data
                    });
                } else throw createErr;
            }
        } else {
            oldLastMessageAt = chat.lastMessageAt;
            const updateData = { lastMessageAt: new Date(), unreadCount: { increment: 1 } };
            // Solo actualizar profileName si tenemos uno válido y el chat no tiene cliente CRM
            if (profileName && !chat.clientId) updateData.profileName = profileName;
            // Solo actualizar realPhone si tenemos uno y el chat no tiene uno ya guardado
            if (realPhone && !chat.realPhone) updateData.realPhone = realPhone;
            // Auto-desarchivar: si el chat estaba archivado y llega un mensaje nuevo, vuelve al buzón activo
            if (chat.archived) {
                updateData.archived = false;
                console.log(`  📥 [Auto-Desarchivar] Chat de ${profileName || waId} desarchivado por nuevo mensaje entrante.`);
            }
            chat = await prisma.whatsAppChat.update({
                where: { id: chat.id },
                data: updateData,
            });
        }

        // 2. Auto-vincular cliente del CRM por número de teléfono
        if (!chat.clientId && realPhone && realPhone.length >= 8) {
            const searchPhoneStr = realPhone.slice(-8).replace(/\D/g, '');
            if (searchPhoneStr.length >= 8) {
                const rawDuplicates = await prisma.$queryRawUnsafe(`
                    SELECT id 
                    FROM "Client" 
                    WHERE REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') LIKE '%${searchPhoneStr}%'
                    LIMIT 1
                `);
                
                if (rawDuplicates && rawDuplicates.length > 0) {
                    const client = await prisma.client.findUnique({
                        where: { id: rawDuplicates[0].id },
                        include: { tags: true, prescriptions: true, interactions: { take: 5, orderBy: { createdAt: 'desc' } } }
                    });
                    if (client) {
                        chat = await prisma.whatsAppChat.update({
                            where: { id: chat.id },
                            data: { clientId: client.id },
                            include: { client: { include: { tags: true, prescriptions: true, interactions: { take: 5, orderBy: { createdAt: 'desc' } } } } }
                        });
                        console.log(`  🔗 Vinculado a cliente CRM: ${client.name}`);
                    }
                }
            }
        } else if (!chat.client) {
            // Recargar con relaciones si ya tenía clientId
            chat = await prisma.whatsAppChat.findUnique({
                where: { id: chat.id },
                include: { client: { include: { tags: true, prescriptions: true, interactions: { take: 5, orderBy: { createdAt: 'desc' } } } } }
            });
        }

        // 3. Resolver realPhone y profileName desde el cliente CRM vinculado (fix para LID)
        if (chat.client) {
            if (!realPhone && chat.client.phone) {
                realPhone = chat.client.phone;
                console.log(`  📞 Teléfono resuelto desde CRM: ${realPhone}`);
                // Persistir en el chat para futuros mensajes
                await prisma.whatsAppChat.update({ where: { id: chat.id }, data: { realPhone } });
            }
            // Usar el nombre del CRM como fuente de verdad
            if (chat.client.name) {
                profileName = chat.client.name;
            }
        }

        // ── Chequeo de Contacto en Agenda (Teléfono) ──────────
        // Si el contacto está guardado en la agenda del teléfono, es un proveedor,
        // familiar o contacto conocido. El bot se apaga silenciosamente.
        if (contact.isMyContact) {
            if (chat.botEnabled) {
                console.log(`  📇 Contacto agendado detectado: ${profileName || waId}. Apagando bot silenciosamente.`);
                await disableBotForChatById(chat.id, 'Contacto agendado en teléfono');
                chat.botEnabled = false;
            }
        }

        // ── Chequeo de etiquetas de exclusión ──────────
        // Si el cliente tiene tag "Cancelar Bot", "No Bot", "Proveedor", etc.
        // el bot NO responde y se silencia completamente para ese chat.

        const clientTags = chat?.client?.tags || [];
        const chatLabels = chat?.chatLabels || [];
        const tieneTagSinBot = clientTags.some(tag =>
            TAGS_SIN_BOT.some(t => tag.name.toLowerCase().includes(t))
        ) || chatLabels.some(label =>
            TAGS_SIN_BOT.some(t => label.toLowerCase().includes(t))
        );
        if (tieneTagSinBot) {
            if (chat.botEnabled) {
                await disableBotForChatById(chat.id, 'Etiquetas excluidas (Sin Bot)');
                chat.botEnabled = false; // sincronizar localmente
            }
        }

        // ── Chequeo de Post-Venta, Reclamos y Estado de Pedidos (Petición del Usuario) ──
        let esPostVenta = false;
        
        // A. Si el cliente ya es un cliente de post-venta (status: CLIENT)
        if (chat.client && chat.client.status === 'CLIENT') {
            // Un cliente con status 'CLIENT' solo se considera en post-venta activa si tiene pedidos pendientes/en curso.
            // Si todos sus pedidos están completados o entregados, el bot puede seguir interactuando (ej. para nuevos presupuestos).
            const activeOrder = await prisma.order.findFirst({
                where: {
                    clientId: chat.client.id,
                    orderType: { in: ['SALE', 'ORDER'] },
                    isDeleted: false,
                    NOT: {
                        AND: [
                            { status: 'COMPLETED' },
                            { labStatus: 'DELIVERED' }
                        ]
                    }
                }
            });
            if (activeOrder) {
                esPostVenta = true;
            }
        }
        
        // B. Si el mensaje contiene keywords de reclamos o estados de pedidos (SOLO para clientes registrados)
        if (body && chat.client && chat.client.status === 'CLIENT') {
            const normalizedBody = body.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const postVentaKeywords = [
                'mi pedido', 'estado de mi', 'estado del pedido',
                'cuando estan', 'cuando esta', 'listo para retirar', 'puedo retirar',
                'veo mal', 'no veo', 'no me adapto', 'me duele', 'dolor', 'molesta',
                'rayado', 'fallado', 'roto', 'rompio', 'defecto', 'reclamo', 'queja', 'garantia'
            ];
            const tieneKeywordPostVenta = postVentaKeywords.some(keyword => normalizedBody.includes(keyword));
            if (tieneKeywordPostVenta) {
                esPostVenta = true;
            }
        }
        
        if (esPostVenta) {
            if (chat.botEnabled) {
                await disableBotForChatById(chat.id, 'Post-Venta / Reclamo / Estado de Pedido detectado');
                chat.botEnabled = false; // desactivar bot localmente para no responder
            }
        }

        // ── Auto-Reanudación Inteligente (Smart Auto-Resume) ──
        const tieneApagadoManual = (chat?.chatLabels || []).some(label => label.includes('[SISTEMA - BOT APAGADO]'));
        if (oldLastMessageAt && !chat.botEnabled && !tieneTagSinBot && !esPostVenta && !tieneApagadoManual && !contact.isMyContact) {
            const diffMs = Date.now() - new Date(oldLastMessageAt).getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            if (diffHours >= 24) {
                console.log(`  🔄 [Auto-Resume] Reactivando bot para ${profileName || chat.waId} tras ${diffHours.toFixed(1)}hs de inactividad.`);
                chat = await prisma.whatsAppChat.update({
                    where: { id: chat.id },
                    data: { botEnabled: true }
                });
            }
        }

        // 2. Save Inbound Message
        let messageType = msg.hasMedia ? 'IMAGE' : 'TEXT';
        let mediaBase64 = null;
        let mediaMime = null;
        let mediaUrl = null;
        let geminiFileUri = null;
        let geminiMimeType = null;
        
        if (msg.hasMedia) {
            try {
                const media = await msg.downloadMedia();
                if (media) {
                    if (media.mimetype.startsWith('audio/')) messageType = 'AUDIO';
                    else if (media.mimetype.startsWith('video/')) messageType = 'VIDEO';
                    else messageType = 'IMAGE';

                    const buffer = Buffer.from(media.data, 'base64');
                    const ext = getFileExtension(media.mimetype);

                    if (messageType === 'AUDIO' && agentEnabled) {
                        console.log(`  🎧 Transcribiendo audio de ${profileName}...`);
                        const text = await transcribeAudio(media.data, media.mimetype);
                        if (text) {
                            body = `[Audio transcrito]: "${text}"`;
                            console.log(`  ✅ Audio transcrito: ${text}`);
                        }
                    }

                    if (messageType === 'IMAGE' || messageType === 'AUDIO') {
                        mediaMime = media.mimetype;
                        mediaBase64 = buffer.toString('base64');
                        
                        // Guardar en cache global para que el sub-agente pueda leerlo sin File API
                        if (chat && chat.id) {
                            if (!global.mediaCache) global.mediaCache = {};
                            if (!Array.isArray(global.mediaCache[chat.id])) {
                                global.mediaCache[chat.id] = [];
                            }
                            const cacheItem = { waMessageId: msg.id._serialized, base64: mediaBase64, mimeType: mediaMime, timestamp: Date.now() };
                            global.mediaCache[chat.id].push(cacheItem);
                            
                            // Limpiar este item específico de la caché después de 5 minutos
                            setTimeout(() => {
                                if (global.mediaCache[chat.id]) {
                                    global.mediaCache[chat.id] = global.mediaCache[chat.id].filter(item => item !== cacheItem);
                                    if (global.mediaCache[chat.id].length === 0) {
                                        delete global.mediaCache[chat.id];
                                    }
                                }
                            }, 5 * 60 * 1000);
                        }
                    }

                    // AHORA LO SUBIMOS SIEMPRE PARA QUE LA UI LO PUEDA REPRODUCIR/VER ONLINE
                    const axios = require('axios');
                    const FormDataNode = require('form-data');
                    const form = new FormDataNode();
                    form.append('file', buffer, { filename: `wa_${Date.now()}.${ext}`, contentType: media.mimetype });
                    
                    try {
                        let uploadUrl = process.env.CRM_API_URL;
                        if (uploadUrl.endsWith('/api/bot')) uploadUrl = uploadUrl.replace('/api/bot', '/api/upload');
                        else if (uploadUrl.endsWith('/api')) uploadUrl = uploadUrl + '/upload';
                        else uploadUrl = uploadUrl + '/upload';

                        const uploadRes = await axios.post(uploadUrl, form, {
                            headers: {
                                ...form.getHeaders(),
                                'x-api-key': process.env.BOT_API_KEY
                            }
                        });
                        
                        if (uploadRes.data && uploadRes.data.url) {
                            mediaUrl = uploadRes.data.url;
                        }
                    } catch (uploadError) {
                        console.error('Error uploading file to CRM:', uploadError.message);
                    }
                }
            } catch (e) {
                console.error('Error downloading media:', e.message);
            }
        }

        await prisma.whatsAppMessage.create({
            data: {
                chatId: chat.id,
                direction: 'INBOUND',
                type: messageType,
                content: body,
                mediaUrl: mediaUrl,
                waMessageId: msg.id._serialized,
            }
        });

        broadcastChatUpdate(chat.id);
        
        // Emitir evento para notificaciones de escritorio en el CRM
        if (global.io) {
            global.io.emit('new_message_received', {
                chatId: chat.id,
                name: profileName || chat.profileName || 'Cliente',
                phone: realPhone || chat.realPhone || waId.split('@')[0],
                content: messageType === 'TEXT' ? body : `[Mensaje ${messageType}]`,
                botEnabled: chat.botEnabled
            });
        }

        // ── Detección de solicitud de Factura ──
        if (body && messageType === 'TEXT') {
            const normalizedBody = body.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const invoiceKeywords = ['factura', 'facturar', 'facturacion', 'boleta', 'comprobante a', 'comprobante b', 'comprobante fiscal', 'afip'];
            const isRequestingInvoice = invoiceKeywords.some(keyword => normalizedBody.includes(keyword));
            
            if (isRequestingInvoice) {
                console.log(`🧾 Solicitud de factura detectada en chat ${chat.id} (${profileName || realPhone}). Notificando al administrador...`);
                
                try {
                    const axios = require('axios');
                    let notifyUrl = process.env.CRM_API_URL;
                    if (notifyUrl.endsWith('/api/bot')) {
                        notifyUrl = notifyUrl + '/notify-invoice';
                    } else if (notifyUrl.endsWith('/api')) {
                        notifyUrl = notifyUrl + '/bot/notify-invoice';
                    } else {
                        notifyUrl = notifyUrl + '/api/bot/notify-invoice';
                    }
                    
                    axios.post(notifyUrl, {
                        clientId: chat.clientId || null,
                        profileName: profileName || chat.profileName || 'Cliente Desconocido',
                        realPhone: realPhone || chat.realPhone || waId.split('@')[0],
                        messageContent: body
                    }, {
                        headers: {
                            'x-api-key': process.env.BOT_API_KEY
                        }
                    }).then(res => {
                        console.log('  ✅ Notificación de factura enviada al CRM:', res.data);
                    }).catch(err => {
                        console.error('  ❌ Error enviando notificación de factura al CRM:', err.message, err.response?.data);
                    });
                } catch (notifyErr) {
                    console.error('  ❌ Error al preparar petición de notificación de factura:', notifyErr.message);
                }
            }
        }


        // ── Filtros de Seguridad y Resiliencia (Mensajes Largos / Audios / Hostilidad) ──
        let triggerSecurityFilter = false;
        let filterReason = '';
        let taskDescription = '';

        if (agentEnabled && chat.botEnabled && !tieneTagSinBot) {
            // A. Longitud de mensaje de texto
            if (messageType === 'TEXT' && body && body.length > 500) {
                triggerSecurityFilter = true;
                filterReason = 'Mensaje entrante demasiado extenso (> 500 caracteres)';
                taskDescription = 'Atención humana requerida: Cliente envió mensaje muy largo por WhatsApp.';
            }

            // B. Duración de audio largo (si el mensaje es audio y tiene duración en los metadatos)
            if (messageType === 'AUDIO' && msg.duration && msg.duration > 120) {
                triggerSecurityFilter = true;
                filterReason = `Mensaje de voz demasiado largo (${msg.duration} segundos)`;
                taskDescription = `Atención humana requerida: Cliente envió un audio largo de ${Math.round(msg.duration / 60)} minutos.`;
            }

            // C. Expresiones hostiles de reclamo grave
            if (messageType === 'TEXT' && body) {
                const normalizedBody = body.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const hostileKeywords = [
                    'defensa al consumidor', 'coprec', 'denuncia', 'denunciar', 'estafa', 
                    'estafadores', 'sinverguenza', 'sinvergüenza', 'quiero mi plata', 
                    'devolucion', 'devolución', 'me mintieron', 'una porqueria', 'una porquería',
                    'abogado', 'carta documento'
                ];
                const matchesHostile = hostileKeywords.some(keyword => normalizedBody.includes(keyword));
                if (matchesHostile) {
                    triggerSecurityFilter = true;
                    filterReason = 'Detección de expresiones hostiles o reclamo grave';
                    taskDescription = '⚠️ ATENCIÓN URGENTE: Cliente reportó queja hostil o amenaza legal por WhatsApp.';
                }
            }
        }

        if (triggerSecurityFilter) {
            await disableBotForChatById(chat.id, `Filtro de Seguridad: ${filterReason}`);

            if (chat.clientId) {
                await prisma.clientTask.create({
                    data: {
                        clientId: chat.clientId,
                        description: taskDescription,
                        dueDate: new Date()
                    }
                }).catch(e => console.error("Error creando tarea de filtro de seguridad:", e.message));
                
                await prisma.interaction.create({
                    data: {
                        clientId: chat.clientId,
                        type: 'NOTE',
                        content: `⚠️ [Alerta Seguridad] Bot desactivado automáticamente. Razón: ${filterReason}`
                    }
                }).catch(e => console.error('Error guardando nota:', e.message));
            }

            broadcastChatUpdate(chat.id);
            return; // Abortar
        }

        // ── Detección de Comprobantes de Pago Multimodal ──
        if (messageType === 'IMAGE' && mediaBase64 && agentEnabled && chat.botEnabled && !tieneTagSinBot) {
            console.log(`  🔍 Analizando si la imagen recibida es un comprobante de pago...`);
            const isPayment = await detectPaymentReceipt(mediaBase64, mediaMime);
            if (isPayment) {
                console.log(`  💳 Comprobante de pago detectado para ${profileName || chat.waId}. Procesando cierre.`);
                
                if (chat.clientId) {
                    const { addTagToClient } = require('./tools');
                    await addTagToClient({ clientId: chat.clientId, tagName: 'Cerrado' }).catch(e => console.error("Error al asignar tag Cerrado:", e.message));
                    
                    await prisma.clientTask.create({
                        data: {
                            clientId: chat.clientId,
                            description: "Validar comprobante de pago recibido por WhatsApp.",
                            dueDate: new Date()
                        }
                    }).catch(e => console.error("Error creando tarea de pago:", e.message));

                    await prisma.interaction.create({
                        data: {
                            clientId: chat.clientId,
                            type: 'NOTE',
                            content: `📍 [HITO] Recibido comprobante de pago por WhatsApp.`
                        }
                    }).catch(e => console.error('Error guardando nota:', e.message));
                }

                const receiptConfirmation = "Buenísimo, ahí le paso el comprobante a administración para que lo registren en tu ficha!";
                botReplyingTo.add(waId);
                const sentReceipt = await sendMessage(waId, receiptConfirmation);
                setTimeout(() => botReplyingTo.delete(waId), 3000);

                await prisma.whatsAppMessage.create({
                    data: {
                        chatId: chat.id,
                        direction: 'OUTBOUND',
                        type: 'TEXT',
                        content: receiptConfirmation,
                        waMessageId: sentReceipt?.id?._serialized || `receipt_${Date.now()}`,
                        senderName: 'Bot',
                        status: 'SENT'
                    }
                });

                await disableBotForChatById(chat.id, 'Detección automática de comprobante de pago');

                broadcastChatUpdate(chat.id);
                return; // Abortar
            }
        }

        // ── Auto-Creación de Tarea por Promesa de Visita ──
        if (chat.clientId && body && messageType === 'TEXT') {
            detectAndCreateVisitTask(chat.clientId, body).catch(e => console.error("❌ Error en detectAndCreateVisitTask:", e.message));
        }

        // 3. Bot Logic — Llamada DIRECTA al grafo (sin HTTP intermedio) con DEBOUNCE
        if (agentEnabled && chat.botEnabled && !tieneTagSinBot) {
            console.log(`  🕒 Programando respuesta del bot para ${profileName} en 25s...`);
            
            if (botDebounceTimers.has(chat.id)) {
                clearTimeout(botDebounceTimers.get(chat.id));
            }

            const timer = setTimeout(() => {
                botDebounceTimers.delete(chat.id);
                processBotTurn(chat, waId, profileName, realPhone).catch(e => console.error("❌ Error async en processBotTurn:", e.message));
            }, 25000); // 25 segundos de debounce para que no sea tan inmediato

            botDebounceTimers.set(chat.id, timer);
        } else if (!chat.botEnabled) {
            console.log(`  🕒 Programando extracción pasiva para ${profileName} en 20s...`);
            
            if (passiveDebounceTimers.has(chat.id)) {
                clearTimeout(passiveDebounceTimers.get(chat.id));
            }

            const timer = setTimeout(() => {
                passiveDebounceTimers.delete(chat.id);
                processPassiveExtraction(chat.id, waId, profileName).catch(e => console.error("❌ Error async en passiveExtraction:", e.message));
            }, 20000); // 20 segundos de debounce

            passiveDebounceTimers.set(chat.id, timer);
        }

    } catch (error) {
        console.error('Error general:', error);
    }
};

// ── Health Check (exempt from auth) ────────────
app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        const waStatus = getStatus();
        res.json({ 
            status: 'ok', 
            whatsapp: waStatus.isReady,
            uptime: process.uptime()
        });
    } catch (e) {
        res.status(503).json({ status: 'error', error: e.message });
    }
});

// ── Auth middleware for API endpoints ──────────
const WA_API_KEY = process.env.WA_API_KEY;
if (!WA_API_KEY) {
    console.warn('⚠️ WARNING: WA_API_KEY not set. API endpoints are UNPROTECTED.');
}
function apiAuth(req, res, next) {
    if (!WA_API_KEY) return next(); // Sin key configurada, permitir (modo legacy)
    const key = req.headers['x-api-key'];
    if (key !== WA_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }
    next();
}
app.use('/api', apiAuth);

const { syncRecentChatsAndMessages, processMediaDownloadQueue, downloadAndUploadMediaForSyncMessage } = require('./services/sync.service');

const mediaDownloadQueue = [];
const isDownloadingMediaRef = { current: false };


// ── API REST (modular router) ──────────────────
const { createApiRouter } = require('./routes/api');
app.use('/api', createApiRouter({
    prisma,
    io,
    getStatus,
    getClient,
    sendMessage,
    sendTypingState,
    graph,
    DEFAULT_SALES_PROMPT,
    generateAndSaveHandoffSummary,
    agentState: {
        get agentEnabled() { return agentEnabled; },
        set agentEnabled(v) { agentEnabled = v; },
        get agentPrompt() { return agentPrompt; },
        set agentPrompt(v) { agentPrompt = v; },
        get dailyContext() { return dailyContext; },
        set dailyContext(v) { dailyContext = v; },
    },
    botReplyingTo,
    broadcastChatUpdate,
    disableBotForChatById,
    runOutputGuardrail,
    syncRecentChatsAndMessages: (wc) => syncRecentChatsAndMessages({ getStatus, prisma, mediaDownloadQueue, isDownloadingMediaRef, broadcastChatUpdate }, wc),
}));

// ── Start ──────────────────────────────────────
const PORT = process.env.PORT || 3100;
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 WA-Service (WhatsApp + Bot Multi-Agente) on port ${PORT}`);
    
    // Load config from DB on startup
    await loadConfig();
    
    // Programar recordatorios por inactividad cada 15 minutos
    const cronDeps = { isAgentEnabled: () => agentEnabled, botReplyingTo, broadcastChatUpdate };
    setInterval(() => {
        checkAndSendInactivityFollowUps(cronDeps).catch(e => console.error("❌ Error en follow-ups de inactividad:", e.message));
    }, 15 * 60 * 1000);

    // Generar tareas inteligentes de seguimiento de ventas cada 30 minutos
    setInterval(async () => {
        try {
            const { generateFollowUpTasks } = require('./followups/task-generator');
            const { checkAndSendSmartTasks } = require('./followups/smart-task-executor');
            
            await generateFollowUpTasks();
            await checkAndSendSalesFollowUps(cronDeps);
            await checkAndSendSmartTasks(cronDeps);
        } catch (e) {
            console.error("❌ Error en follow-ups de ventas/tareas:", e.message);
        }
    }, 30 * 60 * 1000);
    
    try {
        await initWhatsApp({ 
            onMessage: handleMessage, 
            onMessageCreate: handleMessageCreate,
            onStatusChange: (status) => {
                const wasConnected = global.lastWhatsAppConnectedState || false;
                const isNowConnected = status.isReady;
                global.lastWhatsAppConnectedState = isNowConnected;

                io.emit('bot_status', { ...status, connected: status.isReady, phone: status.connectedPhone, qr: status.qrCode, agentEnabled, prompt: agentPrompt });

                if (isNowConnected && !wasConnected) {
                    console.log('📱 WhatsApp conectado. Iniciando sincronización automática...');
                    const wc = getClient();
                    if (wc) {
                        syncRecentChatsAndMessages({ getStatus, prisma, mediaDownloadQueue, isDownloadingMediaRef, broadcastChatUpdate }, wc).catch(err => {
                            console.error('Error en auto-sync al cambiar de estado:', err);
                        });
                    }
                }
            }
        });
    } catch (err) {
        console.error('⚠️ WhatsApp no pudo inicializarse, pero el servidor sigue vivo:', err.message);
    }
});

// Evitar que errores no capturados maten el proceso
process.on('unhandledRejection', (reason) => {
    console.error('⚠️ Unhandled Rejection:', reason?.message || reason);
});

// B11: Capturar excepciones síncronas no atrapadas
process.on('uncaughtException', (err) => {
    console.error('🛑 Uncaught Exception:', err.message, err.stack);
    // No matamos el proceso para mantener el bot corriendo
});

// Graceful Shutdown: Liberar conexiones de Prisma al apagar
const shutdown = async () => {
    console.log('🛑 Cerrando WA-Service y desconectando Prisma...');
    await prisma.$disconnect();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
