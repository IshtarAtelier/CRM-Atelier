const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const antiBanQueue = require('./anti-ban');

let waClient = null;
let qrCode = null;
let isReady = false;
// Último estado reportado por WhatsApp Web (CONNECTED, OPENING, PAIRING...).
// `isReady` sigue significando "el cliente arrancó" (lo usa el keep-alive para
// saber si tiene que vigilar); este estado dice si REALMENTE se puede enviar.
let connectionState = null;
let connectedPhone = null;
let _onMessage = null;
let keepAliveFailCount = 0;
const MAX_KEEPALIVE_FAILS = 2; // Tolerar 2 fallos antes de reiniciar
let _onMessageCreate = null;
let _onUnreadCount = null;

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

// Avisa al admin por EMAIL (no por WhatsApp: si esto se dispara, WhatsApp está caído y no
// puede avisar de sí mismo). Pega al endpoint /api/admin/alert del CRM, que ya manda mail.
// Best-effort: nunca tira, solo loguea si falla.
async function notifyAdminDown(subject, message) {
    try {
        const base = (process.env.CRM_API_URL || '').replace('/api/bot', '');
        if (!base) { console.error('⚠️ No se pudo alertar: CRM_API_URL no configurada.'); return; }
        const axios = require('axios');
        await axios.post(`${base}/api/admin/alert`, { subject, message }, {
            headers: { 'x-api-key': process.env.BOT_API_KEY || '' },
            timeout: 15000,
        });
        console.log('📧 Alerta de caída enviada al admin por email.');
    } catch (e) {
        console.error('⚠️ No se pudo enviar la alerta de caída al admin:', e.message);
    }
}

