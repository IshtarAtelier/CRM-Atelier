const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { SystemMessage, HumanMessage } = require("@langchain/core/messages");
const { prisma } = require('./db');
const { getClient, sendMessage, sendTypingState } = require('./whatsapp-client');
const { TAGS_SIN_BOT, withTimeout } = require('./utils');

// Lock para evitar ejecuciones concurrentes del cron
let isFollowUpRunning = false;

/**
 * Verifica si corresponde al horario comercial de Argentina (UTC-3)
 */
function isBusinessHours(date = new Date()) {
    const argDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const day = argDate.getDay(); // 0 = Domingo, 6 = Sábado
    const hour = argDate.getHours();
    const minute = argDate.getMinutes();
    const timeDecimal = hour + minute / 60;

    if (day === 0) return false; // Domingo cerrado
    if (day === 6) {
        return timeDecimal >= 10 && timeDecimal < 14; // Sábado 10:00 - 14:00
    }
    // Lunes a Viernes: 9:00 - 13:30 y 16:00 - 19:30
    return (timeDecimal >= 9 && timeDecimal < 13.5) || (timeDecimal >= 16 && timeDecimal < 19.5);
}

/**
 * Obtiene los detalles formateados del presupuesto para enviárselos al LLM
 */
function formatQuoteDetails(order) {
    if (!order || !order.items || order.items.length === 0) return "Presupuesto sin detalles específicos.";
    
    const itemsStr = order.items.map(item => {
        const name = item.productNameSnapshot || (item.product ? item.product.name : 'Producto');
        const qty = item.quantity;
        const price = item.price;
        return `- ${qty}x ${name} ($${price})`;
    }).join('\n');

    return `Presupuesto ID: ${order.id}\nItems:\n${itemsStr}\nTotal: $${order.total}`;
}

/**
 * Envía un mensaje con delay simulando tipeo
 */
async function sendFollowUpMessage(waId, text, chatId, labelToAdd) {
    try {
        if (global.botReplyingTo) {
            global.botReplyingTo.add(waId);
        }
        console.log(`  ⏳ [Follow-Up] Simulando escritura para ${waId}...`);
        await sendTypingState(waId);
        
        // Simular tipeo proporcional a la longitud (aprox 40ms por letra, mínimo 2s, máx 6s)
        const typingMs = Math.min(Math.max(text.length * 40, 2000), 6000);
        await new Promise(resolve => setTimeout(resolve, typingMs));

        console.log(`  ✉️ [Follow-Up] Enviando mensaje a ${waId}`);
        const sent = await sendMessage(waId, text);

        const msgSerializedId = sent?.id?._serialized || `followup_${Date.now()}`;

        // Guardar mensaje en base de datos
        await prisma.whatsAppMessage.create({
            data: {
                chatId: chatId,
                direction: 'OUTBOUND',
                type: 'TEXT',
                content: text,
                waMessageId: msgSerializedId,
                senderName: 'Bot',
                status: 'SENT'
            }
        });

        // Recuperar chat actual para actualizar etiquetas sin borrar las existentes
        const currentChat = await prisma.whatsAppChat.findUnique({
            where: { id: chatId }
        });

        let updatedLabels = [...(currentChat.chatLabels || [])];
        if (!updatedLabels.includes(labelToAdd)) {
            updatedLabels.push(labelToAdd);
        }

        // Actualizar chat: agregar etiqueta de seguimiento y asegurar que el bot está habilitado
        await prisma.whatsAppChat.update({
            where: { id: chatId },
            data: {
                chatLabels: updatedLabels,
                botEnabled: true, // reactivar bot para procesar su respuesta
                lastMessageAt: new Date(),
                lastFollowUpAt: new Date() // DEDUP: evitar que el cron de inactividad envíe otro follow-up
            }
        });

        // Emitir actualización por Socket.io
        if (global.io) {
            global.io.emit('chat_updated', { chatId });
        }

        console.log(`  @ [Follow-Up] Mensaje enviado y chat ${chatId} actualizado con etiqueta ${labelToAdd}`);
    } catch (err) {
        console.error(`❌ Error en sendFollowUpMessage para ${waId}:`, err.message);
    } finally {
        if (global.botReplyingTo) {
            setTimeout(() => global.botReplyingTo.delete(waId), 3000);
        }
    }
}

/**
 * Procesa y envía los seguimientos de venta contextuales (Día 1 y Día 4)
 */
