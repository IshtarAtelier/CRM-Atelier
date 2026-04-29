const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let waClient = null;
let qrCode = null;
let isReady = false;
let connectedPhone = null;

function initWhatsApp({ onMessage, onMessageCreate }) {
    waClient = new Client({
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
    
    if (onMessage) {
        waClient.on('message', onMessage);
    }
    
    if (onMessageCreate) {
        waClient.on('message_create', onMessageCreate);
    }

    waClient.initialize();
}

function getStatus() {
    return { isReady, qrCode, connectedPhone };
}

async function sendMessage(waId, content, media = null) {
    if (!waClient || !isReady) throw new Error('WhatsApp not connected');
    
    if (media && media.base64) {
        const mediaObj = new MessageMedia(media.mimetype, media.base64, media.filename || 'image.jpg');
        return await waClient.sendMessage(waId, mediaObj, { caption: content || '' });
    } else {
        return await waClient.sendMessage(waId, content);
    }
}

module.exports = {
    initWhatsApp,
    getStatus,
    sendMessage
};
