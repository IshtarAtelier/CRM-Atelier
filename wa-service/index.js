/**
 * WA-Service: Servidor unificado WhatsApp + Bot Multi-Agente
 * Combina el servidor de WhatsApp (whatsapp-web.js) con el cerebro del bot (LangGraph).
 * Se despliega como un servicio separado en Railway.
 */

const express = require('express');
const cors = require('cors');
const { prisma } = require('./db');
const { graph } = require('./graph');
const { logBotMessage } = require('./tools');
const { HumanMessage } = require("@langchain/core/messages");
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { initWhatsApp, getStatus, sendMessage } = require('./whatsapp-client');

const configPath = path.join(__dirname, 'agent_config.json');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
const handleMessageCreate = async (msg) => {
    if (msg.fromMe && !botMessageIds.has(msg.id._serialized)) {
        const waId = msg.to;
        try {
            const chat = await prisma.whatsAppChat.findUnique({ where: { waId } });
            if (chat) {
                if (chat.botEnabled) {
                    await prisma.whatsAppChat.update({
                        where: { id: chat.id },
                        data: { botEnabled: false }
                    });
                    console.log(`  ⏸️ Bot pausado para ${waId} por intervención humana.`);
                }
                
                // GUARDAR EL MENSAJE EN EL CRM PARA SINCRONIZACIÓN BIFÁSICA!
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
        
        if (msg.hasMedia) {
            try {
                const media = await msg.downloadMedia();
                if (media) {
                    if (media.mimetype.startsWith('audio/')) messageType = 'AUDIO';
                    else if (media.mimetype.startsWith('video/')) messageType = 'VIDEO';
                    else messageType = 'IMAGE';

                    if (messageType === 'IMAGE' || messageType === 'AUDIO') {
                        mediaBase64 = media.data;
                        mediaMime = media.mimetype;
                    }

                    // AHORA LO SUBIMOS SIEMPRE PARA QUE LA UI LO PUEDA REPRODUCIR/VER ONLINE
                    const buffer = Buffer.from(media.data, 'base64');
                    const blob = new Blob([buffer], { type: media.mimetype });
                    const f = new FormData();
                    
                    let ext = 'bin';
                    if (media.mimetype.includes('jpeg') || media.mimetype.includes('jpg')) ext = 'jpg';
                    else if (media.mimetype.includes('png')) ext = 'png';
                    else if (media.mimetype.includes('ogg') || media.mimetype.includes('audio')) ext = 'ogg';
                    else if (media.mimetype.includes('mp4') || media.mimetype.includes('video')) ext = 'mp4';
                    else if (media.mimetype.includes('pdf')) ext = 'pdf';

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

        // 3. Bot Logic — Llamada DIRECTA al grafo (sin HTTP intermedio)
        if (agentEnabled && chat.botEnabled && !tieneTagSinBot) {

            try {
                console.log(`  🤖 Bot procesando mensaje de ${profileName}...`);
                
                let messageRequest;
                if (mediaBase64) {
                    messageRequest = new HumanMessage({
                        content: [
                            { type: "text", text: body || (messageType === 'AUDIO' ? "El cliente acaba de mandar un archivo de voz. Por favor escuchalo detenidamente y respondé a lo que ponga. No digas 'he escuchado el audio' simplemente responde." : "Analiza esta imagen.") },
                            { type: "image_url", image_url: { url: `data:${mediaMime || 'image/jpeg'};base64,${mediaBase64}` } },
                        ],
                    });
                } else {
                    messageRequest = new HumanMessage(body);
                }

                const config = { configurable: { thread_id: waId } };
                const state = { 
                    messages: [messageRequest],
                    userPhone: waId.replace('@c.us', ''),
                    userName: profileName,
                    customPrompt: agentPrompt
                };
                
                const result = await graph.invoke(state, config);
                
                const lastMessage = result.messages[result.messages.length - 1];
                const responseText = lastMessage.content;

                if (responseText) {
                    const sent = await sendMessage(waId, responseText);
                    
                    // Mark as bot message to avoid human intervention detection
                    botMessageIds.add(sent.id._serialized);
                    setTimeout(() => botMessageIds.delete(sent.id._serialized), 10000);

                    // Save outbound message
                    await prisma.whatsAppMessage.create({
                        data: {
                            chatId: chat.id,
                            direction: 'OUTBOUND',
                            type: 'TEXT',
                            content: responseText,
                            waMessageId: sent.id._serialized,
                        }
                    });

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

        if (dbChatId) {
            await prisma.whatsAppMessage.create({
                data: {
                    chatId: dbChatId,
                    direction: 'OUTBOUND',
                    type: media?.base64 ? 'IMAGE' : 'TEXT',
                    content: message || '[Imagen]',
                    mediaUrl: mediaUrl,
                    waMessageId: sent.id._serialized,
                }
            });

            // Apagar bot por intervención humana desde el CRM
            await prisma.whatsAppChat.update({
                where: { id: dbChatId },
                data: { botEnabled: false }
            });
            console.log(`  ⏸️ Bot pausado para ${waId} por intervención humana (desde CRM).`);
        }
        
        res.json({ success: true });
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/agent', (req, res) => {
    const { enabled, prompt } = req.body;
    if (enabled !== undefined) agentEnabled = enabled;
    if (prompt !== undefined) agentPrompt = prompt;
    
    fs.writeFileSync(configPath, JSON.stringify({ enabled: agentEnabled, prompt: agentPrompt }, null, 2));
    
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
        res.json({ id: chat.id, waId: chat.waId, botEnabled: chat.botEnabled });
    } catch (e) {
        res.status(404).json({ error: 'Chat no encontrado' });
    }
});

// ── Start ──────────────────────────────────────
const PORT = process.env.PORT || 3100;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 WA-Service (WhatsApp + Bot Multi-Agente) on port ${PORT}`);
    initWhatsApp({ onMessage: handleMessage, onMessageCreate: handleMessageCreate });
});
