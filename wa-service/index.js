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
const { graph } = require('./graph');
const { logBotMessage, isPhrase } = require('./tools');
const { HumanMessage } = require("@langchain/core/messages");
const path = require('path');
const fs = require('fs');
const os = require('os');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { initWhatsApp, getStatus, getClient, sendMessage, sendTypingState } = require('./whatsapp-client');
const { processPassiveExtraction } = require('./passive-extractor');
const { transcribeAudio } = require('./transcriber');

const configPath = path.join(__dirname, 'agent_config.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' } // Permitir conexiones del frontend
});

// Hacer io accesible globalmente para que los tools puedan emitir eventos
global.io = io;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

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

// Cache global para las imágenes en base64 de cada chat, para que los sub-agentes puedan acceder
global.mediaCache = global.mediaCache || {};

if (fs.existsSync(configPath)) {
    try {
        const conf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        agentEnabled = conf.enabled || false;
        agentPrompt = conf.prompt || '';
    } catch (e) {
        console.error("Error reading agent config:", e);
    }
}

const botMessageIds = new Set();
const botDebounceTimers = new Map();
const passiveDebounceTimers = new Map();

// ── Detección de Intervención Humana ───────────
const botReplyingTo = new Set(); // Trackear cuando el bot está enviando para evitar race conditions

const handleMessageCreate = async (msg) => {
    if (msg.fromMe) {
        const waId = msg.to;
        
        // Si el bot está activamente enviando un mensaje a este número, ignoramos la "intervención humana"
        const isBotReplying = botReplyingTo.has(waId);

        try {
            const chat = await prisma.whatsAppChat.findUnique({ where: { waId } });
            if (chat) {
                if (chat.botEnabled && !isBotReplying) {
                    await prisma.whatsAppChat.update({
                        where: { id: chat.id },
                        data: { botEnabled: false }
                    });
                    console.log(`  ⏸️ Bot pausado para ${waId} por intervención humana.`);
                }
                
                // GUARDAR EL MENSAJE EN EL CRM (UPSERT para evitar race conditions con el envío directo)
                let messageType = msg.hasMedia ? 'IMAGE' : 'TEXT';
                
                await prisma.whatsAppMessage.upsert({
                    where: { waMessageId: msg.id._serialized },
                    update: {}, // No pisamos el senderName si ya fue creado por el POST /api/send
                    create: {
                        chatId: chat.id,
                        direction: 'OUTBOUND',
                        type: messageType,
                        content: msg.body || '[Media/Documento]',
                        waMessageId: msg.id._serialized,
                    }
                });
                broadcastChatUpdate(chat.id);
            }
        } catch (e) {
            console.error("Error on message_create sync:", e);
        }
    }
};

// ── Bot Orchestrator (Extraído para Modularidad) ─
async function processBotTurn(chat, waId, profileName, realPhone) {
    try {
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
            clientData: chat.client || null,
        };
        
        const result = await graph.invoke(state, config);
        
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
                    return; 
                }
            }

            botReplyingTo.add(waId);
            const messageBlocks = responseText.split('\n\n').map(b => b.trim()).filter(b => b.length > 0);
            
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

            setTimeout(() => botReplyingTo.delete(waId), 2000);
            console.log(`  ✅ Bot respondió a ${profileName} (${result.agentType || 'UNKNOWN'}) con ${messageBlocks.length} mensajes`);
        }
    } catch (err) {
        botReplyingTo.delete(waId); // B1: limpiar tracking en caso de error
        console.error('  ❌ Error bot:', err.message);
        if (err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED'))) {
            // 1. Apagar bot en la DB para este chat
            try {
                await prisma.whatsAppChat.update({
                    where: { id: chat.id },
                    data: { botEnabled: false }
                });
                broadcastChatUpdate(chat.id);
                console.log(`  ⏹️ Bot desactivado para ${profileName} debido a límite de cuota (429).`);
            } catch (dbErr) {
                console.error('Error apagando bot en DB:', dbErr.message);
            }

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
            axios.post('http://localhost:3000/api/admin/alert', {
                subject: '🚨 ALERTA: Crédito Agotado en Bot de WhatsApp (Gemini)',
                message: 'El bot de WhatsApp intentó procesar un mensaje pero la solicitud fue rechazada por falta de créditos (Error 429: RESOURCE_EXHAUSTED).\n\nPor favor, recargá saldo en tu cuenta de Google Cloud / AI Studio para que el bot y el sistema vuelvan a funcionar.\n\nLink: https://aistudio.google.com/app/billing'
            }).catch(e => console.error('Error enviando alerta de email:', e.message));
        }
    }
}

