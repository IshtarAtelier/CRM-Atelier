const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let waClient = null;
let qrCode = null;
let isReady = false;
let connectedPhone = null;
let _onMessage = null;
let keepAliveFailCount = 0;
const MAX_KEEPALIVE_FAILS = 2; // Tolerar 2 fallos antes de reiniciar
let _onMessageCreate = null;

let _onStatusChange = null;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

function withTimeout(promise, ms) {
    let timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de respuesta')), ms)
    );
    return Promise.race([promise, timeout]);
}

function clearKeepAlive() {
    if (global.waKeepAliveInterval) {
        clearInterval(global.waKeepAliveInterval);
        global.waKeepAliveInterval = null;
    }
}

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
        clearKeepAlive();
        try { await waClient.destroy(); } catch (e) { /* ignore */ }
        waClient = null;
    }

    // Limpiar perfil de Chromium para evitar "Code: 21" tras reinicios/redeploys
    // El error Code 21 es un lock POSIX interno de Chromium que queda del container anterior.
    // La solución es eliminar el directorio chromium-profile completo (es solo cache del browser,
    // la sesión de WhatsApp se guarda en session/ por LocalAuth).
    const fs = require('fs');
    const path = require('path');
    
    // Determinar el directorio de sesión (Railway volume o local)
    const sessionDataPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
        ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'wwebjs_auth')
        : path.join(__dirname, '.wwebjs_auth');
    
    // Matar procesos Chromium zombi (aplica en Linux/Railway)
    try {
        require('child_process').execSync('pkill -9 -f chromium || pkill -9 -f chrome || true', { stdio: 'ignore', timeout: 3000 });
    } catch (e) { /* ignore */ }
    
    // Eliminar el directorio chromium-profile completo para que Chromium arranque limpio
    const chromiumProfilePath = path.join(sessionDataPath, 'chromium-profile');
    try {
        if (fs.existsSync(chromiumProfilePath)) {
            fs.rmSync(chromiumProfilePath, { recursive: true, force: true });
            console.log(`🗑️ Perfil de Chromium eliminado: ${chromiumProfilePath}`);
        }
    } catch (e) {
        console.error('⚠️ No se pudo eliminar perfil de Chromium:', e.message);
    }
    
    // También limpiar SingletonLock en session/ por si acaso
    const lockPaths = [
        path.join(sessionDataPath, 'session', 'SingletonLock'),
        path.join(__dirname, '.wwebjs_auth', 'session', 'SingletonLock'),
    ];
    for (const lp of lockPaths) {
        try { fs.rmSync(lp, { force: true }); } catch (e) { /* ignore */ }
    }
    
    console.log('🗑️ Limpieza de Chromium completada.');

    // Validar integridad del archivo de sesión antes de iniciar
    const sessionPath = path.join(__dirname, '.wwebjs_auth', 'session');
    try {
        if (fs.existsSync(sessionPath)) {
            const defaultFile = path.join(sessionPath, 'Default', 'Preferences');
            if (fs.existsSync(defaultFile)) {
                const content = fs.readFileSync(defaultFile, 'utf8');
                JSON.parse(content); // Validar que el JSON sea válido
            }
        }
    } catch (sessionErr) {
        console.error('⚠️ Sesión corrupta detectada. Eliminando archivos de sesión para regenerar...', sessionErr.message);
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log('🗑️ Archivos de sesión eliminados.');
        } catch (cleanErr) {
            console.error('Error eliminando sesión corrupta:', cleanErr.message);
        }
    }

    // Usar el sessionDataPath ya determinado arriba (Railway volume o local)
    console.log(`📂 Usando directorio de sesión: ${sessionDataPath}`);

    waClient = new Client({
        authStrategy: new LocalAuth({ dataPath: sessionDataPath }),
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
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                `--user-data-dir=${require('path').join(sessionDataPath, 'chromium-profile')}`,
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
        keepAliveFailCount = 0; // Resetear contador de fallos
        connectedPhone = waClient.info?.wid?.user || 'desconocido';
        console.log(`\n✅ WhatsApp conectado: ${connectedPhone}`);
        if (_onStatusChange) _onStatusChange(getStatus());

        // Configurar Keep-Alive para verificar salud de Chromium periódicamente
        if (global.waKeepAliveInterval) {
            clearInterval(global.waKeepAliveInterval);
        }
        global.waKeepAliveInterval = setInterval(async () => {
            if (waClient && isReady) {
                try {
                    const state = await withTimeout(waClient.getState(), 20000);
                    if (state === 'CONNECTED') {
                        keepAliveFailCount = 0; // Resetear si conectado
                        // Log silencioso, solo cada 3 chequeos para no saturar
                        if (Math.random() < 0.33) console.log(`[WA Keep-Alive] ✅ Conexión estable`);
                    } else {
                        keepAliveFailCount++;
                        console.warn(`[WA Keep-Alive] Estado: ${state} (fallo #${keepAliveFailCount}/${MAX_KEEPALIVE_FAILS})`);
                        if (keepAliveFailCount >= MAX_KEEPALIVE_FAILS) {
                            console.error('[WA Keep-Alive] Demasiados fallos consecutivos. Reiniciando cliente...');
                            keepAliveFailCount = 0;
                            isReady = false;
                            startClient(1);
                        }
                    }
                } catch (err) {
                    keepAliveFailCount++;
                    console.error(`[WA Keep-Alive] Error en chequeo (fallo #${keepAliveFailCount}/${MAX_KEEPALIVE_FAILS}):`, err.message);
                    if (keepAliveFailCount >= MAX_KEEPALIVE_FAILS) {
                        console.error('[WA Keep-Alive] Demasiados fallos consecutivos. Reiniciando cliente...');
                        keepAliveFailCount = 0;
                        isReady = false;
                        startClient(1);
                    }
                }
            }
        }, 3 * 60 * 1000); // Chequear cada 3 minutos
    });

    waClient.on('disconnected', (reason) => {
        isReady = false;
        clearKeepAlive();
        console.log('❌ WhatsApp desconectado:', reason);
        if (_onStatusChange) _onStatusChange(getStatus());
        // Auto-restart after disconnect con delay más largo para no saturar
        setTimeout(() => startClient(1).catch(err => console.error('Error auto-reconnecting after disconnect:', err)), RETRY_DELAY_MS * 2);
    });

    // Detectar cambios de estado intermedios (OPENING, PAIRING, UNPAIRED, etc.)
    waClient.on('change_state', (state) => {
        console.log(`📱 [WA State Change] ${state}`);
        if (state === 'CONFLICT' || state === 'UNLAUNCHED') {
            console.warn(`⚠️ Estado conflictivo detectado: ${state}. Esperando resolución...`);
        }
    });

    // ── Recuperación automática ante fallo de autenticación ──
    waClient.on('auth_failure', (msg) => {
        console.error('❌ Fallo de autenticación de WhatsApp:', msg);
        isReady = false;
        clearKeepAlive();
        // Eliminar datos de sesión corruptos para forzar re-escaneo de QR
        const fs = require('fs');
        const path = require('path');
        const sessionPath = path.join(__dirname, '.wwebjs_auth', 'session');
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log('🗑️ Sesión eliminada tras auth_failure. Se requerirá nuevo escaneo de QR.');
        } catch (e) {
            console.error('Error eliminando sesión tras auth_failure:', e.message);
        }
        if (_onStatusChange) _onStatusChange(getStatus());
        setTimeout(() => startClient(1).catch(err => console.error('Error auto-reconnecting after auth_failure:', err)), RETRY_DELAY_MS);
    });

    // Limpiar listeners previos para evitar duplicados en reconexiones
    waClient.removeAllListeners('message');
    waClient.removeAllListeners('message_create');

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
        return await withTimeout(waClient.sendMessage(waId, mediaObj, options), 30000);
    } else if (media && media.url) {
        try {
            const mediaObj = await withTimeout(MessageMedia.fromUrl(media.url, { unsafeMime: true }), 15000);
            const options = { caption: content || '' };
            return await withTimeout(waClient.sendMessage(waId, mediaObj, options), 30000);
        } catch (e) {
            console.error('Error enviando media desde URL:', e.message);
            // Fallback: enviar solo texto si falla la descarga de la imagen
            return await withTimeout(waClient.sendMessage(waId, content), 30000);
        }
    } else {
        return await withTimeout(waClient.sendMessage(waId, content), 30000);
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
