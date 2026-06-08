/**
 * Orquestador de seguimientos de venta.
 * Coordina: config → eligibility → generator → validator → sender.
 *
 * Este archivo SOLO orquesta el flujo. Toda la lógica vive en followups/.
 */

const { prisma } = require('./db');
const { getClient } = require('./whatsapp-client');
const { checkEligibility } = require('./followups/eligibility');
const { generateFollowUpMessage } = require('./followups/message-generator');
const { sendFollowUp } = require('./followups/sender');
const {
    TEST_MODE,
    QUOTE_LOOKBACK_DAYS,
    SEND_DELAY_MIN_MINUTES,
    SEND_DELAY_MAX_MINUTES,
} = require('./followups/config');

// Horario comercial — función centralizada
const { isBusinessHours } = require('./shared/business-hours');

// Lock de concurrencia
let isFollowUpRunning = false;

/**
 * Busca presupuestos pendientes y ejecuta el pipeline de seguimiento
 * para cada cliente elegible.
 */
async function checkAndSendSalesFollowUps() {
    if (isFollowUpRunning) {
        console.log(`  [Sales-FollowUps] Ya hay una ejecución en curso. Omitiendo.`);
        return;
    }

    isFollowUpRunning = true;

    try {
        const now = new Date();

        // 1. Validar horario comercial
        if (!isBusinessHours(now)) {
            console.log(`  [Sales-FollowUps] Fuera de horario comercial. Postergando.`);
            return;
        }

        // 2. Validar que WhatsApp esté conectado
        const wc = getClient();
        if (!wc) {
            console.log(`  [Sales-FollowUps] WhatsApp no inicializado. Cancelando.`);
            return;
        }

        const modeLabel = TEST_MODE ? '🧪 MODO TEST' : '🚀 PRODUCCIÓN';
        console.log(`\n  🔍 [Sales-FollowUps] ${modeLabel} — Buscando presupuestos pendientes...`);

        // 3. Buscar presupuestos pendientes
        const pendingQuotes = await prisma.order.findMany({
            where: {
                orderType: 'QUOTE',
                status: 'PENDING',
                isDeleted: false,
                createdAt: { gte: new Date(Date.now() - QUOTE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000) },
            },
            include: {
                client: {
                    include: {
                        tags: true,
                        whatsappChats: { where: { archived: false } },
                    },
                },
                items: {
                    include: { product: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (pendingQuotes.length === 0) {
            console.log(`  [Sales-FollowUps] No hay presupuestos pendientes.`);
            return;
        }

        console.log(`  [Sales-FollowUps] ${pendingQuotes.length} presupuestos encontrados. Evaluando elegibilidad...`);

        // 4. Procesar cada presupuesto
        const processedClients = new Set();
        let sent = 0;
        let skipped = 0;
        let failed = 0;

        for (const quote of pendingQuotes) {
            const client = quote.client;
            if (!client) continue;

            // Dedup: solo 1 seguimiento por cliente por ejecución
            if (processedClients.has(client.id)) continue;
            processedClients.add(client.id);

            const chat = client.whatsappChats[0];
            if (!chat) continue;

            try {
                // A. Verificar elegibilidad
                const eligibility = await checkEligibility({ client, chat, quote, now });
                if (!eligibility.eligible) {
                    console.log(`  ⏭️ [Sales-FollowUps] ${eligibility.reason}`);
                    skipped++;
                    continue;
                }

                console.log(`  🎯 [Sales-FollowUps] ${eligibility.reason}`);

                // B. Recuperar historial reciente
                const recentMessages = await prisma.whatsAppMessage.findMany({
                    where: { chatId: chat.id },
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                });

                // C. Generar mensaje con IA
                const generated = await generateFollowUpMessage({
                    client,
                    chat,
                    quote,
                    followUpType: eligibility.followUpType,
                    recentMessages,
                });

                if (!generated.text) {
                    console.warn(`  ⚠️ [Sales-FollowUps] No se pudo generar mensaje para ${client.name}: ${generated.error}`);
                    failed++;
                    continue;
                }

                // D. Marcar label ANTES del delay (anti-duplicado entre ejecuciones del cron)
                try {
                    const currentChat = await prisma.whatsAppChat.findUnique({ where: { id: chat.id } });
                    let updatedLabels = [...(currentChat?.chatLabels || [])];
                    if (!updatedLabels.includes(eligibility.label)) {
                        updatedLabels.push(eligibility.label);
                    }
                    await prisma.whatsAppChat.update({
                        where: { id: chat.id },
                        data: { chatLabels: updatedLabels },
                    });
                } catch (labelErr) {
                    console.error(`  ⚠️ Error pre-marcando label ${eligibility.label} para ${client.name}:`, labelErr.message);
                }

                // E. Delay entre envíos (await secuencial, sin setTimeout huérfanos)
                const delayMinutes = SEND_DELAY_MIN_MINUTES + Math.random() * (SEND_DELAY_MAX_MINUTES - SEND_DELAY_MIN_MINUTES);
                console.log(`  🕒 [Sales-FollowUps] Esperando ${delayMinutes.toFixed(1)} min antes de enviar a ${client.name}...`);
                await new Promise(resolve => setTimeout(resolve, delayMinutes * 60 * 1000));

                // F. Enviar
                const result = await sendFollowUp({
                    waId: chat.waId,
                    text: generated.text,
                    chatId: chat.id,
                    label: eligibility.label,
                    clientName: client.name,
                    followUpType: eligibility.followUpType,
                });

                if (result.sent) {
                    sent++;
                } else {
                    console.log(`  🚫 [Sales-FollowUps] Envío cancelado para ${client.name}: ${result.reason}`);
                    skipped++;
                }

            } catch (quoteError) {
                console.error(`  ❌ [Sales-FollowUps] Error procesando ${client.name}:`, quoteError.message);
                failed++;
            }
        }

        console.log(`  📊 [Sales-FollowUps] Resumen: ${sent} enviados, ${skipped} omitidos, ${failed} fallidos.\n`);

    } finally {
        isFollowUpRunning = false;
    }
}

module.exports = {
    checkAndSendSalesFollowUps,
};
