const { prisma } = require('../db');
const { getAdminWaId, isValidRecipient, isLidFormat } = require('../utils');

/**
 * Envuelve una promesa con un timeout duro. Si la promesa no resuelve/rechaza
 * dentro de `ms`, rechaza con un error. Evita que un envío colgado de
 * whatsapp-web.js bloquee la cola (y por ende la UI del CRM) de forma indefinida.
 */
function withTimeout(promise, ms, label = 'operación') {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout de ${ms}ms en ${label}`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * ¿El envío falló porque el destinatario no existe / está mal escrito?
 * Estos fallos no dicen nada del estado de la sesión de WhatsApp, así que no
 * deben empujar el circuit breaker: reintentar no los arregla nunca.
 */
function esDestinoInvalido(error) {
    if (error?.code === 'INVALID_NUMBER') return true;
    const msg = String(error?.message || '').toLowerCase();
    return msg.includes('no lid for user')
        || msg.includes('no está registrado en whatsapp')
        || msg.includes('número inválido')
        || msg.includes('numero invalido')
        || msg.includes('invalid wid')
        || msg.includes('not a valid user')
        || msg.includes('phone not registered')
        || msg.includes('chat not found');
}

class AntiBanQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.client = null;
        
        // Límites duros según políticas de seguridad (operando al ~60-70%)
        this.dailyProactiveLimit = 120; // Límite diario de seguimientos (máx 150-200)
        
        this.consecutiveFailures = 0;
        this.isPaused = false;
        
        // Control de lotes y timing por hora
        this.sentMessagesInBatch = 0;
        this.sentTimestamps = [];

        // Espaciado anti-ban: en vez de bloquear la cola durante la pausa entre
        // envíos, guardamos hasta cuándo hay que esperar. Ese cooldown SOLO frena
        // a los próximos envíos automáticos; los manuales lo saltan.
        this.cooldownUntil = 0;
    }

    /**
     * Inicializa el cliente de WhatsApp para la cola.
     * Evita dependencias circulares.
     */
    setClient(waClient) {
        this.client = waClient;
    }

    /**
     * Encola un mensaje para ser enviado respetando las reglas anti-ban.
     * @param {string} waId - ID de WhatsApp del destinatario.
     * @param {string} content - Contenido del mensaje.
     * @param {Object} media - Objeto de media opcional (url o base64).
     * @param {Object} options - Parámetros de control anti-ban.
     * @param {boolean} options.isAutomated - Indica si el mensaje es automático.
     * @param {boolean} options.isProactive - Indica si es un mensaje de seguimiento proactivo/unsolicited.
     */
    async enqueue(waId, content, media = null, options = {}) {
        return new Promise((resolve, reject) => {
            // Validar contenido contra políticas de Spam antes de encolar.
            // SOLO para mensajes proactivos (nosotros escribimos primero): una
            // respuesta a un cliente que acaba de escribir no es spam, y el bot
            // dice "envío gratis" / "2x1" legítimamente — esto la bloqueaba.
            try {
                if (options.isAutomated !== false && options.isProactive !== false) {
                    this.validateContent(content);
                }
            } catch (err) {
                console.error(`[AntiBanQueue] Rechazo de validación de spam al encolar: ${err.message}`);
                reject(err);
                return;
            }

            const task = { waId, content, media, options, resolve, reject };
            // Los envíos manuales (acción humana desde el CRM) tienen prioridad:
            // van al frente para no quedar atrapados detrás de la automatización
            // (pausas de lote, límite horario, etc.).
            if (options.isAutomated === false) {
                this.queue.unshift(task);
            } else if (options.isProactive === false) {
                // Respuesta reactiva del bot: entra ANTES del primer proactivo
                // para no quedar atrapada detrás de seguimientos frenados por
                // horario/límites (head-of-line blocking). Mantiene orden FIFO
                // entre reactivas y respeta la prioridad de los manuales.
                const firstProactive = this.queue.findIndex(t => t.options?.isProactive !== false);
                if (firstProactive === -1) {
                    this.queue.push(task);
                } else {
                    this.queue.splice(firstProactive, 0, task);
                }
            } else {
                this.queue.push(task);
            }
            console.log(`[AntiBanQueue] Mensaje encolado para ${waId} (${options.isAutomated === false ? 'MANUAL/prioritario' : 'automático'}). Tamaño de cola: ${this.queue.length}`);
            this.processQueue();
        });
    }

    /**
     * Valida el contenido del mensaje contra palabras de spam y acortadores prohibidos.
     */
    validateContent(content) {
        if (!content) return;

        // A. Filtro de palabras spam prohibidas
        const spamWords = [
            /gratis/i, 
            /oferta exclusiva/i, 
            /urgente/i, 
            /hac[eé] clic/i, 
            /respond[eé] ya/i
        ];
        
        for (const pattern of spamWords) {
            if (pattern.test(content)) {
                throw new Error(`Contenido bloqueado por política anti-spam (Coincidencia con patrón prohibido: "${pattern.source}")`);
            }
        }

        // B. Filtro de acortadores de enlaces prohibidos
        const shortenerPattern = /(bit\.ly|tinyurl\.com|t\.co|is\.gd|tiny\.cc|buff\.ly|adf\.ly)/i;
        if (shortenerPattern.test(content)) {
            throw new Error("Contenido bloqueado por política anti-spam (Coincidencia con acortador de enlaces prohibido)");
        }
    }

    /**
     * Procesa expresiones Spintax para evitar el envío de textos idénticos.
     * Ejemplo: "{Hola|Buenos días|Qué tal}"
     */
    parseSpintax(text) {
        if (!text) return text;
        const spintaxPattern = /\{([^{}]+)\}/g;
        let match;
        while ((match = spintaxPattern.exec(text)) !== null) {
            const options = match[1].split('|');
            const choice = options[Math.floor(Math.random() * options.length)];
            text = text.replace(match[0], choice);
            spintaxPattern.lastIndex = 0; // Resetear índice de búsqueda tras modificación
        }
        return text;
    }

    /**
     * Limpia timestamps de envíos de la última hora.
     */
    cleanHourlyTimestamps() {
        const now = Date.now();
        this.sentTimestamps = this.sentTimestamps.filter(ts => now - ts < 3600000);
    }

    /**
     * Devuelve cuántos ms hay que esperar por el límite de mensajes por hora (máx 30).
     * 0 = puede enviar ya. NO bloquea: solo calcula (así no retiene el lock de la cola).
     * Los envíos manuales de un humano no se frenan por este límite.
     */
    hourlyLimitWaitMs(options = {}) {
        if (options.isAutomated === false) return 0;
        // Respuesta reactiva: el cliente acaba de escribir y está esperando.
        // Responder no es patrón de spam — el freno es solo para proactivos.
        if (options.isProactive === false) return 0;
        this.cleanHourlyTimestamps();
        if (this.sentTimestamps.length >= 30) {
            const oldest = this.sentTimestamps[0];
            return 3600000 - (Date.now() - oldest) + 5000; // Margen de seguridad de 5s
        }
        return 0;
    }

    /**
     * Devuelve cuántos ms hay que esperar hasta las 09:00 AR si estamos fuera del
     * horario permitido (09:00 - 20:00). 0 = puede enviar ya. NO bloquea.
     * Los envíos manuales (vendedores reales) pueden salir a cualquier hora.
     */
    allowedHoursWaitMs(options = {}) {
        if (options.isAutomated === false) return 0;
        // Respuesta reactiva: si el cliente escribe a las 21:00, responderle a
        // las 21:00 es lo esperado (el prompt promete atención 24/7). Retenerla
        // hasta las 09:00 dejaba al cliente viendo "escribiendo..." sin mensaje,
        // y un redeploy borraba la cola en memoria → el mensaje se perdía.
        if (options.isProactive === false) return 0;

        const nowARStr = new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" });
        const nowAR = new Date(nowARStr);
        const hour = nowAR.getHours();

        if (hour < 9 || hour >= 20) {
            const targetAR = new Date(nowARStr);
            if (hour >= 20) {
                targetAR.setDate(targetAR.getDate() + 1);
            }
            targetAR.setHours(9, 0, 0, 0);
            return targetAR.getTime() - nowAR.getTime();
        }
        return 0;
    }

    /**
     * Loop de procesamiento de la cola.
     */
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        // Si la cola está pausada (circuit breaker), solo frenamos la automatización.
        // Un envío manual iniciado por un humano debe poder salir igual.
        const headIsManual = this.queue[0]?.options?.isAutomated === false;
        if (this.isPaused && !headIsManual) {
            return;
        }

        // Los siguientes frenos anti-ban (cooldown de espaciado, límite horario y
        // horario comercial) se evalúan ANTES de tomar el lock y SIN bloquearlo:
        // si toca esperar, reprogramamos y salimos. Así una espera larga de la
        // automatización nunca deja el lock tomado bloqueando un envío manual.
        // Todos estos frenos solo aplican a envíos automáticos; los manuales pasan.
        if (!headIsManual) {
            const cooldownWait = this.cooldownUntil && Date.now() < this.cooldownUntil
                ? this.cooldownUntil - Date.now() : 0;
            const hourlyWait = this.hourlyLimitWaitMs(this.queue[0].options);
            const hoursWait = this.allowedHoursWaitMs(this.queue[0].options);
            const wait = Math.max(cooldownWait, hourlyWait, hoursWait);
            if (wait > 0) {
                console.log(`[AntiBanQueue] Freno anti-ban para automático: reintento en ${(Math.min(wait, 300000) / 1000).toFixed(0)}s (espera total ${(wait / 1000).toFixed(0)}s).`);
                // Reevaluamos al menos cada 5 min (un envío manual entrante dispara
                // processQueue de inmediato por su cuenta, sin esperar esto).
                setTimeout(() => this.processQueue(), Math.min(wait + 50, 300000));
                return;
            }
        }

        this.isProcessing = true;
        const task = this.queue.shift();

        try {
            await this.executeTask(task);
            this.consecutiveFailures = 0; // Resetear fallos tras éxito
        } catch (error) {
            console.error(`[AntiBanQueue] Error enviando mensaje a ${task.waId}:`, error.message);

            // El circuit breaker existe para detectar que la SESIÓN de WhatsApp
            // está caída. Un destino que no existe no dice nada de la sesión:
            // reintentarlo nunca va a funcionar y no es señal de riesgo de ban.
            // Contarlo era caro: un teléfono mal cargado en una etiqueta (sin el
            // 549) reventó 5 veces seguidas y pausó la cola ENTERA una hora,
            // dejando sin respuesta a todos los clientes por una notificación
            // interna.
            if (esDestinoInvalido(error)) {
                console.warn(`[AntiBanQueue] Destino inválido (${task.waId}): no cuenta para el circuit breaker.`);
                task.reject(error); // sin esto, quien encoló el envío queda esperando para siempre
                return;             // el `finally` corre igual y libera la cola
            }

            this.consecutiveFailures++;

            // Circuit Breaker: si 5 mensajes fallan consecuentemente, pausar por 1 hora
            if (this.consecutiveFailures >= 5) {
                console.error(`[AntiBanQueue] 🚨 CIRCUIT BREAKER ACTIVADO (${this.consecutiveFailures} fallos consecutivos). Pausando cola por 1 HORA.`);
                this.isPaused = true;

                try {
                    const adminWaId = getAdminWaId();
                    if (this.client) {
                        await this.client.sendMessage(
                            adminWaId,
                            `🚨 *CIRCUIT BREAKER ACTIVADO* 🚨\n\nSe han detectado ${this.consecutiveFailures} fallos de envío consecutivos en WhatsApp. La cola ha sido PAUSADA durante 1 hora de forma preventiva.`
                        );
                    }
                } catch (adminErr) {
                    console.error('[AntiBanQueue] Error notificando circuit breaker al admin:', adminErr.message);
                }

                // Programar reactivación automática en 1 hora
                setTimeout(() => {
                    console.log('[AntiBanQueue] Intentando reanudar cola tras pausa de 1 hora del circuit breaker...');
                    this.resumeQueue();
                }, 3600000);

            } else if (this.consecutiveFailures >= 3) {
                // Alerta temprana a los 3 fallos consecutivos
                console.warn(`[AntiBanQueue] ⚠️ Tasa de fallos consecutivos elevada (${this.consecutiveFailures}). Emitiendo advertencia.`);
                try {
                    const adminWaId = getAdminWaId();
                    if (this.client) {
                        await this.client.sendMessage(
                            adminWaId,
                            `⚠️ *ADVERTENCIA ANTIBAN* ⚠️\nSe detectaron ${this.consecutiveFailures} fallos consecutivos en los envíos de WhatsApp. Por favor, verificar estado.`
                        );
                    }
                } catch (e) { /* ignore */ }
            }

            task.reject(error);
        } finally {
            this.isProcessing = false;
            // Ciclo siguiente casi inmediato; el espaciado real lo aplica el cooldown
            // (que solo frena a los automáticos), no este delay.
            setTimeout(() => this.processQueue(), 200);
        }
    }

    /**
     * ¿Este número ya nos escribió alguna vez? Prueba de que el número existe y
     * tiene WhatsApp, independiente de lo que conteste `getNumberId` hoy.
     * Ante error de DB devuelve false (no inventamos evidencia).
     */
    async tieneHistorialEntrante(waId) {
        try {
            const telefono = String(waId).split('@')[0];
            const entrantes = await prisma.whatsAppMessage.count({
                where: {
                    direction: 'INBOUND',
                    chat: {
                        OR: [{ waId }, { realPhone: telefono }]
                    }
                }
            });
            return entrantes > 0;
        } catch (e) {
            console.error('[AntiBanQueue] Error verificando historial entrante:', e.message);
            return false;
        }
    }

    /**
     * Ejecuta una tarea individual de la cola.
     */
    async executeTask(task) {
        const { waId, content, media, options, resolve, reject } = task;

        if (!this.client) {
            throw new Error('El cliente de WhatsApp no está inicializado en AntiBanQueue');
        }

        // 1. Validar formato del destinatario usando helper centralizado
        let targetWaId = waId;

        const recipientCheck = isValidRecipient(targetWaId);
        if (!recipientCheck.valid) {
            reject(new Error(`Número inválido: ${recipientCheck.reason}`));
            return;
        }

        // Resolver @c.us → @lid vía WhatsApp Web (los LIDs ya están resueltos)
        if (!isLidFormat(targetWaId) && targetWaId.includes('@c.us')) {
            let numberWaId = null;
            try {
                numberWaId = serializedId(await this.client.getNumberId(targetWaId));
            } catch (e) {
                console.warn(`[AntiBanQueue] No se pudo validar el ID de número para ${targetWaId}: ${e.message}`);
            }

            if (numberWaId) {
                targetWaId = numberWaId;
            } else if (await this.tieneHistorialEntrante(targetWaId)) {
                // getNumberId devuelve null también cuando la sesión está tibia o
                // WhatsApp no contesta la consulta de LID — no solo cuando el
                // número no existe. Si ya recibimos mensajes DE este número, es
                // real: seguimos con el @c.us original en vez de acusar de falsa
                // una ficha correcta y dejar al cliente sin su recibo.
                console.warn(`[AntiBanQueue] getNumberId no resolvió ${targetWaId}, pero hay entrantes de ese número: se envía igual.`);
            } else {
                reject(Object.assign(
                    new Error('El número no está registrado en WhatsApp o es inválido'),
                    { code: 'INVALID_NUMBER' }
                ));
                return;
            }
        }

        // 2. Analizar historial del chat en la DB para auditoría anti-ban
        let isColdContact = false;
        let isOutOfWindow = false;
        let chatDb = null; // Hoisted para que sea accesible en Rule D

        try {
            chatDb = await prisma.whatsAppChat.findUnique({
                where: { waId: targetWaId },
                include: {
                    messages: {
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });

            if (chatDb) {
                // Verificar si está archivado (No reactivar leads archivados de forma automática)
                if (chatDb.archived && options.isAutomated !== false) {
                    reject(new Error('Política Anti-Spam: Prohibido reactivar o enviar mensajes automáticos a chats ARCHIVADOS'));
                    return;
                }

                const inboundMessages = chatDb.messages.filter(m => m.direction === 'INBOUND');
                if (inboundMessages.length === 0) {
                    isColdContact = true;
                }

                if (inboundMessages.length > 0) {
                    const lastInbound = inboundMessages[0];
                    const hoursSinceLastInbound = (Date.now() - new Date(lastInbound.createdAt).getTime()) / (1000 * 60 * 60);
                    if (hoursSinceLastInbound > 24) {
                        isOutOfWindow = true;
                    }
                } else {
                    isOutOfWindow = true;
                }
            } else {
                isColdContact = true;
                isOutOfWindow = true;
            }
        } catch (dbErr) {
            console.error('[AntiBanQueue] Error consultando DB en anti-ban:', dbErr.message);
        }

        // A. Escudo contra contactos fríos (Cold Contact Shield)
        if (options.isProactive && isColdContact) {
            console.warn(`[AntiBanQueue] 🛡️ Cold Contact Shield activado para ${targetWaId}. Cancelando seguimiento automático.`);
            reject(new Error('Cold Contact Shield: El destinatario no tiene historial de mensajes entrantes (contacto frío)'));
            return;
        }

        // B. Regla: Nunca enviar imágenes o archivos en primer contacto en frío de forma AUTOMÁTICA
        if (options.isAutomated !== false && isColdContact && media) {
            reject(new Error('Política Anti-Spam: Prohibido enviar imágenes o archivos automáticos en el primer contacto en frío'));
            return;
        }

        // C. Límite diario de SEGUIMIENTOS proactivos (120 máximo al día).
        // Solo frena proactivos: contaba y frenaba también las respuestas del
        // bot, que en días movidos agotaban el cupo a media tarde y dejaban
        // al bot mudo el resto del día.
        if (options.isAutomated !== false && options.isProactive === true) {
            try {
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const automatedSentToday = await prisma.whatsAppMessage.count({
                    where: {
                        direction: 'OUTBOUND',
                        senderName: 'Bot',
                        createdAt: { gte: todayStart }
                    }
                });

                if (automatedSentToday >= this.dailyProactiveLimit) {
                    console.warn(`[AntiBanQueue] 🚨 Límite diario de mensajes alcanzado (${automatedSentToday}/${this.dailyProactiveLimit}). Cancelando.`);
                    reject(new Error(`Límite diario de mensajes alcanzado (${this.dailyProactiveLimit})`));
                    return;
                }
            } catch (limitErr) {
                console.error('[AntiBanQueue] Error verificando límite diario proactivo:', limitErr.message);
            }
        }

        // D. Regla de 3er Intento: si se hicieron 3 INTENTOS DE CONTACTO sin respuesta del usuario, pausar por 30 días.
        // Solo aplica a envíos PROACTIVOS (seguimientos): responder a un cliente que escribió nunca es spam.
        // Un "intento" es una ráfaga de mensajes: las burbujas de una misma respuesta (separadas por
        // menos de 10 minutos entre sí) cuentan como UN solo intento, no como varios.
        if (options.isAutomated !== false && options.isProactive === true) {
            try {
                const lastMessages = chatDb ? chatDb.messages : [];
                const BURST_GAP_MS = 10 * 60 * 1000;
                let contactAttempts = 0;
                let lastOutboundTime = null;
                let prevOutboundMs = null;

                for (const msg of lastMessages) {
                    if (msg.direction === 'INBOUND') {
                        break; // Se detiene al encontrar respuesta del usuario
                    }
                    if (msg.direction === 'OUTBOUND') {
                        const msgMs = new Date(msg.createdAt).getTime();
                        if (!lastOutboundTime) {
                            lastOutboundTime = new Date(msg.createdAt);
                        }
                        // Mensajes en orden descendente: gap = mensaje más nuevo - mensaje más viejo
                        if (prevOutboundMs === null || (prevOutboundMs - msgMs) > BURST_GAP_MS) {
                            contactAttempts++;
                        }
                        prevOutboundMs = msgMs;
                    }
                }

                if (contactAttempts >= 3 && lastOutboundTime) {
                    const daysSinceLastOutbound = (Date.now() - lastOutboundTime.getTime()) / (1000 * 60 * 60 * 24);
                    if (daysSinceLastOutbound < 30) {
                        const daysLeft = (30 - daysSinceLastOutbound).toFixed(1);
                        console.warn(`[AntiBanQueue] 🛡️ Regla de 3er Intento activada para ${targetWaId}. ${contactAttempts} intentos de contacto sin respuesta. Bloqueando seguimientos por 30 días (${daysLeft} días restantes).`);
                        reject(new Error(`Pausa de 30 días activa: El destinatario no respondió a los últimos ${contactAttempts} intentos de contacto (${daysLeft} días restantes)`));
                        return;
                    }
                }
            } catch (consecErr) {
                console.error('[AntiBanQueue] Error verificando regla de 3er intento sin respuesta:', consecErr.message);
            }
        }

        // E. Preflight del que encoló: revalidación EN EL MOMENTO del envío
        // físico. Un mensaje puede esperar en esta cola desde minutos (pausas de
        // lote, límite horario) hasta 13 horas (retención nocturna), y en ese
        // lapso el cliente pudo escribir, pedir que no lo contacten, o la tarea
        // pudo cancelarse — nada de eso se veía acá. Si el preflight dice que
        // ya no corresponde, se descarta SIN contar como fallo (resolve, no
        // reject: un descarte correcto no debe alimentar el circuit breaker).
        // Corre ANTES de simular tipeo: que el cliente no vea "escribiendo..."
        // y después nada.
        if (typeof options.preflight === 'function') {
            try {
                const pf = await options.preflight();
                if (!pf || pf.ok !== true) {
                    const reason = (pf && pf.reason) || 'preflight rechazó el envío';
                    console.log(`[AntiBanQueue] 🚦 Preflight canceló el envío a ${targetWaId}: ${reason}`);
                    resolve({ skipped: true, reason });
                    return;
                }
            } catch (pfErr) {
                // Fail-closed: si no pudimos revalidar, no mandamos.
                console.warn(`[AntiBanQueue] 🚦 Preflight falló para ${targetWaId} (${pfErr.message}). Descartando envío por seguridad.`);
                resolve({ skipped: true, reason: `preflight error: ${pfErr.message}` });
                return;
            }
        }

        // 4. Aplicar Spintax si el contenido es texto
        let processedContent = content;
        if (content) {
            processedContent = this.parseSpintax(content);
        }

        // 5. Simular interacción humana (sendSeen + sendStateTyping)
        let chat;
        try {
            chat = await this.client.getChatById(targetWaId);
            
            // Marcar como leído antes de responder
            await chat.sendSeen();
            
            if (processedContent) {
                await chat.sendStateTyping();
            }
        } catch (err) {
            console.warn('[AntiBanQueue] Error simulando interacción (sendSeen/typing):', err.message);
        }

        if (processedContent) {
            // Velocidad humana: 45ms por carácter. Min 2.5s, Max 8s.
            const typingDuration = Math.min(Math.max(processedContent.length * 45, 2500), 8000);
            console.log(`[AntiBanQueue] Simulando tipeo para ${targetWaId} durante ${typingDuration}ms...`);
            await new Promise(r => setTimeout(r, typingDuration));
        }

        // 6. Enviar mensaje (con timeout duro para no colgar la cola si la sesión falla)
        console.log(`[AntiBanQueue] Enviando mensaje a ${targetWaId}...`);

        const MessageMedia = require('whatsapp-web.js').MessageMedia;
        const SEND_TIMEOUT_MS = media ? 90000 : 25000; // media puede tardar en subir
        let sentReceipt;

        if (media && media.base64) {
            const mediaObj = new MessageMedia(media.mimetype, media.base64, media.filename || 'image.jpg');
            const sendOptions = { caption: processedContent || '' };
            if (media.mimetype.includes('audio/')) {
                sendOptions.sendAudioAsVoice = true;
            }
            sentReceipt = await withTimeout(
                this.client.sendMessage(targetWaId, mediaObj, sendOptions),
                SEND_TIMEOUT_MS,
                'sendMessage (media base64)'
            );
        } else if (media && media.url) {
            const mediaObj = await withTimeout(
                MessageMedia.fromUrl(media.url, { unsafeMime: true }),
                30000,
                'MessageMedia.fromUrl'
            );
            // fromUrl no valida el status HTTP: un 404 devuelve el XML del error
            // como adjunto. Si no es un medio real, abortar para que el caller
            // haga fallback a texto en vez de mandarle un archivo roto al cliente.
            const mime = (mediaObj && mediaObj.mimetype) || '';
            if (!/^(image|audio|video)\//i.test(mime)) {
                throw new Error(`Media URL no devolvió un archivo válido (mimetype: ${mime || 'desconocido'}): ${media.url}`);
            }
            const sendOptions = { caption: processedContent || '' };
            sentReceipt = await withTimeout(
                this.client.sendMessage(targetWaId, mediaObj, sendOptions),
                SEND_TIMEOUT_MS,
                'sendMessage (media url)'
            );
        } else {
            sentReceipt = await withTimeout(
                this.client.sendMessage(targetWaId, processedContent),
                SEND_TIMEOUT_MS,
                'sendMessage (texto)'
            );
        }

        // Guardar timestamp de envío para límites horarios
        this.sentTimestamps.push(Date.now());

        // El mensaje ya se envió: resolvemos de inmediato para que el CRM no espere
        // el jitter de espaciado. El delay posterior sigue bloqueando el PRÓXIMO
        // envío de la cola (protección anti-ban), pero no al que acaba de mandar.
        resolve(sentReceipt);

        // 7. Retardo posterior al envío (Jitter) para espaciado humano
        // Mensajes proactivos/fuera de ventana automatizados: 45 a 90 segundos.
        // Respuestas en ventana / manuales de vendedores: 3 a 7 segundos.
        let delayMs;
        if (options.isProactive || (isOutOfWindow && options.isAutomated !== false)) {
            delayMs = Math.floor(Math.random() * (90000 - 45000 + 1)) + 45000;

            // Retardo entre lotes de mensajes: cada 5 envíos de automatización, pausar 8 a 15 minutos
            this.sentMessagesInBatch++;
            if (this.sentMessagesInBatch >= 5) {
                this.sentMessagesInBatch = 0;
                const batchDelayMs = Math.floor(Math.random() * (900000 - 480000 + 1)) + 480000;
                console.log(`[AntiBanQueue] 📦 Lote de 5 mensajes completado. Aplicando pausa de lote de ${(batchDelayMs / 60000).toFixed(1)} minutos...`);
                delayMs = batchDelayMs;
            }
        } else {
            delayMs = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;
        }

        // En vez de bloquear la cola durante el espaciado (lo que trababa los envíos
        // manuales detrás de la automatización), registramos un cooldown. Solo frena
        // a los PRÓXIMOS envíos automáticos; los manuales lo saltan.
        this.cooldownUntil = Date.now() + delayMs;
        console.log(`[AntiBanQueue] Mensaje enviado. Cooldown de ${(delayMs / 1000).toFixed(1)}s para el próximo envío automático.`);
    }

    /**
     * Reanuda manualmente la cola tras una pausa de seguridad.
     */
    resumeQueue() {
        this.isPaused = false;
        this.consecutiveFailures = 0;
        console.log('[AntiBanQueue] Cola reanudada manualmente.');
        this.processQueue();
    }
}

const antiBanQueue = new AntiBanQueue();
module.exports = antiBanQueue;
