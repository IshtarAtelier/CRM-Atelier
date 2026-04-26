/**
 * WhatsApp Server para CRM Atelier (v2 con LangGraph integration)
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

const BOT_SERVICE_URL = 'http://localhost:3001/chat';

// ── Estado global ──────────────────────────────
let qrCode = null;
let isReady = false;
let connectedPhone = null;
let agentEnabled = false;
let agentPrompt = '';
let dailyContext = '';

// Temporal set of message IDs sent by the bot to avoid self-disabling
const botMessageIds = new Set();
const botIsSendingTo = new Set();

// ── Cliente WhatsApp ───────────────────────────
const waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

waClient.on('qr', (qr) => {
    qrCode = qr;
    isReady = false;
    qrcode.generate(qr, { small: true });
});

waClient.on('ready', () => {
    isReady = true;
    qrCode = null;
    connectedPhone = waClient.info?.wid?.user || 'desconocido';
    console.log(`\n✅ WhatsApp conectado: ${connectedPhone}`);
});

// ── Detección de Intervención Humana ───────────
waClient.on('message_create', async (msg) => {
    if (msg.fromMe && !botMessageIds.has(msg.id._serialized)) {
        // This is an outbound message sent by a human (phone or web)
        const waId = msg.to;
        if (botIsSendingTo.has(waId)) {
            // Ignore if bot is actively sending to this chat right now
            return;
        }
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
        // 1. WhatsApp Chat (Technical)
        let chat = await prisma.whatsAppChat.findUnique({ where: { waId } });
        if (!chat) {
            chat = await prisma.whatsAppChat.create({
                data: { waId, profileName, status: 'OPEN', botEnabled: true }
            });
        } else {
            await prisma.whatsAppChat.update({
                where: { id: chat.id },
                data: { lastMessageAt: new Date(), unreadCount: { increment: 1 }, profileName }
            });
        }

        // 2. Save Message
        const messageType = msg.hasMedia ? 'IMAGE' : 'TEXT';
        let mediaBase64 = null;
        
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            if (media && media.mimetype.startsWith('image/')) {
                mediaBase64 = media.data;
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

        // 3. Bot Logic
        if (agentEnabled && chat.botEnabled) {
            try {
                console.log(`  🤖 Bot procesando mensaje de ${profileName}...`);
                
                const botRes = await axios.post(BOT_SERVICE_URL, {
                    waId,
                    content: body,
                    phone: profileName,
                    image: mediaBase64
                });

                if (botRes.data && botRes.data.response) {
                    const reply = botRes.data.response;
                    botIsSendingTo.add(waId);
                    try {
                        const sent = await waClient.sendMessage(waId, reply);
                        
                        // Mark as bot message
                        botMessageIds.add(sent.id._serialized);
                        setTimeout(() => botMessageIds.delete(sent.id._serialized), 10000);

                        // Save to DB (Outbound)
                        await prisma.whatsAppMessage.create({
                            data: {
                                chatId: chat.id,
                                direction: 'OUTBOUND',
                                type: 'TEXT',
                                content: reply,
                                waMessageId: sent.id._serialized,
                            }
                        });
                    } finally {
                        setTimeout(() => botIsSendingTo.delete(waId), 2000);
                    }
                }
            } catch (err) {
                console.error('  ❌ Error bot-service:', err.message);
                botIsSendingTo.delete(waId);
            }
        }

    } catch (error) {
        console.error('Error general:', error);
    }
});

// ── API REST ───────────────────────────────────

app.get('/api/status', (req, res) => {
    res.json({ connected: isReady, phone: connectedPhone, qr: qrCode, agentEnabled, prompt: agentPrompt, dailyContext });
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

app.post('/api/send', async (req, res) => {
    const { chatId, message } = req.body;
    try {
        const chat = await prisma.whatsAppChat.findUnique({ where: { id: chatId } });
        if (!chat || !isReady) return res.status(400).json({ error: 'Not ready' });

        const sent = await waClient.sendMessage(chat.waId, message);
        
        // Manual send - this will trigger human intervention check but we also save it
        await prisma.whatsAppMessage.create({
            data: { chatId, direction: 'OUTBOUND', type: 'TEXT', content: message, waMessageId: sent.id._serialized }
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/agent', (req, res) => {
    res.json({ enabled: agentEnabled, prompt: agentPrompt, dailyContext });
});

app.post('/api/agent', (req, res) => {
    const { enabled, prompt, dailyContext: newDailyContext } = req.body;
    if (enabled !== undefined) agentEnabled = enabled;
    if (prompt !== undefined) agentPrompt = prompt;
    if (newDailyContext !== undefined) dailyContext = newDailyContext;
    res.json({ enabled: agentEnabled, prompt: agentPrompt, dailyContext });
});

const PORT = 3100;
app.listen(PORT, () => {
    console.log(`WhatsApp Server on http://localhost:${PORT}`);
    waClient.initialize();
});
