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
const { logBotMessage } = require('./tools');
const { HumanMessage } = require("@langchain/core/messages");
const path = require('path');
const fs = require('fs');
const os = require('os');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { initWhatsApp, getStatus, sendMessage } = require('./whatsapp-client');

const configPath = path.join(__dirname, 'agent_config.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' } // Permitir conexiones del frontend
});

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

// ── Detección de Intervención Humana ───────────
const botReplyingTo = new Set(); // Trackear cuando el bot está enviando para evitar race conditions

const handleMessageCreate = async (msg) => {
    if (msg.fromMe && !botMessageIds.has(msg.id._serialized)) {
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
                
                // GUARDAR EL MENSAJE EN EL CRM
                let messageType = msg.hasMedia ? 'IMAGE' : 'TEXT';
                
                await prisma.whatsAppMessage.create({
                    data: {
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

// ── Recepción de mensajes ──────────────────────
const handleMessage = async (msg) => {
    if (msg.from.includes('@g.us') || msg.from === 'status@broadcast') return;

    const waId = msg.from;
    const contact = await msg.getContact();
    const profileName = contact.pushname || contact.name || msg.from.replace('@c.us', '');
    const body = msg.body || '';

    try {
        // 1. Upsert WhatsApp Chat
        let chat = await prisma.whatsAppChat.findUnique({ where: { waId } });
        if (!chat) {
            chat = await prisma.whatsAppChat.create({
                data: { waId, profileName, status: 'OPEN', botEnabled: true, lastMessageAt: new Date() }
            });
        } else {
            await prisma.whatsAppChat.update({
                where: { id: chat.id },
                data: { lastMessageAt: new Date(), unreadCount: { increment: 1 }, profileName }
            });
        }

        // 2. Auto-vincular cliente del CRM por número de teléfono
        if (!chat.clientId) {
            const phone = waId.replace('@c.us', '');
            const client = await prisma.client.findFirst({
                where: { phone: { contains: phone.slice(-8) } },
                include: { tags: true }
            });
            if (client) {
                chat = await prisma.whatsAppChat.update({
                    where: { id: chat.id },
                    data: { clientId: client.id },
                    include: { client: { include: { tags: true } } }
                });
                console.log(`  🔗 Vinculado a cliente CRM: ${client.name}`);
            }
        } else if (!chat.client) {
            // Recargar con relaciones si ya tenía clientId
            chat = await prisma.whatsAppChat.findUnique({
                where: { id: chat.id },
                include: { client: { include: { tags: true } } }
            });
        }

        // ── Chequeo de etiquetas de exclusión ──────────
        // Si el cliente tiene tag "Cancelar Bot", "No Bot", "Proveedor", etc.
        // el bot NO responde y se silencia completamente para ese chat.
        const TAGS_SIN_BOT = ['cancelar bot', 'no bot', 'proveedor', 'no interesado', 'error'];
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
        let messageType = msg.hasMedia ? (msg.hasMedia ? 'IMAGE' : 'TEXT') : 'TEXT';
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
                    else if (media.mimetype.includes('mp4') || media.mimetype.includes('video')) ext = 'mp4';
                    else if (media.mimetype.includes('pdf')) ext = 'pdf';

                    if (messageType === 'IMAGE' || messageType === 'AUDIO') {
                        mediaMime = media.mimetype;
                        // Subir a Gemini File API para procesar con tokens baratos
                        try {
                            const tmpPath = path.join(os.tmpdir(), `wa_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`);
                            fs.writeFileSync(tmpPath, buffer);
                            
                            const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY });
                            const uploadResponse = await ai.files.upload({
                                file: tmpPath,
                                config: { mimeType: media.mimetype }
                            });
                            
                            geminiFileUri = uploadResponse.uri;
                            geminiMimeType = uploadResponse.mimeType;
                            
                            // Limpiar temporal
                            try { fs.unlinkSync(tmpPath); } catch(e){}
                            console.log('☁️ Archivo subido a Gemini File API:', geminiFileUri);
                        } catch(genaiError) {
                            console.error('Error subiendo a Gemini File API:', genaiError.message);
                        }
                    }

                    // AHORA LO SUBIMOS SIEMPRE PARA QUE LA UI LO PUEDA REPRODUCIR/VER ONLINE
                    const blob = new Blob([buffer], { type: media.mimetype });
                    const f = new FormData();
                    f.append('file', blob, `wa_${Date.now()}.${ext}`);
                    
                    try {
                        const uploadUrl = process.env.CRM_API_URL.replace('/api/bot', '/api/upload');
                        const uploadRes = await fetch(uploadUrl, { 
                            method: 'POST', body: f
                        });
                        const resJson = await uploadRes.json();
                        if (resJson.url) mediaUrl = resJson.url;
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

        // 3. Bot Logic — Llamada DIRECTA al grafo (sin HTTP intermedio)
        if (agentEnabled && chat.botEnabled && !tieneTagSinBot) {

            try {
                console.log(`  🤖 Bot procesando mensaje de ${profileName}...`);
                
                let messageRequest;
                if (geminiFileUri) {
                    const promptMedia = `[El cliente acaba de enviar un archivo adjunto. Gemini File URI: ${geminiFileUri}, MimeType: ${geminiMimeType}. Si es una foto de una receta, UTILIZA INMEDIATAMENTE la herramienta 'process_prescription_subagent' pasándole esta URI para que la extraiga. Si es audio, el sistema ya lo transcribió o procesó. Mensaje adicional del cliente: ${body}]`;
                    messageRequest = new HumanMessage(promptMedia);
                } else {
                    messageRequest = new HumanMessage(body || '[Mensaje vacío o multimedia no soportada]');
                }

                // Cargar el historial reciente de la conversación para que el bot tenga memoria
                const recentMessages = await prisma.whatsAppMessage.findMany({
                    where: { 
                        chatId: chat.id,
                        waMessageId: { not: msg.id._serialized } // Excluir el mensaje actual
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 10
                });

                const { AIMessage } = require("@langchain/core/messages");
                
                // Reconstruir el historial (el take 10 los trae de más nuevo a más viejo, hay que revertirlo)
                const history = recentMessages.reverse().map(msg => {
                    if (msg.direction === 'OUTBOUND') {
                        return new AIMessage(msg.content || '');
                    } else {
                        return new HumanMessage(msg.content || (msg.type === 'IMAGE' ? '[Imagen enviada]' : '[Audio enviado]'));
                    }
                });

                // Añadir el mensaje actual al final del historial
                const allMessages = [...history, messageRequest];

                const config = { configurable: { thread_id: waId } };
                const state = { 
                    messages: allMessages,
                    userPhone: waId.replace('@c.us', ''),
                    userName: profileName,
                    customPrompt: agentPrompt
                };
                
                const result = await graph.invoke(state, config);
                
                // Re-verificar si el bot sigue encendido luego de pensar (podría haberse apagado a sí mismo con cancelBotTool)
                const checkChat = await prisma.whatsAppChat.findUnique({ where: { id: chat.id } });
                if (!checkChat || !checkChat.botEnabled) {
                    console.log(`  ⏹️ Respuesta cancelada: el bot se desactivó a sí mismo por temas personales.`);
                    broadcastChatUpdate(chat.id);
                    return;
                }

                const lastMessage = result.messages[result.messages.length - 1];
                const responseText = lastMessage.content;

                if (responseText) {
                    // Prevenir race conditions con message_create
                    botReplyingTo.add(waId);
                    
                    const sent = await sendMessage(waId, responseText);
                    
                    // Mark as bot message to avoid human intervention detection
                    if (sent && sent.id && sent.id._serialized) {
                        botMessageIds.add(sent.id._serialized);
                        setTimeout(() => botMessageIds.delete(sent.id._serialized), 10000);
                    }

                    // Ya no guardamos el mensaje aquí manualmente. 
                    // Al haber llamado a sendMessage, whatsapp-web.js disparará el evento 'message_create'
                    // y la función handleMessageCreate se encargará de guardarlo en la DB de forma segura sin duplicar.

                    setTimeout(() => botReplyingTo.delete(waId), 2000); // Limpiar flag después de 2s

                    // Log in CRM
                    await logBotMessage({ waId, content: responseText });
                    
                    console.log(`  ✅ Bot respondió a ${profileName} (${result.agentType || 'UNKNOWN'})`);
                }
            } catch (err) {
                console.error('  ❌ Error bot:', err.message);
            }
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

app.get('/api/chats/:id/messages', async (req, res) => {
    const messages = await prisma.whatsAppMessage.findMany({
        where: { chatId: req.params.id },
        orderBy: { createdAt: 'asc' },
    });
    await prisma.whatsAppChat.update({ where: { id: req.params.id }, data: { unreadCount: 0 } });
    res.json(messages);
});

// ── Actualizar chat: etiquetas y/o archivado ───
// PATCH /api/chats/:id  { chatLabels?, archived?, botEnabled? }
app.patch('/api/chats/:id', async (req, res) => {
    const { id } = req.params;
    const { chatLabels, archived, botEnabled } = req.body;
    try {
        const data = {};
        if (chatLabels !== undefined) data.chatLabels = chatLabels;
        if (archived !== undefined) data.archived = archived;
        if (botEnabled !== undefined) data.botEnabled = botEnabled;
        const chat = await prisma.whatsAppChat.update({ where: { id }, data });
        res.json(chat);
    } catch (e) {
        res.status(404).json({ error: 'Chat no encontrado' });
    }
});

app.post('/api/send', async (req, res) => {
    const { chatId, message, media } = req.body;
    // media: { base64: string, mimetype: string, filename?: string }
    try {
        let waId = chatId;
        let dbChatId = chatId.includes('@c.us') ? null : chatId;

        if (!chatId.includes('@c.us')) {
            const chat = await prisma.whatsAppChat.findUnique({ where: { id: chatId } });
            if (!chat) return res.status(404).json({ error: 'Chat not found' });
            waId = chat.waId;
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
                    method: 'POST', body: f
                });
                const resJson = await uploadRes.json();
                if (resJson.url) mediaUrl = resJson.url;
            } catch (err) {
                console.error("Error subiendo media saliente a CRM:", err.message);
            }
        } else {
            sent = await sendMessage(waId, message);
        }

        // MARCAR COMO YA PROCESADO PARA QUE message_create NO CREA QUE ES DEL BOT
        // y aplique correctamente la pausa
        if (sent && sent.id && sent.id._serialized) {
            // A diferencia del bot, NO lo agregamos a botMessageIds porque SÍ QUEREMOS que message_create lo intercepte 
            // y asuma que hubo intervención humana para pausar el bot. 
            // handleMessageCreate se encargará de guardarlo en la DB y pausar el bot (gracias a botReplyingTo = false).
            // Entonces, borramos botReplyingTo ANTES para asegurar que se pause.
            botReplyingTo.delete(waId);
        } else {
            botReplyingTo.delete(waId);
        }

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