async function checkAndSendSalesFollowUps() {
    // Lock de concurrencia: prevenir ejecuciones superpuestas del cron
    if (isFollowUpRunning) {
        console.log(`  [Sales-FollowUps] Ya hay una ejecución en curso. Omitiendo.`);
        return;
    }
    isFollowUpRunning = true;

    try {
    const now = new Date();
    
    // 1. Validar horario comercial
    if (!module.exports.isBusinessHours(now)) {
        console.log(`  [Sales-FollowUps] Fuera de horario comercial. Postergando envíos.`);
        return;
    }

    const wc = getClient();
    if (!wc) {
        console.log(`  [Sales-FollowUps] Cliente de WhatsApp no inicializado. Cancelando chequeo.`);
        return;
    }

    console.log(`  🔍 [Sales-FollowUps] Buscando presupuestos pendientes para seguimientos...`);

    // 2. Buscar presupuestos pendientes
    const pendingQuotes = await prisma.order.findMany({
        where: {
            orderType: 'QUOTE',
            status: 'PENDING',
            isDeleted: false,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        },
        include: {
            client: {
                include: {
                    tags: true,
                    whatsappChats: {
                        where: { archived: false }
                    }
                }
            },
            items: {
                include: {
                    product: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    if (pendingQuotes.length === 0) {
        console.log(`  [Sales-FollowUps] No hay presupuestos pendientes.`);
        return;
    }

    // Instanciar modelo de Gemini
    const model = new ChatGoogleGenerativeAI({
        model: 'gemini-2.5-flash',
        temperature: 0.7, // Un toque de creatividad para sonar humano
        maxOutputTokens: 300,
        apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY
    });

    let queueDelay = 0; // Delay acumulado para la cola de envíos

    const processedClients = new Set();

    for (const quote of pendingQuotes) {
        const client = quote.client;
        if (!client) continue;

        if (processedClients.has(client.id)) {
            continue;
        }
        processedClients.add(client.id);

        try {

        const chat = client.whatsappChats[0];
        if (!chat) continue; // Cliente sin chat de WhatsApp activo

        // Excluir si tiene tags de no bot o cancelación en el cliente
        const tieneTagExclusion = client.tags.some(tag =>
            TAGS_SIN_BOT.some(t => tag.name.toLowerCase().includes(t))
        );
        if (tieneTagExclusion) continue;

        // Excluir si el vendedor desactivó manualmente el bot en el chat
        const tieneLabelApagado = (chat.chatLabels || []).some(label => 
            label.includes('[SISTEMA - BOT APAGADO]') || 
            TAGS_SIN_BOT.some(t => label.toLowerCase().includes(t))
        );
        if (tieneLabelApagado) {
            console.log(`  [Sales-FollowUps] Chat de ${client.name} desactivado manualmente o excluido. Ignorando.`);
            continue;
        }

        // Validar si tiene compras/pedidos posteriores (tanto tipo SALE como ORDER)
        const completedOrders = await prisma.order.findMany({
            where: {
                clientId: client.id,
                orderType: { in: ['SALE', 'ORDER'] },
                createdAt: { gt: quote.createdAt },
                isDeleted: false
            }
        });
        if (completedOrders.length > 0) {
            console.log(`  [Sales-FollowUps] Cliente ${client.name} ya realizó compras posteriores. Ignorando.`);
            continue;
        }

        // Validar si tiene algún pago registrado posterior al presupuesto
        const completedPayments = await prisma.payment.findMany({
            where: {
                order: {
                    clientId: client.id
                },
                date: { gt: quote.createdAt }
            }
        });
        if (completedPayments.length > 0) {
            console.log(`  [Sales-FollowUps] Cliente ${client.name} ya registró pagos posteriores. Ignorando.`);
            continue;
        }

        // Determinar qué nivel de seguimiento le corresponde
        const diffMs = now.getTime() - new Date(quote.createdAt).getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        let followUpType = null;
        let labelToAdd = null;

        const labels = chat.chatLabels || [];

        if (diffHours >= 24 && !labels.includes('SEGUIMIENTO_DIA_1')) {
            followUpType = 'DIA_1';
            labelToAdd = 'SEGUIMIENTO_DIA_1';
        } else if (diffHours >= 96 && labels.includes('SEGUIMIENTO_DIA_1') && !labels.includes('SEGUIMIENTO_DIA_4')) {
            followUpType = 'DIA_4';
            labelToAdd = 'SEGUIMIENTO_DIA_4';
        }

        if (!followUpType) continue; // No cumple los plazos o ya se enviaron los seguimientos

        console.log(`  🎯 [Sales-FollowUps] Cliente ${client.name} califica para seguimiento ${followUpType} (${diffHours.toFixed(1)}hs transcurridas)`);

        // Recuperar historial reciente del chat (últimos 10 mensajes)
        const recentMessages = await prisma.whatsAppMessage.findMany({
            where: { chatId: chat.id },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        const formattedHistory = recentMessages.reverse().map(m => 
            `[${m.direction === 'OUTBOUND' ? 'Nosotros' : 'Cliente'}]: ${m.content}`
        ).join('\n');

        const quoteDetails = formatQuoteDetails(quote);

        // Diseñar prompt ultra-humano
        const systemMessage = new SystemMessage(
            "Sos el asistente virtual de Atelier Óptica. Tu único objetivo es escribir un mensaje de seguimiento de ventas muy cálido, natural y simpático a través de WhatsApp.\n\n" +
            "REGLAS DE ESCRITURA CRÍTICAS (DEBÉS CUMPLIRLAS ESTRICTAMENTE):\n" +
            "1. NUNCA uses el signo de interrogación de apertura (¿). Solo usá el de cierre (?). Ejemplo: escribir 'cómo andás?' en lugar de '¿cómo andás?'.\n" +
            "2. Usá 'voseo' argentino (ej: 'venite', 'querés', 'pensás', 'mirá', 'comentame').\n" +
            "3. Escribí de forma relajada y descontracturada, sin mayúsculas exageradas ni puntuación sumamente rígida. Separá ideas con comas de forma simple. No uses saludos formales como 'Estimado' o 'Atentamente'.\n" +
            "4. Sé breve: máximo 3 líneas de texto.\n" +
            "5. Usá emojis de forma sutil y amigable (ej: 😊, ☕, 👓, 👋).\n" +
            "6. Sé original: no copies plantillas. Adaptá el saludo y la forma de escribir a la personalidad del cliente.\n" +
            "7. Hacé referencia al contexto de los últimos mensajes o al resumen de la conversación si es pertinente para continuar la charla con fluidez.\n" +
            "8. ESTÁ COMPLETAMENTE PROHIBIDO usar lunfardo o expresiones callejeras como 'che', 'copado', 'piola', 're', 'mortal', 'todo súper', 'qué onda', 'geniazo'. El tono debe ser hospitalario y profesional, no callejero. La palabra 'dale' sí está permitida."
        );

        let userPromptText = `INFORMACIÓN DEL CLIENTE:\n- Nombre: ${client.name}\n`;
        if (chat.chatSummary) {
            userPromptText += `- Resumen de la conversación: "${chat.chatSummary}"\n`;
        }
        userPromptText += `- Detalles del Presupuesto Pendiente:\n${quoteDetails}\n\n`;
        userPromptText += `HISTORIAL DE CHAT RECIENTE:\n${formattedHistory}\n\n`;
        
        if (followUpType === 'DIA_1') {
            userPromptText += `TIPO DE SEGUIMIENTO: DÍA 1 (24 horas después del presupuesto).\n` +
                              `OBJETIVO: Preguntar amablemente si le quedó alguna duda sobre la cotización. Invitarlo a pasar por el Atelier a probarse los armazones en persona (decile que lo esperamos con un rico café/té ☕) o ver si prefiere coordinar online directamente. Recordá la pregunta clave: 'cuando te quedaría comodo venir o preferis hacerlo online?'.`;
        } else {
            userPromptText += `TIPO DE SEGUIMIENTO: DÍA 4 (96 horas después del presupuesto).\n` +
                              `OBJETIVO: Notificar de forma sumamente amigable que los precios de laboratorio pueden actualizarse pronto y el presupuesto vencerá. Recordarle la flexibilidad de señar para congelar el valor o usar cuotas. Si en el chat el cliente prometió pasar por el local o dio una respuesta intermedia, hacé referencia directa a eso.`;
        }

        userPromptText += `\n\nRedactá únicamente el texto exacto del mensaje que enviaremos al cliente por WhatsApp. No agregues comillas, ni introducciones, ni explicaciones.`;

        const humanMessage = new HumanMessage(userPromptText);

        try {
            const response = await withTimeout(
                model.invoke([systemMessage, humanMessage]),
                30000,
                'Gemini sales followups timeout'
            );
            let generatedText = response.content.toString().trim();

            // Sanitizar salida: eliminar ¿ y ¡ prohibidos
            generatedText = generatedText.replace(/[¿¡]/g, '').trim();

            if (!generatedText) {
                console.error(`  ⚠️ [Sales-FollowUps] Gemini devolvió respuesta vacía para ${client.name}.`);
                continue;
            }

            // Cola de envíos: acumular delay para espaciar los envíos entre 3 y 7 minutos
            const delayMin = 3;
            const delayMax = 7;
            const randomDelayMinutes = Math.random() * (delayMax - delayMin) + delayMin;
            queueDelay += randomDelayMinutes * 60 * 1000;

            console.log(`  🕒 [Sales-FollowUps] Programando envío a ${client.name} en ${(queueDelay / 60000).toFixed(1)} minutos.`);

            setTimeout(() => {
                sendFollowUpMessage(chat.waId, generatedText, chat.id, labelToAdd)
                    .catch(err => console.error(`❌ Error en envío diferido a ${client.name}:`, err.message));
            }, queueDelay);

        } catch (llmErr) {
            console.error(`❌ Error invocando a Gemini para ${client.name}:`, llmErr.message);
        }
        } catch (quoteError) {
            console.error(`  ⚠️ [Sales-FollowUps] Error procesando presupuesto de ${client?.name || 'desconocido'}:`, quoteError.message);
            continue;
        }
    }

    } finally {
        isFollowUpRunning = false;
    }
}

module.exports = {
    checkAndSendSalesFollowUps,
    isBusinessHours
};
