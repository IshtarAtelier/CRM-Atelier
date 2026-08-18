/**
 * Entrada del wa-service con la API OFICIAL de WhatsApp (WA_TRANSPORT=cloud).
 *
 * Es el `index.js` sin nada de lo que la API oficial hace innecesario o
 * prohibido: sin Chromium, sin QR, sin sesión, sin cola anti-ban, sin bot IA,
 * sin seguimientos automáticos, sin extractor pasivo. Queda:
 *
 *   - la misma API REST que consume el CRM (routes/api.js) con el transporte
 *     cloud debajo (transport/cloud-transport.js);
 *   - las rutas propias de la API oficial (transport/cloud-routes.js);
 *   - el webhook de Meta (transport/webhook.js) → Postgres + socket.io;
 *   - la misma auth (BOT_API_KEY / token de socket) y el mismo /health.
 *
 * Lo elige start.js. index.js (WhatsApp Web) sigue existiendo como transporte
 * legacy hasta que la migración del número termine.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { prisma } = require('./db');
const transport = require('./transport/cloud-transport');
const { createWebhookRouter } = require('./transport/webhook');
const { createCloudRoutes } = require('./transport/cloud-routes');
const { createApiRouter } = require('./routes/api');
const { verificarSocketToken } = require('./shared/socket-token');
const { BotReplyingSet } = require('./shared/bot-replying');

const PORT = process.env.PORT || 3100;
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'];
const WA_API_KEY = process.env.BOT_API_KEY || process.env.WA_API_KEY;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ALLOWED_ORIGINS } });
global.io = io;
global.crmSendingTo = new Map();

app.use(cors({ origin: ALLOWED_ORIGINS }));

// ── Webhook de Meta: ANTES del express.json global (necesita el body crudo) ──
app.use('/webhook/whatsapp', createWebhookRouter({ io }));

app.use(express.json({ limit: '10mb' }));

// ── Health (sin auth) ─────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        const s = transport.getStatus();
        res.json({ status: 'ok', transport: 'cloud', whatsapp: s.isReady, phone: s.connectedPhone, quality: s.qualityRating, uptime: process.uptime() });
    } catch (e) {
        res.status(503).json({ status: 'error', error: e.message });
    }
});

// ── Auth REST (misma regla que index.js) ─────────────────────────────────────
if (!WA_API_KEY) {
    console.warn('⚠️ Ni BOT_API_KEY ni WA_API_KEY: la API queda ABIERTA. Avisando por email.');
    transport.notifyAdminDown('API del bot sin clave', 'El wa-service (API oficial) arrancó sin BOT_API_KEY ni WA_API_KEY. Setearla en Railway y redeployar.').catch(() => {});
}
app.use('/api', (req, res, next) => {
    if (!WA_API_KEY) return next();
    if (req.headers['x-api-key'] === WA_API_KEY) return next();
    return res.status(401).json({ error: 'Unauthorized' });
});

// ── Auth socket.io (misma regla que index.js) ────────────────────────────────
io.use((socket, next) => {
    if (!WA_API_KEY) return next();
    if (socket.handshake.headers['x-api-key'] === WA_API_KEY) return next();
    const quien = verificarSocketToken(socket.handshake.auth && socket.handshake.auth.token, WA_API_KEY);
    if (quien) { socket.data.user = quien; return next(); }
    console.warn(`[Socket Auth] Conexión rechazada desde ${socket.handshake.address || 'desconocida'}`);
    next(new Error('Unauthorized'));
});
io.on('connection', (socket) => {
    const s = transport.getStatus();
    socket.emit('bot_status', { ...s, connected: s.isReady, phone: s.connectedPhone, qr: null, agentEnabled: false, followupsEnabled: false, prompt: '' });
});

// ── Rutas ────────────────────────────────────────────────────────────────────
const botReplyingTo = new BotReplyingSet();
app.use('/api', createCloudRoutes({ transport }));
app.use('/api', createApiRouter({
    prisma,
    io,
    getStatus: transport.getStatus,
    getClient: () => null,
    sendMessage: transport.sendMessage,
    sendTypingState: transport.sendTypingState,
    graph: null,
    DEFAULT_SALES_PROMPT: '',
    generateAndSaveHandoffSummary: async () => null,
    agentState: { agentEnabled: false, followupsEnabled: false, agentPrompt: '', dailyContext: '' },
    botReplyingTo,
    broadcastChatUpdate: (chatId) => io.emit('chat_updated', { chatId }),
    disableBotForChatById: async () => null, // no hay bot que apagar
    runOutputGuardrail: async (t) => ({ ok: true, text: t }),
    syncRecentChatsAndMessages: async () => ({ skipped: true }),
}));

server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 wa-service (API oficial) escuchando en ${PORT}`);
    await transport.init();
});

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e && e.message));