async function initWhatsApp({ onMessage, onMessageCreate, onStatusChange, onUnreadCount }) {
    _onMessage = onMessage;
    _onMessageCreate = onMessageCreate;
    _onStatusChange = onStatusChange;
    _onUnreadCount = onUnreadCount;
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
    
    // Limpiar SOLO los archivos SingletonLock
    // OJO: fs.existsSync devuelve false para symlinks rotos (que es lo que es SingletonLock 
    // tras un reinicio del container). Por eso ejecutamos rmSync directamente con force: true.
    const lockPaths = [
        path.join(sessionDataPath, 'session', 'SingletonLock'),
        path.join(sessionDataPath, 'session', 'SingletonCookie'),
        path.join(sessionDataPath, 'session', 'SingletonSocket'),
        path.join(__dirname, '.wwebjs_auth', 'session', 'SingletonLock'),
        path.join(__dirname, '.wwebjs_auth', 'session', 'SingletonCookie'),
        path.join(__dirname, '.wwebjs_auth', 'session', 'SingletonSocket'),
    ];
    for (const lp of lockPaths) {
        try { 
            fs.rmSync(lp, { force: true }); 
            console.log(`🗑️ Limpieza de lock forzada en: ${lp}`);
        } catch (e) { 
            console.error(`⚠️ Error al borrar lock en ${lp}:`, e.message);
        }
    }

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
        // Versión de WhatsApp Web que se le sirve al navegador.
        //
        // En julio de 2026 WhatsApp renombró internamente `_serialized` a `$1` (a partir
        // de la build 2.3000.1042401057). Eso rompió la capa que whatsapp-web.js inyecta:
        // desde el 14/7 WhatsApp seguía conectado pero `getChats()` tiraba error, los
        // mensajes llegaban sin id, las fotos y audios no se bajaban y NINGÚN saliente se
        // guardaba en el buzón. El arreglo de la librería (PR wwebjs#201832) todavía no
        // está publicado: 1.34.7 es la última versión en npm y no lo trae.
        //
        // Por eso se fija la última build ANTERIOR al renombre, tomada del cache de
        // wppconnect (mantenido a diario). `strict: false` deja seguir con la versión
        // viva si la descarga falla.
        //
        // Cuando salga la versión de whatsapp-web.js con el PR: actualizar la librería y
        // soltar este pin. Mientras tanto, si WhatsApp deja de servir esta build, probar
        // otra de https://github.com/wppconnect-team/wa-version/tree/main/html vía la
        // env WA_WEB_VERSION, sin tocar código.
        webVersionCache: {
            type: 'remote',
            remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${process.env.WA_WEB_VERSION || '2.3000.1042391138-alpha'}.html`,
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
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
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
        connectionState = 'CONNECTED';
        qrCode = null;
        keepAliveFailCount = 0; // Resetear contador de fallos
        connectedPhone = waClient.info?.wid?.user || 'desconocido';
        console.log(`\n✅ WhatsApp conectado: ${connectedPhone}`);
        
        // Registrar cliente en la cola anti-ban
        antiBanQueue.setClient(waClient);

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
        connectionState = 'DISCONNECTED';
        clearKeepAlive();
        console.log('❌ WhatsApp desconectado:', reason);
        if (_onStatusChange) _onStatusChange(getStatus());
        // Auto-restart after disconnect con delay más largo para no saturar
        setTimeout(() => startClient(1).catch(err => console.error('Error auto-reconnecting after disconnect:', err)), RETRY_DELAY_MS * 2);
    });

    // Detectar cambios de estado intermedios (OPENING, PAIRING, UNPAIRED, etc.)
    // Mientras el estado no sea CONNECTED, la sesión NO puede enviar: sendMessage
    // se queda colgado hasta el timeout duro (90s con media). Registramos el estado
    // para cortar los envíos al instante en vez de trabar la cola 90s por mensaje.
    waClient.on('change_state', (state) => {
        connectionState = state;
        console.log(`📱 [WA State Change] ${state}`);
        if (state === 'CONFLICT' || state === 'UNLAUNCHED') {
            console.warn(`⚠️ Estado conflictivo detectado: ${state}. Esperando resolución...`);
        }
    });

    // ── Recuperación automática ante fallo de autenticación ──
    waClient.on('auth_failure', (msg) => {
        console.error('❌ Fallo de autenticación de WhatsApp:', msg);
        isReady = false;
        connectionState = 'UNPAIRED';
        clearKeepAlive();
        // Eliminar datos de sesión corruptos para forzar re-escaneo de QR
        const authSessionPath = path.join(sessionDataPath, 'session');
        try {
            fs.rmSync(authSessionPath, { recursive: true, force: true });
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

    // Listener para marcar como leídos desde el celular
    waClient.removeAllListeners('unread_count');
    if (_onUnreadCount) {
        waClient.on('unread_count', _onUnreadCount);
    }

    try {
        console.log('⏳ Llamando a waClient.initialize()...');
        await withTimeout(waClient.initialize(), 60000); // 60 segundos máximo
    } catch (err) {
        console.error(`❌ Error inicializando WhatsApp (intento ${attempt}):`, err.message);
        
        // Si es Code 21 (perfil bloqueado), eliminar la sesión completa para destrabarlo
        if (err.message.includes('Code: 21') || err.message.includes('process_singleton')) {
            console.log('🔧 Detectado lock de perfil Chromium (Code 21). Eliminando sesión corrupta...');
            const corruptedSessionPath = path.join(sessionDataPath, 'session');
            try {
                fs.rmSync(corruptedSessionPath, { recursive: true, force: true });
                console.log(`🗑️ Sesión corrupta eliminada: ${corruptedSessionPath}`);
            } catch (e) {
                console.error('⚠️ No se pudo eliminar sesión corrupta:', e.message);
            }
        }
        
        if (attempt < MAX_RETRIES) {
            console.log(`⏳ Reintentando en ${RETRY_DELAY_MS / 1000}s...`);
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            return startClient(attempt + 1);
        } else {
            console.error('🛑 Se agotaron los reintentos. El servicio seguirá corriendo pero WhatsApp no está conectado.');
            console.error('   Reinicie el servicio manualmente si el problema persiste.');
            notifyAdminDown(
                '🚨 WhatsApp caído: el bot no logró conectar',
                `El bot de WhatsApp intentó iniciar ${MAX_RETRIES} veces y no lo logró. El servicio sigue vivo pero WhatsApp está DESCONECTADO — los clientes no reciben respuestas.\n\nÚltimo error: ${err.message}\n\nQué hacer: revisá el panel /admin/whatsapp. Si sigue caído, reiniciá el servicio "Pagina Web" en Railway. Si al reiniciar aparece un QR, hay que re-escanearlo desde el celular.`
            );
        }
    }
}

// ¿La sesión puede enviar AHORA? No alcanza con que el cliente haya arrancado:
// si WhatsApp Web está reconectando (OPENING/PAIRING), sendMessage se cuelga.
function canSend() {
    return !!waClient && isReady && (connectionState === null || connectionState === 'CONNECTED');
}

// Espera corta para absorber parpadeos de conexión de pocos segundos, en vez de
// rechazar de entrada un envío que se iba a poder hacer igual.
async function waitUntilSendable(maxWaitMs = 10000) {
    const deadline = Date.now() + maxWaitMs;
    while (!canSend() && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1000));
    }
    return canSend();
}

function getStatus() {
    return { isReady: canSend(), qrCode, connectedPhone, state: connectionState };
}

async function sendMessage(waId, content, media = null, options = {}) {
    if (!canSend() && !(await waitUntilSendable())) {
        // Mensaje explícito: el caller (CRM o bot) necesita poder decirle al
        // vendedor que NO se envió nada, sin la duda de "¿le habrá llegado?".
        throw new Error(
            connectionState && connectionState !== 'CONNECTED'
                ? `WhatsApp reconectando (${connectionState}): no se envió nada`
                : 'WhatsApp not connected'
        );
    }

    // Identificar si es un mensaje proactivo/seguimiento automático
    const isProactive = options.isProactive !== undefined ? options.isProactive : (
        content && (
            content.includes("Te escribo para saber si te quedó alguna duda") || // Inactividad
            content.includes("Hola") && content.includes("seguimiento") || // Sales followups
            content.includes("presupuesto") ||
            global.botReplyingTo && global.botReplyingTo.has(waId)
        )
    );

    const mergedOptions = {
        isAutomated: options.isAutomated !== undefined ? options.isAutomated : true,
        isProactive: !!isProactive,
        ...options
    };

    return await antiBanQueue.enqueue(waId, content, media, mergedOptions);
}

async function sendTypingState(waId) {
    if (!canSend()) return;
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
    sendTypingState,
    notifyAdminDown
};
