/**
 * API Routes for WA-Service
 * 
 * All /api/* routes extracted from index.js into a modular Express Router.
 * Mounted at /api in index.js (so paths here are relative, e.g. /status not /api/status).
 * 
 * Dependencies are injected via createApiRouter(deps) to avoid tight coupling
 * with the parent module's mutable state.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { getFileExtension } = require('../utils');

const configPath = path.join(__dirname, '..', 'agent_config.json');

/**
 * Creates and returns an Express Router with all /api/* routes.
 * @param {Object} deps - Shared dependencies from index.js
 * @param {import('@prisma/client').PrismaClient} deps.prisma
 * @param {import('socket.io').Server} deps.io
 * @param {Function} deps.getStatus
 * @param {Function} deps.getClient
 * @param {Function} deps.sendMessage
 * @param {Function} deps.sendTypingState
 * @param {Object} deps.graph - LangGraph compiled graph
 * @param {string} deps.DEFAULT_SALES_PROMPT
 * @param {Function} deps.generateAndSaveHandoffSummary
 * @param {Object} deps.agentState - Getter/setter proxy for mutable agent globals
 * @param {Set} deps.botReplyingTo
 * @param {Function} deps.broadcastChatUpdate
 * @param {Function} deps.disableBotForChatById
 * @param {Function} deps.runOutputGuardrail
 * @param {Function} deps.syncRecentChatsAndMessages
 */
