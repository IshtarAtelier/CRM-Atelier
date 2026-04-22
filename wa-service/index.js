/**
 * WA-Service: Servidor unificado WhatsApp + Bot Multi-Agente
 * Combina el servidor de WhatsApp (whatsapp-web.js) con el cerebro del bot (LangGraph).
 * Se despliega como un servicio separado en Railway.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { graph } = require('./graph');
const { logBotMessage } = require('./tools');
const { HumanMessage } = require("@langchain/core/messages");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Estado global ──────────────────────────────
let qrCode = null;
let isReady = false;
let connectedPhone = null;
let agentEnabled = false;
let agentPrompt = '';
const botMessageIds = new Set();

// ── Cliente WhatsApp ───────────────────────────
const waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    }
});

waClient.on('qr', (qr) => {
    qrCode = qr;
    isReady = false;
    qrcode.generate(qr, { small: true });
    console.log('📱 QR generado, esperando escaneo...');
});

waClient.on('ready', () => {
    isReady = true;
    qrCode = null;
    connectedPhone = waClient.info?.wid?.user || 'desconocido';
    console.log(`\n✅ WhatsApp conectado: ${connectedPhone}`);
});

waClient.on('disconnected', (reason) => {
    isReady = false;
    console.log('❌ WhatsApp desconectado:', reason);
});

// ── Detección de Intervención Humana ───────────
waClient.on('message_create', async (msg) => {
    if (msg.fromMe && !botMessageIds.has(msg.id._serialized)) {
        const waId = msg.to;
        try {
            const chat = await prisma.whatsAppChat.findUnique({ where: { waId } });
            if (chat && chat.botEnabled) {
                await prisma.whatsAppChat.update({
                    where: { id: chat.id },
                    data: { botEnabled: false }
                });
                console.log(`  ⏸️ Bot pausado para ${waId} por intervención humana.`);
            }
        } catch (e) {}
    }
});

// ── Recepción de mensajes ──────────────────────
waClient.on('message', async (msg) => {
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
        const messageType = msg.hasMedia ? 'IMAGE' : 'TEXT';
        let mediaBase64 = null;
        
        if (msg.hasMedia) {
            try {
                const media = await msg.downloadMedia();
                if (media && media.mimetype.startsWith('image/')) {
                    mediaBase64 = media.data;
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
                            { type: "text", text: body || "Analiza esta imagen." },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${mediaBase64}` } },
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
                    const sent = await waClient.sendMessage(waId, responseText);
                    
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
});

// ── API REST ───────────────────────────────────

app.get('/api/status', (req, res) => {
    res.json({ connected: isReady, phone: connectedPhone, qr: qrCode, agentEnabled, prompt: agentPrompt });
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
    const { chatId, message } = req.body;
    try {
        // Support sending by chatId (db id) OR waId (phone@c.us)
        let waId = chatId;
        if (!chatId.includes('@c.us')) {
            const chat = await prisma.whatsAppChat.findUnique({ where: { id: chatId } });
            if (!chat) return res.status(404).json({ error: 'Chat not found' });
            waId = chat.waId;
        }
        
        if (!isReady) return res.status(400).json({ error: 'WhatsApp not connected' });

        const sent = await waClient.sendMessage(waId, message);
        
        // Find or skip DB log for direct waId sends
        if (!chatId.includes('@c.us')) {
            await prisma.whatsAppMessage.create({
                data: { chatId, direction: 'OUTBOUND', type: 'TEXT', content: message, waMessageId: sent.id._serialized }
            });
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
    waClient.initialize();
});
