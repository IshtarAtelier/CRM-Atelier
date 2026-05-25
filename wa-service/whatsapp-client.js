const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let waClient = null;
let qrCode = null;
let isReady = false;
let connectedPhone = null;
let _onMessage = null;
let _onMessageCreate = null;

let _onStatusChange = null;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

async function initWhatsApp({ onMessage, onMessageCreate, onStatusChange }) {
    _onMessage = onMessage;
    _onMessageCreate = onMessageCreate;
    _onStatusChange = onStatusChange;
    await startClient();
}

async function startClient(attempt = 1) {
    console.log(`📱 Iniciando WhatsApp client (intento ${attempt}/${MAX_RETRIES})...`);

    // Destroy previous client if exists
    if (waClient) {
        try { await waClient.destroy(); } catch (e) { /* ignore */ }
        waClient = null;
    }

    // Limpiar lock de Chromium para evitar "Code: 21" tras reinicios
    const fs = require('fs');
    const path = require('path');
    const lockPath = path.join(__dirname, '.wwebjs_auth', 'session', 'SingletonLock');
    try {
        fs.rmSync(lockPath, { force: true });
        console.log('🗑️ Intentado eliminar lock de Chromium (SingletonLock).');
    } catch (e) {
        // ignore
    }

    waClient = new Client({
        authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/AhmadHassan72/WW-cache/refs/heads/main/BootstrapQr.html',
            strict: false,
        },
        puppeteer: {
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-web-security',
                '--disable-site-isolation-trials',
                '--disable-features=IsolateOrigins,site-per-process',
                `--user-data-dir=${require('path').join(__dirname, '.wwebjs_auth', 'chromium-profile')}`,
            ],
        }
    });

    waClient.on('qr', (qr) => {
        qrCode = qr;
        isReady = false;
        qrcode.generate(qr, { small: true });
        console.log('📱 QR generado, esperando escaneo...');
        if (_onStatusChange) _onStatusChange(getStatus());
    });

    waClient.on('ready', () => {
        isReady = true;
        qrCode = null;
        connectedPhone = waClient.info?.wid?.user || 'desconocido';
        console.log(`\n✅ WhatsApp conectado: ${connectedPhone}`);
        if (_onStatusChange) _onStatusChange(getStatus());
    });

    waClient.on('disconnected', (reason) => {
        isReady = false;
        console.log('❌ WhatsApp desconectado:', reason);
        if (_onStatusChange) _onStatusChange(getStatus());
        // Auto-restart after disconnect
        setTimeout(() => startClient(1), RETRY_DELAY_MS);
    });

    if (_onMessage) {
        waClient.on('message', _onMessage);
    }

    if (_onMessageCreate) {
        waClient.on('message_create', _onMessageCreate);
    }

    try {
        await waClient.initialize();
    } catch (err) {
        console.error(`❌ Error inicializando WhatsApp (intento ${attempt}):`, err.message);
        if (attempt < MAX_RETRIES) {
            console.log(`⏳ Reintentando en ${RETRY_DELAY_MS / 1000}s...`);
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            return startClient(attempt + 1);
        } else {
            console.error('🛑 Se agotaron los reintentos. El servicio seguirá corriendo pero WhatsApp no está conectado.');
            console.error('   Reinicie el servicio manualmente si el problema persiste.');
        }
    }
}

function getStatus() {
    return { isReady, qrCode, connectedPhone };
}

async function sendMessage(waId, content, media = null) {
    if (!waClient || !isReady) throw new Error('WhatsApp not connected');

    if (media && media.base64) {
        const mediaObj = new MessageMedia(media.mimetype, media.base64, media.filename || 'image.jpg');
        const options = { caption: content || '' };
        if (media.mimetype.includes('audio/')) {
            options.sendAudioAsVoice = true;
        }
        return await waClient.sendMessage(waId, mediaObj, options);
    } else if (media && media.url) {
        try {
            const mediaObj = await MessageMedia.fromUrl(media.url, { unsafeMime: true });
            const options = { caption: content || '' };
            return await waClient.sendMessage(waId, mediaObj, options);
        } catch (e) {
            console.error('Error enviando media desde URL:', e.message);
            // Fallback: enviar solo texto si falla la descarga de la imagen
            return await waClient.sendMessage(waId, content);
        }
    } else {
        return await waClient.sendMessage(waId, content);
    }
}

async function sendTypingState(waId) {
    if (!waClient || !isReady) return;
    try {
        const chat = await waClient.getChatById(waId);
        await chat.sendStateTyping();
    } catch (e) {
        console.error('Error enviando estado typing:', e.message);
    }
}

function getClient() {
    return waClient;
}

module.exports = {
    initWhatsApp,
    getStatus,
    getClient,
    sendMessage,
    sendTypingState
};