function createApiRouter(deps) {
    const {
        prisma,
        io,
        getStatus,
        getClient,
        sendMessage,
        sendTypingState,
        graph,
        DEFAULT_SALES_PROMPT,
        generateAndSaveHandoffSummary,
        agentState,
        botReplyingTo,
        broadcastChatUpdate,
        disableBotForChatById,
        runOutputGuardrail,
        syncRecentChatsAndMessages,
    } = deps;

    const router = express.Router();

    // ── GET /status ────────────────────────────────
    router.get('/status', (req, res) => {
        const status = getStatus();
        res.json({
            ...status,
            connected: status.isReady,
            phone: status.connectedPhone,
            qr: status.qrCode,
            agentEnabled: agentState.agentEnabled,
            prompt: agentState.agentPrompt,
        });
    });

    // ── GET /chats ─────────────────────────────────
    router.get('/chats', async (req, res) => {
        let chats = await prisma.whatsAppChat.findMany({
            include: { client: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
            orderBy: { lastMessageAt: 'desc' },
        });


        res.json(chats);
    });

    // ── POST /resolve-phones ───────────────────────
    // Diagnostic + Backfill: Resolve real phone numbers for all @lid chats
    router.post('/resolve-phones', async (req, res) => {
        const wc = getClient();
        if (!wc) return res.status(400).json({ error: 'WhatsApp client not ready' });

        const lidChats = await prisma.whatsAppChat.findMany({
            where: { waId: { contains: '@lid' }, realPhone: null },
            include: { client: true }
        });

        const results = [];

        for (const chat of lidChats) {
            let resolved = null;

            // Method 1: getContactLidAndPhone
            try {
                if (typeof wc.getContactLidAndPhone === 'function') {
                    const mapping = await wc.getContactLidAndPhone([chat.waId]);
                    if (mapping && mapping.length > 0 && mapping[0].pn) {
                        resolved = mapping[0].pn.replace('@c.us', '').replace('@s.whatsapp.net', '');
                    }
                }
            } catch (e) { console.error(`  Error M1 for ${chat.waId}:`, e.message); }

            // Method 2: getFormattedNumber
            if (!resolved) {
                try {
                    const formatted = await wc.getFormattedNumber(chat.waId);
                    if (formatted && formatted.length >= 8) {
                        resolved = formatted.replace(/[^0-9]/g, '');
                    }
                } catch (e) { /* ignore */ }
            }

            // Method 3: getChatById
            if (!resolved) {
                try {
                    const chatObj = await wc.getChatById(chat.waId);
                    if (chatObj?.id?.user && /^\d{8,}$/.test(chatObj.id.user)) {
                        resolved = chatObj.id.user;
                    }
                } catch (e) { /* ignore */ }
            }

            // Method 4: CRM client phone
            if (!resolved && chat.client?.phone) {
                resolved = chat.client.phone;
            }

            if (resolved) {
                await prisma.whatsAppChat.update({ where: { id: chat.id }, data: { realPhone: resolved } });
            }

            results.push({
                name: chat.profileName || chat.waId,
                waId: chat.waId,
                resolved: resolved || 'NOT_RESOLVED',
                method: resolved ? (resolved === chat.client?.phone ? 'CRM' : 'WhatsApp API') : null
            });
        }

        res.json({ total: lidChats.length, resolved: results.filter(r => r.resolved !== 'NOT_RESOLVED').length, results });
    });

    // ── GET /chats/:id/messages ────────────────────
    router.get('/chats/:id/messages', async (req, res) => {
        const messages = await prisma.whatsAppMessage.findMany({
            where: { chatId: req.params.id },
            orderBy: { createdAt: 'asc' },
        });
        await prisma.whatsAppChat.update({ where: { id: req.params.id }, data: { unreadCount: 0 } });
        res.json(messages);
    });

    // ── PATCH /chats/:id ───────────────────────────
    // Update chat: labels, archived, botEnabled, clientId, chatSummary
    router.patch('/chats/:id', async (req, res) => {
        const { id } = req.params;
        const { chatLabels, archived, botEnabled, clientId, chatSummary } = req.body;
        try {
            const data = {};
            if (chatLabels !== undefined) data.chatLabels = chatLabels;
            if (archived !== undefined) data.archived = archived;
            if (clientId !== undefined) data.clientId = clientId;
            if (chatSummary !== undefined) data.chatSummary = chatSummary;
            
            let chat = await prisma.whatsAppChat.findUnique({ where: { id } });
            if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });

            if (archived === false && chat.archived === true) {
                data.lastMessageAt = new Date();
            }

            if (botEnabled === false) {
                await disableBotForChatById(id, 'API patch CRM (Vendedor desactivó el bot)');
                // Agregar etiqueta para evitar auto-resume si no existe (array-safe)
                let currentLabels = Array.isArray(data.chatLabels) ? data.chatLabels : (Array.isArray(chat.chatLabels) ? [...chat.chatLabels] : []);
                if (!currentLabels.includes('[SISTEMA - BOT APAGADO]')) {
                    currentLabels.push('[SISTEMA - BOT APAGADO]');
                }
                data.chatLabels = currentLabels;
                chat = await prisma.whatsAppChat.update({ where: { id }, data });
            } else {
                if (botEnabled === true) {
                    data.botEnabled = true;
                    // Si el vendedor activa el bot manualmente, quitamos la etiqueta de apagado manual (array-safe)
                    let currentLabels = Array.isArray(data.chatLabels) ? data.chatLabels : (Array.isArray(chat.chatLabels) ? [...chat.chatLabels] : []);
                    data.chatLabels = currentLabels.filter(l => l !== '[SISTEMA - BOT APAGADO]');
                } else if (botEnabled !== undefined) {
                    data.botEnabled = botEnabled;
                }
                chat = await prisma.whatsAppChat.update({ where: { id }, data });
            }
            res.json(chat);
        } catch (e) {
            res.status(404).json({ error: 'Chat no encontrado' });
        }
    });

    // ── POST /send ─────────────────────────────────
    router.post('/send', async (req, res) => {
        const { chatId, message, media, senderName } = req.body;
        // media: { base64: string, mimetype: string, filename?: string }
        try {
            let waId = chatId;
            let dbChatId = null;

            if (!chatId.includes('@c.us') && !chatId.includes('@lid')) {
                const chat = await prisma.whatsAppChat.findUnique({ where: { id: chatId } });
                if (!chat) return res.status(404).json({ error: 'Chat not found' });
                waId = chat.waId;
                dbChatId = chat.id;
            } else {
                // Si es un waId directo, intentamos buscar si ya existe en la DB por waId o realPhone
                const cleanPhone = chatId.replace('@c.us', '').replace('@lid', '');
                const chat = await prisma.whatsAppChat.findFirst({
                    where: {
                        OR: [
                            { waId: chatId },
                            { realPhone: cleanPhone }
                        ]
                    }
                });
                if (chat) {
                    dbChatId = chat.id;
                    waId = chat.waId; // Usamos el waId real de la DB (por si es @lid!)
                }
            }
            
            const status = getStatus();
            if (!status.isReady) return res.status(400).json({ error: 'WhatsApp not connected' });

            let sent;
            let mediaUrl = null;
            
            // Trackear que el CRM está enviando para que no haya race condition
            botReplyingTo.add(waId);

            if (media?.base64) {
                sent = await sendMessage(waId, message, media, { isProactive: false, isAutomated: false });

                // Subir al CRM para tener el pre-render
                try {
                    const buffer = Buffer.from(media.base64, 'base64');
                    const blob = new Blob([buffer], { type: media.mimetype });
                    const f = new FormData();
                    let outExt = 'bin';
                    if (media.filename) {
                        const parts = media.filename.split('.');
                        if (parts.length > 1) outExt = parts.pop().toLowerCase();
                    }
                    if (outExt === 'bin' && media.mimetype) {
                        outExt = getFileExtension(media.mimetype);
                    }
                    const filename = media.filename ? (media.filename.includes('.') ? media.filename : `${media.filename}.${outExt}`) : `media.${outExt}`;
                    f.append('file', blob, `out_${Date.now()}_${filename}`);
                    const uploadUrl = process.env.CRM_API_URL.replace('/api/bot', '/api/upload');
                    const uploadRes = await fetch(uploadUrl, { 
                        method: 'POST', 
                        body: f,
                        headers: { 'x-api-key': process.env.BOT_API_KEY }
                    });
                    const resJson = await uploadRes.json();
                    if (resJson.url) mediaUrl = resJson.url;
                } catch (err) {
                    console.error("Error subiendo media saliente a CRM:", err.message);
                }
            } else {
                sent = await sendMessage(waId, message, null, { isProactive: false, isAutomated: false });
            }

            if (sent && sent.id && sent.id._serialized && dbChatId) {
                try {
                    const msgType = media 
                        ? (media.mimetype?.startsWith('audio/') 
                            ? 'AUDIO' 
                            : (media.mimetype?.startsWith('video/') 
                                ? 'VIDEO' 
                                : (media.mimetype?.startsWith('image/') 
                                    ? 'IMAGE' 
                                    : 'DOCUMENT')))
                        : 'TEXT';

                    await prisma.whatsAppMessage.upsert({
                        where: { waMessageId: sent.id._serialized },
                        update: { senderName: senderName || 'CRM' },
                        create: {
                            chatId: dbChatId,
                            direction: 'OUTBOUND',
                            type: msgType,
                            content: message || '[Media]',
                            mediaUrl: mediaUrl,
                            waMessageId: sent.id._serialized,
                            senderName: senderName || 'CRM',
                            status: 'SENT'
                        }
                    });
                } catch (e) {
                    console.error('Error guardando senderName del CRM:', e.message);
                }
            }

            // Limpiar flag de botReplyingTo y DESACTIVAR el bot, ya que un humano tomó el control
            botReplyingTo.delete(waId);
            if (dbChatId) {
                await disableBotForChatById(dbChatId, 'Intervención humana (mensaje desde CRM)');
            }

            // Ya no guardamos el mensaje manualmente aquí para evitar duplicados.
            // Solo enviamos una respuesta exitosa, y handleMessageCreate se ocupará del DB y broadcast.
            
            if (dbChatId) broadcastChatUpdate(dbChatId);
            
            res.json({ success: true });
        } catch (e) { 
            res.status(500).json({ error: e.message }); 
        }
    });

    // ── GET /agent ─────────────────────────────────
    router.get('/agent', (req, res) => {
        const hasApiKey = !!(process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY);
        const displayPrompt = (!agentState.agentPrompt || agentState.agentPrompt.trim().length <= 300) ? DEFAULT_SALES_PROMPT : agentState.agentPrompt;
        res.json({ enabled: agentState.agentEnabled, prompt: displayPrompt, configured: hasApiKey, dailyContext: agentState.dailyContext });
    });

    // ── POST /agent ────────────────────────────────
    router.post('/agent', async (req, res) => {
        const { enabled, prompt, dailyContext: newDailyContext } = req.body;
        if (enabled !== undefined) agentState.agentEnabled = enabled;
        if (prompt !== undefined) agentState.agentPrompt = prompt;
        if (newDailyContext !== undefined) agentState.dailyContext = newDailyContext;
        
        try {
            fs.writeFileSync(configPath, JSON.stringify({ enabled: agentState.agentEnabled, prompt: agentState.agentPrompt, dailyContext: agentState.dailyContext }, null, 2));
            
            if (enabled !== undefined) {
                await prisma.systemSetting.upsert({
                    where: { key: 'bot_enabled' },
                    update: { value: String(agentState.agentEnabled) },
                    create: { key: 'bot_enabled', value: String(agentState.agentEnabled) }
                });
            }
            if (prompt !== undefined) {
                await prisma.systemSetting.upsert({
                    where: { key: 'bot_prompt' },
                    update: { value: agentState.agentPrompt },
                    create: { key: 'bot_prompt', value: agentState.agentPrompt }
                });
            }
            if (newDailyContext !== undefined) {
                await prisma.systemSetting.upsert({
                    where: { key: 'bot_daily_context' },
                    update: { value: agentState.dailyContext },
                    create: { key: 'bot_daily_context', value: agentState.dailyContext }
                });
            }
        } catch (e) {
            console.error("❌ Error persisting config to database:", e);
        }
        
        const hasApiKey = !!(process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY);
        io.emit('bot_status', { agentEnabled: agentState.agentEnabled, prompt: agentState.agentPrompt, configured: hasApiKey, dailyContext: agentState.dailyContext });
        res.json({ enabled: agentState.agentEnabled, prompt: agentState.agentPrompt, configured: hasApiKey, dailyContext: agentState.dailyContext });
    });

    // ── PATCH /chats/:id/bot ───────────────────────
    // Toggle bot por chat individual
    // Permite activar o cancelar el bot en una sola conversación
    // sin afectar el resto de los chats.
    router.patch('/chats/:id/bot', async (req, res) => {
        const { id } = req.params;
        const { botEnabled } = req.body;
        if (typeof botEnabled !== 'boolean') {
            return res.status(400).json({ error: 'botEnabled must be a boolean' });
        }
        try {
            if (!botEnabled) {
                // Usar disableBotForChatById para consistencia (genera handoff, cancela timers)
                await disableBotForChatById(id, 'API patch CRM (Vendedor desactivó el bot)');
                const chat = await prisma.whatsAppChat.findUnique({ where: { id } });
                res.json({ id: chat.id, waId: chat.waId, botEnabled: chat.botEnabled });
            } else {
                const chatCheck = await prisma.whatsAppChat.findUnique({ 
                    where: { id },
                    include: { client: { include: { tags: true } } }
                });
                const hasCancelBot = chatCheck.client?.tags?.some(t => t.name.toLowerCase() === 'cancelar bot');
                if (hasCancelBot) {
                    return res.status(403).json({ error: 'No se puede activar el bot porque el cliente tiene la etiqueta Cancelar Bot. Quítela primero para habilitarlo.' });
                }

                const chat = await prisma.whatsAppChat.update({
                    where: { id },
                    data: { botEnabled: true }
                });
                console.log(`  🤖 Bot ▶️ Activado para chat ${chat.waId}`);
                broadcastChatUpdate(chat.id);
                res.json({ id: chat.id, waId: chat.waId, botEnabled: chat.botEnabled });
            }
        } catch (e) {
            res.status(404).json({ error: 'Chat no encontrado' });
        }
    });

    // ── POST /sync ─────────────────────────────────
    router.post('/sync', async (req, res) => {
        const status = getStatus();
        if (!status.isReady) {
            return res.status(400).json({ success: false, error: 'WhatsApp no está conectado' });
        }
        const wc = getClient();
        if (!wc) {
            return res.status(400).json({ success: false, error: 'WhatsApp client no disponible' });
        }
        // Ejecutar asíncronamente en background para no bloquear el request
        syncRecentChatsAndMessages(wc).catch(err => {
            console.error('Error in manual sync:', err);
        });
        res.json({ success: true, message: 'Sincronización iniciada en segundo plano.' });
    });

    // ── POST /test/chat ────────────────────────────
    // Simulador de Chat (Test)
    // Réplica exacta del flujo real (processBotTurn) para testing fiel.
    router.post('/test/chat', async (req, res) => {
        const { messages, testName, testPhone } = req.body;
        const TEST_CHAT_ID = 'test-chat-simulator';
        const TEST_WA_ID = 'test@simulator';
        try {
            const { AIMessage, HumanMessage } = require("@langchain/core/messages");
            
            // Reconstruir historial exactamente como lo hace processBotTurn
            const allMessages = messages.map(m => {
                if (m.role === 'ai') return new AIMessage(m.content || '');
                
                // Imagen: enviar como multimodal (igual que el flujo real)
                if (m.mediaBase64 && (!m.mediaType || m.mediaType === 'image')) {
                    global.mediaCache = global.mediaCache || {};
                    global.mediaCache[TEST_CHAT_ID] = [{ base64: m.mediaBase64, mimeType: m.mediaMime || 'image/jpeg', timestamp: Date.now() }];
                    console.log(`📸 Test Chat: Imagen guardada en mediaCache['${TEST_CHAT_ID}'] (${(m.mediaBase64.length / 1024).toFixed(0)} KB)`);
                    
                    return new HumanMessage({
                        content: [
                            { type: "text", text: `[Imagen adjunta. Mensaje del cliente: "${m.content || '(sin texto)'}"]` },
                            { type: "image_url", image_url: { url: `data:${m.mediaMime || 'image/jpeg'};base64,${m.mediaBase64}` } }
                        ]
                    });
                }

                // Audio: enviar como texto transcrito (igual que el flujo real)
                if (m.mediaType === 'audio') {
                    return new HumanMessage(`[El cliente envió un audio transcrito. Mensaje: ${m.content || '(sin texto)'}]`);
                }
                
                return new HumanMessage(m.content || '[Mensaje vacío]');
            });

            // State idéntico al de processBotTurn
            const config = { configurable: { thread_id: TEST_CHAT_ID } };
            const state = { 
                messages: allMessages,
                userPhone: testPhone || '1111111111',
                userName: testName || 'Tester',
                waId: TEST_WA_ID,
                chatId: TEST_CHAT_ID,
                customPrompt: agentState.agentPrompt,
                dailyContext: agentState.dailyContext,
                clientData: null,
                chatSummary: null,
            };
            
            const result = await graph.invoke(state, config);

            // ── Extraer tool calls para debug (igual que el flujo real) ──
            const toolCalls = [];
            let hasPersonalOrCancelToolCall = false;
            let hasApiError = false;
            let apiErrorMessage = '';

            if (result && result.messages) {
                for (const msg of result.messages) {
                    // Recopilar tool calls para debug
                    if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
                        for (const call of msg.tool_calls) {
                            toolCalls.push({ name: call.name, args: call.args });
                            if (call.name === 'disable_bot_for_personal_chat' || call.name === 'cancel_bot') {
                                hasPersonalOrCancelToolCall = true;
                            }
                        }
                    }
                    // Detectar errores de API en tool messages
                    const isToolMsg = msg.tool_call_id !== undefined || (typeof msg.getType === 'function' && msg.getType() === 'tool') || msg._getType === 'tool';
                    if (isToolMsg && msg.content && (msg.content.includes('getaddrinfo') || msg.content.includes('ECONNREFUSED') || msg.content.includes('404') || msg.content.includes('500') || msg.content.includes('Network Error'))) {
                        hasApiError = true;
                        apiErrorMessage = msg.content.substring(0, 150);
                    }
                }
            }

            // ── Guardrail de desactivación silenciosa ──
            if (hasPersonalOrCancelToolCall) {
                return res.json({ response: null, blocks: [], silentShutdown: true, reason: 'Detección de chat personal/cancelación silenciosa', toolCalls });
            }

            // ── Guardrail de errores de API ──
            if (hasApiError) {
                return res.json({ response: null, blocks: [], apiError: true, reason: apiErrorMessage, toolCalls });
            }

            const lastMessage = result.messages[result.messages.length - 1];
            let responseText = lastMessage.content;

            if (responseText) {
                // Output Guardrail (igual que el flujo real)
                const guardrail = runOutputGuardrail(responseText);
                if (!guardrail.safe) {
                    console.warn(`  ⚠️ [Test Chat Guardrail] Respuesta bloqueada: ${guardrail.reason}`);
                    return res.json({ response: 'Dejame revisarlo bien y en un ratito te respondo con la info exacta.', blocks: ['Dejame revisarlo bien y en un ratito te respondo con la info exacta.'], guardrailBlocked: true, guardrailReason: guardrail.reason, toolCalls });
                }
                
                // Limpieza de signos de apertura (igual que el flujo real)
                responseText = responseText.replace(/¿/g, '');
            }

            // Splitear en bloques (igual que el flujo real en index.js:680)
            const blocks = responseText ? responseText.split('\n\n').map(b => b.trim()).filter(b => b.length > 0) : [];
            
            res.json({ response: responseText, blocks, toolCalls });
        } catch (e) {
            console.error("Error in Test Chat:", e);
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}

module.exports = { createApiRouter };
