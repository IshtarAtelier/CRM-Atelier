const { prisma } = require('../db');
const { getAdminWaId } = require('../utils');

class AntiBanQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.client = null;
        this.dailyProactiveLimit = 80; // Límite diario de seguimientos proactivos
        this.consecutiveFailures = 0;
        this.MAX_CONSECUTIVE_FAILURES = 3;
        this.isPaused = false;
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
            this.queue.push({ waId, content, media, options, resolve, reject });
            console.log(`[AntiBanQueue] Mensaje encolado para ${waId}. Tamaño de cola: ${this.queue.length}`);
            this.processQueue();
        });
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
     * Loop de procesamiento de la cola.
     */
    async processQueue() {
        if (this.isProcessing || this.isPaused || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;
        const task = this.queue.shift();

        try {
            await this.executeTask(task);
            this.consecutiveFailures = 0; // Resetear fallos tras éxito
        } catch (error) {
            console.error(`[AntiBanQueue] Error enviando mensaje a ${task.waId}:`, error.message);
            this.consecutiveFailures++;

            if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
                console.error(`[AntiBanQueue] 🚨 LÍMITE DE FALLOS CONSECUTIVOS ALCANZADO (${this.consecutiveFailures}). Pausando cola.`);
                this.isPaused = true;

                try {
                    const adminWaId = getAdminWaId();
                    if (this.client) {
                        await this.client.sendMessage(
                            adminWaId,
                            `🚨 *ALERTA ANTIBAN* 🚨\n\nSe han detectado ${this.consecutiveFailures} fallos de envío consecutivos en WhatsApp. La cola ha sido PAUSADA para evitar bloqueos de la cuenta.`
                        );
                    }
                } catch (adminErr) {
                    console.error('[AntiBanQueue] No se pudo notificar al administrador sobre pausa de cola:', adminErr.message);
                }
            }

            task.reject(error);
        } finally {
            this.isProcessing = false;
            // Pequeña espera de cortesía antes del siguiente ciclo
            setTimeout(() => this.processQueue(), 1000);
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

        // 1. Resolver y validar el número en WhatsApp
        let targetWaId = waId;
        try {
            if (targetWaId.includes('@c.us')) {
                const numberId = await this.client.getNumberId(targetWaId);
                if (numberId && numberId._serialized) {
                    targetWaId = numberId._serialized;
                } else {
                    reject(new Error('El número no está registrado en WhatsApp o es inválido'));
                    return;
                }
            }
        } catch (e) {
            console.warn(`[AntiBanQueue] No se pudo validar el ID de número para ${targetWaId}: ${e.message}`);
        }

        // 2. Analizar historial del chat en la DB para auditoría anti-ban
        let isColdContact = false;
        let isOutOfWindow = false;

        try {
            const chatDb = await prisma.whatsAppChat.findUnique({
                where: { waId: targetWaId },
                include: {
                    messages: {
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });

            if (chatDb) {
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

        // 3. Reglas de protección estricta para mensajes automáticos proactivos
        if (options.isProactive) {
            // A. Escudo contra contactos fríos (Cold Contact Shield)
            if (isColdContact) {
                console.warn(`[AntiBanQueue] 🛡️ Cold Contact Shield activado para ${targetWaId}. Cancelando seguimiento automático.`);
                reject(new Error('Cold Contact Shield: El destinatario no tiene historial de mensajes entrantes (contacto frío)'));
                return;
            }

            // B. Límite diario de envíos proactivos automáticos
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
                    console.warn(`[AntiBanQueue] 🚨 Límite diario de mensajes proactivos alcanzado (${automatedSentToday}/${this.dailyProactiveLimit}). Cancelando.`);
                    reject(new Error(`Límite diario de mensajes proactivos alcanzado (${this.dailyProactiveLimit})`));
                    return;
                }
            } catch (limitErr) {
                console.error('[AntiBanQueue] Error verificando límite diario proactivo:', limitErr.message);
            }
        }

        // 4. Aplicar Spintax si el contenido es texto
        let processedContent = content;
        if (content) {
            processedContent = this.parseSpintax(content);
        }

        // 5. Simular tipeo humano
        if (processedContent) {
            try {
                const chat = await this.client.getChatById(targetWaId);
                await chat.sendStateTyping();
            } catch (typingErr) {
                console.warn('[AntiBanQueue] Error enviando estado de tipeo:', typingErr.message);
            }

            // Velocidad humana: 45ms por carácter. Min 2.5s, Max 8s.
            const typingDuration = Math.min(Math.max(processedContent.length * 45, 2500), 8000);
            console.log(`[AntiBanQueue] Simulando tipeo para ${targetWaId} durante ${typingDuration}ms...`);
            await new Promise(r => setTimeout(r, typingDuration));
        }

        // 6. Enviar mensaje
        console.log(`[AntiBanQueue] Enviando mensaje a ${targetWaId}...`);
        
        const MessageMedia = require('whatsapp-web.js').MessageMedia;
        let sentReceipt;

        if (media && media.base64) {
            const mediaObj = new MessageMedia(media.mimetype, media.base64, media.filename || 'image.jpg');
            const sendOptions = { caption: processedContent || '' };
            if (media.mimetype.includes('audio/')) {
                sendOptions.sendAudioAsVoice = true;
            }
            sentReceipt = await this.client.sendMessage(targetWaId, mediaObj, sendOptions);
        } else if (media && media.url) {
            const mediaObj = await MessageMedia.fromUrl(media.url, { unsafeMime: true });
            const sendOptions = { caption: processedContent || '' };
            sentReceipt = await this.client.sendMessage(targetWaId, mediaObj, sendOptions);
        } else {
            sentReceipt = await this.client.sendMessage(targetWaId, processedContent);
        }

        // 7. Retardo posterior al envío (Jitter) para espaciado humano
        // Mensajes proactivos/fuera de ventana: 30 a 75 segundos.
        // Respuestas en ventana / manuales: 3 a 7 segundos.
        let delayMs;
        if (isOutOfWindow || options.isProactive) {
            delayMs = Math.floor(Math.random() * (75000 - 30000 + 1)) + 30000;
        } else {
            delayMs = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;
        }

        console.log(`[AntiBanQueue] Mensaje enviado. Aplicando retraso anti-ban de ${(delayMs / 1000).toFixed(1)}s antes del próximo envío.`);
        await new Promise(r => setTimeout(r, delayMs));

        resolve(sentReceipt);
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