// ── Recepción de mensajes ──────────────────────
const handleMessage = async (msg) => {
    if (msg.from.includes('@g.us') || msg.from === 'status@broadcast') return;

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
            const updateData = { lastMessageAt: new Date(), unreadCount: { increment: 1 } };
            // Solo actualizar profileName si tenemos uno válido y el chat no tiene cliente CRM
            if (profileName && !chat.clientId) updateData.profileName = profileName;
            // Solo actualizar realPhone si tenemos uno y el chat no tiene uno ya guardado
            if (realPhone && !chat.realPhone) updateData.realPhone = realPhone;
            chat = await prisma.whatsAppChat.update({
                where: { id: chat.id },
                data: updateData,
            });
        }

        // 2. Auto-vincular cliente del CRM por número de teléfono
        if (!chat.clientId && realPhone && realPhone.length >= 8) {
            const client = await prisma.client.findFirst({
                where: { phone: { contains: realPhone.slice(-8) } },
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

        // ── Chequeo de etiquetas de exclusión ──────────
        // Si el cliente tiene tag "Cancelar Bot", "No Bot", "Proveedor", etc.
        // el bot NO responde y se silencia completamente para ese chat.
        const TAGS_SIN_BOT = ['cancelar bot', 'no bot', 'proveedor', 'no interesado', 'error', 'familiar', 'personal', 'spam'];
        const clientTags = chat?.client?.tags || [];
        const tieneTagSinBot = clientTags.some(tag =>
            TAGS_SIN_BOT.some(t => tag.name.toLowerCase().includes(t))
        );
        if (tieneTagSinBot) {
            if (chat.botEnabled) {
                await prisma.whatsAppChat.update({
                    where: { id: chat.id },
                    data: { botEnabled: false }
                });
                console.log(`  🚫 Bot bloqueado para ${profileName} por etiqueta.`);
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
                    let ext = 'bin';
                    if (media.mimetype.includes('jpeg') || media.mimetype.includes('jpg')) ext = 'jpg';
                    else if (media.mimetype.includes('png')) ext = 'png';
                    else if (media.mimetype.includes('ogg') || media.mimetype.includes('audio')) ext = 'ogg';
                    else ext = 'bin';

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
                                'x-api-key': process.env.BOT_API_KEY || 'atelier-bot-secret-key-2026'
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
        } else if (agentEnabled && !chat.botEnabled && chat.clientId) {
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

// ── API REST ───────────────────────────────────

app.get('/api/status', (req, res) => {
    const status = getStatus();
    res.json({ ...status, connected: status.isReady, phone: status.connectedPhone, qr: status.qrCode, agentEnabled, prompt: agentPrompt });
});

app.get('/api/chats', async (req, res) => {
    const chats = await prisma.whatsAppChat.findMany({
        include: { client: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { lastMessageAt: 'desc' },
    });
    res.json(chats);
});

// Diagnostic + Backfill: Resolve real phone numbers for all @lid chats
app.post('/api/resolve-phones', async (req, res) => {
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

app.get('/api/chats/:id/messages', async (req, res) => {
    const messages = await prisma.whatsAppMessage.findMany({
        where: { chatId: req.params.id },
        orderBy: { createdAt: 'asc' },
    });
    await prisma.whatsAppChat.update({ where: { id: req.params.id }, data: { unreadCount: 0 } });
    res.json(messages);
});

// ── Actualizar chat: etiquetas y/o archivado ───
// PATCH /api/chats/:id  { chatLabels?, archived?, botEnabled?, clientId? }
app.patch('/api/chats/:id', async (req, res) => {
    const { id } = req.params;
    const { chatLabels, archived, botEnabled, clientId } = req.body;
    try {
        const data = {};
        if (chatLabels !== undefined) data.chatLabels = chatLabels;
        if (archived !== undefined) data.archived = archived;
        if (botEnabled !== undefined) data.botEnabled = botEnabled;
        if (clientId !== undefined) data.clientId = clientId;
        const chat = await prisma.whatsAppChat.update({ where: { id }, data });
        res.json(chat);
    } catch (e) {
        res.status(404).json({ error: 'Chat no encontrado' });
    }
});

app.post('/api/send', async (req, res) => {
    const { chatId, message, media, senderName } = req.body;
    // media: { base64: string, mimetype: string, filename?: string }
    try {
        let waId = chatId;
        let dbChatId = chatId.includes('@c.us') ? null : chatId;

        if (!chatId.includes('@c.us')) {
            const chat = await prisma.whatsAppChat.findUnique({ where: { id: chatId } });
            if (!chat) return res.status(404).json({ error: 'Chat not found' });
            waId = chat.waId;
            dbChatId = chat.id;
        }
        
        const status = getStatus();
        if (!status.isReady) return res.status(400).json({ error: 'WhatsApp not connected' });

        let sent;
        let mediaUrl = null;
        
        // Trackear que el CRM está enviando para que no haya race condition
        botReplyingTo.add(waId);

        if (media?.base64) {
            sent = await sendMessage(waId, message, media);

            // Subir al CRM para tener el pre-render
            try {
                const buffer = Buffer.from(media.base64, 'base64');
                const blob = new Blob([buffer], { type: media.mimetype });
                const f = new FormData();
                f.append('file', blob, `out_${Date.now()}_${media.filename || 'media.bin'}`);
                const uploadUrl = process.env.CRM_API_URL.replace('/api/bot', '/api/upload');
                const uploadRes = await fetch(uploadUrl, { 
                    method: 'POST', 
                    body: f,
                    headers: { 'x-api-key': process.env.BOT_API_KEY || 'atelier-bot-secret-key-2026' }
                });
                const resJson = await uploadRes.json();
                if (resJson.url) mediaUrl = resJson.url;
            } catch (err) {
                console.error("Error subiendo media saliente a CRM:", err.message);
            }
        } else {
            sent = await sendMessage(waId, message);
        }

        if (sent && sent.id && sent.id._serialized && dbChatId) {
            try {
                await prisma.whatsAppMessage.upsert({
                    where: { waMessageId: sent.id._serialized },
                    update: { senderName: senderName || 'CRM' },
                    create: {
                        chatId: dbChatId,
                        direction: 'OUTBOUND',
                        type: media ? 'IMAGE' : 'TEXT',
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

        // MARCAR COMO YA PROCESADO
        // No agregamos nada aquí, porque el CRM (botReplyingTo)
        // ya se borró, entonces message_create asumirá que es intervención humana si ocurre después.
        botReplyingTo.delete(waId);

        // Ya no guardamos el mensaje manualmente aquí para evitar duplicados.
        // Solo enviamos una respuesta exitosa, y handleMessageCreate se ocupará del DB y broadcast.
        
        if (dbChatId) broadcastChatUpdate(dbChatId);
        
        res.json({ success: true });
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

app.get('/api/agent', (req, res) => {
    res.json({ enabled: agentEnabled, prompt: agentPrompt });
});

app.post('/api/agent', (req, res) => {
    const { enabled, prompt } = req.body;
    if (enabled !== undefined) agentEnabled = enabled;
    if (prompt !== undefined) agentPrompt = prompt;
    
    fs.writeFileSync(configPath, JSON.stringify({ enabled: agentEnabled, prompt: agentPrompt }, null, 2));
    
    io.emit('bot_status', { agentEnabled, prompt: agentPrompt });
    
    res.json({ enabled: agentEnabled, prompt: agentPrompt });
});

// ── Toggle bot por chat individual ─────────────
// PATCH /api/chats/:id/bot  { "botEnabled": true/false }
// Permite activar o cancelar el bot en una sola conversación
// sin afectar el resto de los chats.
app.patch('/api/chats/:id/bot', async (req, res) => {
    const { id } = req.params;
    const { botEnabled } = req.body;
    if (typeof botEnabled !== 'boolean') {
        return res.status(400).json({ error: 'botEnabled must be a boolean' });
    }
    try {
        const chat = await prisma.whatsAppChat.update({
            where: { id },
            data: { botEnabled }
        });
        const estado = botEnabled ? '▶️ Activado' : '⏸️ Pausado';
        console.log(`  🤖 Bot ${estado} para chat ${chat.waId}`);
        broadcastChatUpdate(chat.id);
        res.json({ id: chat.id, waId: chat.waId, botEnabled: chat.botEnabled });
    } catch (e) {
        res.status(404).json({ error: 'Chat no encontrado' });
    }
});

// ── Simulador de Chat (Test) ───────────────────
app.post('/api/test/chat', async (req, res) => {
    const { messages } = req.body;
    const TEST_CHAT_ID = 'test-chat-simulator';
    try {
        const { AIMessage, HumanMessage } = require("@langchain/core/messages");
        const allMessages = messages.map(m => {
            if (m.role === 'ai') return new AIMessage(m.content);
            if (m.mediaBase64) {
                global.mediaCache = global.mediaCache || {};
                global.mediaCache[TEST_CHAT_ID] = [{ base64: m.mediaBase64, mimeType: m.mediaMime || 'image/jpeg', timestamp: Date.now() }];
                console.log(`📸 Test Chat: Imagen guardada en mediaCache['${TEST_CHAT_ID}'] (${(m.mediaBase64.length / 1024).toFixed(0)} KB)`);
                const promptMedia = `[El cliente envió una imagen adjunta. DEBES usar la herramienta 'process_prescription_subagent' INMEDIATAMENTE con este JSON exacto: {"chatId": "${TEST_CHAT_ID}", "clientId": null, "context": "Simulador de prueba", "userName": "Tester", "userPhone": "1111111111"}. Mensaje del cliente: ${m.content || 'Foto de receta'}]`;
                return new HumanMessage(promptMedia);
            }
            return new HumanMessage(m.content);
        });

        const config = { configurable: { thread_id: TEST_CHAT_ID } };
        const state = { 
            messages: allMessages,
            userPhone: '1111111111',
            userName: 'Tester',
            customPrompt: agentPrompt
        };
        
        const result = await graph.invoke(state, config);
        const lastMessage = result.messages[result.messages.length - 1];
        
        res.json({ response: lastMessage.content });
    } catch (e) {
        console.error("Error in Test Chat:", e);
        res.status(500).json({ error: e.message });
    }
});

// ── Start ──────────────────────────────────────
const PORT = process.env.PORT || 3100;
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 WA-Service (WhatsApp + Bot Multi-Agente) on port ${PORT}`);
    try {
        await initWhatsApp({ 
            onMessage: handleMessage, 
            onMessageCreate: handleMessageCreate,
            onStatusChange: (status) => {
                io.emit('bot_status', { ...status, connected: status.isReady, phone: status.connectedPhone, qr: status.qrCode, agentEnabled, prompt: agentPrompt });
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
