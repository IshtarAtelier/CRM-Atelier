/**
 * Entrada del wa-service con la API OFICIAL de WhatsApp (WA_TRANSPORT=cloud).
 *
 * Es el `index.js` sin nada de lo que la API oficial hace innecesario o
 * prohibido: sin Chromium, sin QR, sin sesión, sin cola anti-ban, sin
 * seguimientos automáticos, sin extractor pasivo. Queda:
 *
 *   - la misma API REST que consume el CRM (routes/api.js) con el transporte
 *     cloud debajo (transport/cloud-transport.js);
 *   - las rutas propias de la API oficial (transport/cloud-routes.js);
 *   - el webhook de Meta (transport/webhook.js) → Postgres + socket.io;
 *   - el agente de ventas IA (bot-cloud.js), que contesta EN horario comercial
 *     mientras `bot_enabled` esté prendido;
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
const { SeenOnce } = require('./shared/inbound-once');
const { createAutoResponder } = require('./auto-responder');
const { createCloudBot } = require('./bot-cloud');

const PORT = process.env.PORT || 3100;
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'];
const WA_API_KEY = process.env.BOT_API_KEY || process.env.WA_API_KEY;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ALLOWED_ORIGINS } });
global.io = io;
global.crmSendingTo = new Map();

app.use(cors({ origin: ALLOWED_ORIGINS }));

const botReplyingTo = new BotReplyingSet();
const broadcastChatUpdate = (chatId) => io.emit('chat_updated', { chatId });

// ── Quién atiende un entrante ────────────────────────────────────────────────
// Dos automatismos comparten el mismo hook y NO se pisan porque se reparten el
// reloj: el agente de ventas atiende EN horario comercial, el auto-respondedor
// solo con el local cerrado.
//
//  1. bot (bot-cloud.js) — IA, solo si `bot_enabled` está prendido y el local
//     está abierto. Devuelve true cuando se hace cargo → corta la cadena.
//  2. auto-respondedor (auto-responder.js) — un mensaje fijo identificado como
//     automático, solo fuera de horario. Se autoguarda con sus cinco reglas.
//
// Para sumar un manejador nuevo alcanza con agregarlo al array: cada uno
// recibe (msg, resultadoDePersistInbound) y devuelve true si se hizo cargo.
const bot = createCloudBot({ prisma, io, transport, botReplyingTo, broadcastChatUpdate });
const autoResponder = createAutoResponder({ prisma, io, sendMessage: transport.sendMessage });
const inboundHandlers = [bot.handleInbound, autoResponder.onInbound];

// Meta reintenta el webhook: un mismo wamid se atiende UNA sola vez (la
// persistencia ya es idempotente; esto protege a las REACCIONES).
const entrantesVistos = new SeenOnce();

/**
 * Hook del webhook. Fire-and-forget a propósito: el entrante ya está guardado y
 * Meta ya recibió su 200 — nada de lo que pase acá puede romper ninguna de las
 * dos cosas, así que la cadena corre desprendida y todo error termina en un log.
 */
function dispatchInbound(msg, res) {
    if (!entrantesVistos.first(msg && msg.wamid)) {
        console.log(`  ♻️ [Inbound] ${msg.wamid} ya se había atendido (reintento de Meta): no se responde de nuevo.`);
        return;
    }
    (async () => {
        for (const handler of inboundHandlers) {
            try {
                if (await handler(msg, res)) return; // se hizo cargo
            } catch (e) {
                console.error('[Inbound] Manejador falló (se sigue con el siguiente):', e && e.message);
            }
        }
    })().catch(e => console.error('[Inbound] Error en la cadena de manejadores:', e && e.message));
}

// ── Webhook de Meta: ANTES del express.json global (necesita el body crudo) ──
// Solo recibe ENTRANTES reales: los ecos del celular (smb_message_echoes) los
// persiste `persistEcho` y jamás pasan por acá, así que ningún automatismo le
// contesta a un mensaje que escribió el propio negocio.
app.use('/webhook/whatsapp', createWebhookRouter({ io, onInbound: dispatchInbound }));

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

// Comparación en tiempo constante (auditoría 20/8, B1)
const __crypto = require('crypto');
function keyOk(v) {
    return typeof v === 'string' && WA_API_KEY
        && Buffer.byteLength(v) === Buffer.byteLength(WA_API_KEY)
        && __crypto.timingSafeEqual(Buffer.from(v), Buffer.from(WA_API_KEY));
}
app.use('/api', (req, res, next) => {
    if (!WA_API_KEY) return next();
    if (keyOk(req.headers['x-api-key'])) return next();
    return res.status(401).json({ error: 'Unauthorized' });
});

// ── Auth socket.io (misma regla que index.js) ────────────────────────────────
io.use((socket, next) => {
    if (!WA_API_KEY) return next();
    if (keyOk(socket.handshake.headers['x-api-key'])) return next();
    const quien = verificarSocketToken(socket.handshake.auth && socket.handshake.auth.token, WA_API_KEY);
    if (quien) { socket.data.user = quien; return next(); }
    console.warn(`[Socket Auth] Conexión rechazada desde ${socket.handshake.address || 'desconocida'}`);
    next(new Error('Unauthorized'));
});
io.on('connection', (socket) => {
    const s = transport.getStatus();
    socket.emit('bot_status', { ...s, connected: s.isReady, phone: s.connectedPhone, qr: null, agentEnabled: bot.agentState.agentEnabled, followupsEnabled: false, prompt: bot.agentState.agentPrompt });
});

// ── Rutas ────────────────────────────────────────────────────────────────────
// `createCloudRoutes` recibe el bot para NO pisar /api/agent con un 410: el
// toggle "Asistente" del panel escribe `bot_enabled` por esa ruta y es el
// interruptor que apaga al bot sin deploy.
app.use('/api', createCloudRoutes({ transport, bot }));
app.use('/api', createApiRouter({
    prisma,
    io,
    getStatus: transport.getStatus,
    getClient: () => null,
    sendMessage: transport.sendMessage,
    sendTypingState: transport.sendTypingState,
    graph: bot.graph,
    DEFAULT_SALES_PROMPT: require('./prompts/salesPrompt'),
    generateAndSaveHandoffSummary: bot.generateAndSaveHandoffSummary,
    agentState: bot.agentState,
    botReplyingTo,
    broadcastChatUpdate,
    disableBotForChatById: bot.disableBotForChatById,
    runOutputGuardrail: bot.runOutputGuardrail,
    syncRecentChatsAndMessages: async () => ({ skipped: true }),
}));

server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 wa-service (API oficial) escuchando en ${PORT}`);
    await transport.init();
    await bot.init();
});

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e && e.message));
