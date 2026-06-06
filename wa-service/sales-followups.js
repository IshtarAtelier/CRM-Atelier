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

    // NO incluir order.id para evitar que el LLM filtre CUIDs internos al cliente
    return `Items del presupuesto:\n${itemsStr}\nTotal: $${order.total}`;
}

/**
 * Envía un mensaje con delay simulando tipeo
 */
async function sendFollowUpMessage(waId, text, chatId, labelToAdd) {
    try {
        // RE-VALIDACIÓN PRE-ENVÍO: verificar que el chat siga siendo válido para follow-up
        // (entre el setTimeout y este momento pudieron pasar minutos donde el cliente escribió,
        //  el vendedor intervino, o el bot se apagó)
        const freshChat = await prisma.whatsAppChat.findUnique({ where: { id: chatId } });
        if (!freshChat) {
            console.log(`  🚫 [Follow-Up] Chat ${chatId} ya no existe. Cancelando envío.`);
            return;
        }
        // Si el vendedor apagó el bot manualmente, no enviar
        if (!freshChat.botEnabled) {
            console.log(`  🚫 [Follow-Up] Bot desactivado para ${freshChat.profileName || waId}. Cancelando envío.`);
            return;
        }
        // Si hubo actividad reciente (el cliente escribió o el vendedor respondió), no interrumpir
        if (freshChat.lastMessageAt) {
            const timeSinceLastMsg = Date.now() - new Date(freshChat.lastMessageAt).getTime();
            if (timeSinceLastMsg < 2 * 60 * 60 * 1000) { // menos de 2 horas desde último msg
                console.log(`  🚫 [Follow-Up] Actividad reciente en chat de ${freshChat.profileName || waId} (hace ${(timeSinceLastMsg / 3600000).toFixed(1)}hs). Cancelando envío diferido.`);
                return;
            }
        }

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

        // Actualizar chat: agregar etiqueta de seguimiento (NO forzar botEnabled para respetar la decisión del vendedor)
        await prisma.whatsAppChat.update({
            where: { id: chatId },
            data: {
                chatLabels: updatedLabels,
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
    
    // URGENTE: DESACTIVADO TEMPORALMENTE
    console.log(`  🛑 [Sales-FollowUps] SISTEMA DE SEGUIMIENTOS DESACTIVADO TEMPORALMENTE A PEDIDO DEL USUARIO.`);
    return;
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
            createdAt: { gte: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) }
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
        maxOutputTokens: 1024, // 500 era muy bajo y causaba truncamiento de mensajes
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

        // Excluir si el bot está desactivado para este chat (no desperdiciar llamadas a Gemini)
        if (!chat.botEnabled) {
            console.log(`  [Sales-FollowUps] Bot desactivado para ${client.name}. Omitiendo generación de mensaje.`);
            continue;
        }

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

        // Excluir si el usuario canceló seguimientos manualmente
        if ((chat.chatLabels || []).includes('SIN_SEGUIMIENTO')) {
            console.log(`  [Sales-FollowUps] Chat de ${client.name} tiene SIN_SEGUIMIENTO. Omitiendo.`);
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

        // DEDUP con inactividad: respetar cooldown de 24hs desde último follow-up de cualquier tipo
        if (chat.lastFollowUpAt) {
            const timeSinceLastFU = now.getTime() - new Date(chat.lastFollowUpAt).getTime();
            if (timeSinceLastFU < 24 * 60 * 60 * 1000) {
                console.log(`  [Sales-FollowUps] Cliente ${client.name} recibió follow-up hace ${(timeSinceLastFU / 3600000).toFixed(1)}hs. Omitiendo.`);
                continue;
            }
        }

        // EVITAR INTERRUMPIR CHATS ACTIVOS: Validar que el último mensaje (del bot o del usuario) haya sido hace más de 24hs
        if (chat.lastMessageAt) {
            const timeSinceLastMessage = now.getTime() - new Date(chat.lastMessageAt).getTime();
            if (timeSinceLastMessage < 24 * 60 * 60 * 1000) {
                console.log(`  [Sales-FollowUps] El chat con ${client.name} tuvo actividad reciente (hace ${(timeSinceLastMessage / 3600000).toFixed(1)}hs). Esperando a que se enfríe.`);
                continue;
            }
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
        } else if (diffHours >= 360 && labels.includes('SEGUIMIENTO_DIA_4') && !labels.includes('SEGUIMIENTO_DIA_15')) {
            followUpType = 'DIA_15';
            labelToAdd = 'SEGUIMIENTO_DIA_15';
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
        } else if (followUpType === 'DIA_4') {
            userPromptText += `TIPO DE SEGUIMIENTO: DÍA 4 (96 horas después del presupuesto).\n` +
                              `OBJETIVO: Notificar de forma sumamente amigable que los precios de laboratorio pueden actualizarse pronto y el presupuesto vencerá. Recordarle la flexibilidad de señar para congelar el valor o usar cuotas. Si en el chat el cliente prometió pasar por el local o dio una respuesta intermedia, hacé referencia directa a eso.`;
        } else if (followUpType === 'DIA_15') {
            userPromptText += `TIPO DE SEGUIMIENTO: DÍA 15 (360 horas después del presupuesto).\n` +
                              `OBJETIVO: Retomar la conversación. Mirando el contexto del chat, adaptá la siguiente idea para que suene natural y contenga el nombre de pila del cliente:\n"Hola [Nombre] como estas ? queria saber si pudiste al final hacer los anteojitos o si todavia estas interesado en hacerlos contame queres que retomemos la compra ?"`;
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
            // Limpiar comillas envolventes que Gemini a veces agrega
            generatedText = generatedText.replace(/^"|"$/g, '').trim();

            if (!generatedText) {
                console.error(`  ⚠️ [Sales-FollowUps] Gemini devolvió respuesta vacía para ${client.name}.`);
                continue;
            }

            // GUARDRAIL: Detectar si filtró IDs internos (CUIDs) o estructuras JSON
            const cuidRegex = /\bc[a-z0-9]{23,29}\b/gi;
            const hasJson = /\{[\s\S]*?\}/.test(generatedText) && (generatedText.includes('"') || generatedText.includes(':'));
            if (cuidRegex.test(generatedText) || hasJson) {
                console.warn(`  🛑 [Sales-FollowUps] GUARDRAIL: Mensaje para ${client.name} contenía datos internos. Descartando.`);
                continue;
            }

            // Validar que el mensaje esté completo (no cortado a mitad de oración)
            const endsClean = /[.!?\)😊☕👓👋🙌✨💪🤗😄🫶🤙💐🌟🥰😉👀🏠🔬💎🕶️📋❤️]$/.test(generatedText);
            if (generatedText.length < 20 || !endsClean) {
                console.warn(`  ⚠️ [Sales-FollowUps] Mensaje posiblemente incompleto para ${client.name}: "${generatedText.substring(0, 80)}...". Descartando.`);
                continue;
            }

            // ANTI-DUPLICADO: Marcar label INMEDIATAMENTE en la DB (antes del setTimeout)
            // para que si el cron corre de nuevo, no vuelva a programar el mismo seguimiento
            try {
                const currentChat = await prisma.whatsAppChat.findUnique({ where: { id: chat.id } });
                let updatedLabels = [...(currentChat?.chatLabels || [])];
                if (!updatedLabels.includes(labelToAdd)) {
                    updatedLabels.push(labelToAdd);
                }
                await prisma.whatsAppChat.update({
                    where: { id: chat.id },
                    data: { chatLabels: updatedLabels }
                });
            } catch (labelErr) {
                console.error(`Error marcando label ${labelToAdd} para ${client.name}:`, labelErr.message);
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
