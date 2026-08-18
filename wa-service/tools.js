const axios = require('axios');
const { contenidoATexto } = require('./shared/ai-content');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { prisma } = require('./db');
const { withTimeout } = require('./utils');
const CRM_API_URL = process.env.CRM_API_URL;
const BOT_API_KEY = process.env.BOT_API_KEY;
if (!BOT_API_KEY) {
    console.error('⚠️ CRITICAL: BOT_API_KEY environment variable is not set!');
    // No lanzar error aquí para no romper el servicio, pero loguear advertencia
}

const apiClient = axios.create({
    headers: { 'x-api-key': BOT_API_KEY },
    timeout: 15000 // 15 second timeout
});

const { sendMessage } = require('./whatsapp/client');

// Helper: Request retry mechanism for transient network or database errors.
// If all retries fail, it throws the error to halt LLM agent execution and prevent sending messages to the client.
async function requestWithRetry(fn, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            console.error(`[API Retry] Attempt ${i + 1}/${retries} failed:`, error.message);
            if (i === retries - 1) {
                throw error;
            }
            await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
        }
    }
}

/**
 * Tool: Search for an existing client by phone or name
 */
async function checkExistingClient({ phone, name }) {
    const response = await requestWithRetry(() => 
        apiClient.get(`${CRM_API_URL}/clients`, {
            params: { phone, name }
        })
    );
    
    const contact = response.data;
    if (contact && contact.found) {
        return { found: true, contact: contact.client };
    }
    return { found: false };
}

/**
 * Origen del contacto según lo que DICE el primer mensaje entrante.
 *
 * Prioridad: plantilla con corchetes de Meta ([metaFlor]) > plantilla de Google
 * ("Vi su anuncio en Google", share.google) > mención explícita de la plataforma
 * > referido. Sin ninguna señal devuelve null y lo elige el vendedor.
 *
 * NO se usa el formato del waId: ver la nota larga abajo sobre @lid.
 */
async function detectContactSourceFromChat(chatId) {
    if (!chatId) return null;

    // Check if the chat was outbound-initiated (first message overall was sent by us)
    const absoluteFirstMessage = await prisma.whatsAppMessage.findFirst({
        where: { chatId },
        orderBy: { createdAt: 'asc' }
    });

    if (absoluteFirstMessage && absoluteFirstMessage.direction === 'OUTBOUND') {
        return null;
    }

    // OJO: acá había una regla que devolvía 'Meta' para todo chat @lid, con el
    // comentario "indicador definitivo de click-to-WhatsApp de Meta". Era cierto
    // cuando se escribió, pero WhatsApp extendió el formato @lid a TODOS los
    // contactos: al 29/7/2026 son 1.412 de 1.442 chats (98%), desde abril.
    //
    // Resultado: la regla marcaba Meta el 98% de lo que entra por WhatsApp y
    // cortaba ANTES de leer el mensaje, así que la detección de Google era código
    // inalcanzable. Se verificaron 8 chats que dicen "Vi su anuncio en Google" y
    // quedaron etiquetados Meta; y hay chats @lid etiquetados a mano como Calle
    // (31), Referido (28) y Google Ads (33) — o sea que @lid no dice nada del
    // origen. Era el motivo de que Meta figurara con 479 contactos contra 68 de
    // Google.
    //
    // Ahora se decide SOLO por lo que dice el mensaje. Sin señal explícita se
    // devuelve null y el vendedor elige: un origen inventado es peor que vacío.
    
    // Find the earliest inbound message
    const firstMessage = await prisma.whatsAppMessage.findFirst({
        where: { chatId, direction: 'INBOUND' },
        orderBy: { createdAt: 'asc' }
    });

    if (!firstMessage || !firstMessage.content) {
        return null;
    }

    const text = firstMessage.content.toLowerCase();

    // 0. Deterministic Template Matches
    // Meta templates with brackets, e.g. [metaSofi], [Metaplaca]
    // Plantillas de Meta con corchetes ([metaSofi], [MetaAgos]) y la frase que
    // agrega la web cuando el visitante trae fbclid. Las dos van en el paso 0,
    // simétricas con las de Google: si "Los vi en Meta." cayera al chequeo
    // genérico de abajo, un "los busqué en google maps" en el mismo mensaje le
    // ganaría y escribiría el origen equivocado.
    if (/\[meta[^\]]*\]/i.test(firstMessage.content) || /los vi en meta\b/i.test(firstMessage.content)) {
        return 'Meta';
    }
    // Google, señales DETERMINÍSTICAS (verificadas contra 120 días de mensajes
    // reales de producción):
    //  · "Los vi en Google Ads." — la frase que ahora agrega la web cuando el
    //    visitante llegó con gclid/wbraid/gbraid.
    //  · "Hola! Vi su anuncio en Google y quiero recibir más información." —
    //    la plantilla de los anuncios de click-to-WhatsApp de Google (10 casos).
    //  · "Encontré este producto en Google: https://share.google/..." — compartir
    //    desde la ficha de Google.
    if (/vi su anuncio en google|los vi en google|encontr[ée] este producto en google|share\.google/i.test(firstMessage.content)) {
        return 'Google Ads';
    }

    // 1. Google por mención genérica de la plataforma
    if (
        text.includes('google') ||
        text.includes('busqueda') ||
        text.includes('búsqueda')
    ) {
        return 'Google Ads';
    }

    // 2. Meta — solo con menciones explícitas de la plataforma (sin regex agresivos)
    if (
        text.includes('instagram') ||
        text.includes('facebook') ||
        // NO usar includes('meta') a secas: matchea "metal", "metales",
        // "metalizado" — y la óptica vende armazones de metal. Con el corte @lid
        // eliminado esta rama decide el 100% de los chats entrantes, así que un
        // "¿tienen armazones de metal?" se etiquetaba Meta. Se exige la palabra
        // sola o acompañada de "ads"/"anuncio".
        /\bmeta\b(?!l)/i.test(text) ||
        text.includes('vi su publicacion') ||
        text.includes('vi tu publicacion') ||
        text.includes('vi su publicación') ||
        text.includes('vi tu publicación') ||
        // "vi el anuncio" / "vi un anuncio" a secas NO dicen la plataforma: pueden
        // ser de Google igual que de Meta. Atribuirlos a Meta era el sesgo que
        // inflaba Meta y vaciaba Google. Sin plataforma explícita se devuelve null
        // y el vendedor elige a mano.
        text.includes('los vi en instagram') ||
        text.includes('los vi en facebook')
    ) {
        return 'Meta';
    }

    // 3. Referido (Recomendó, Amiga, Amigo, etc.)
    if (
        text.includes('recomendó') ||
        text.includes('recomendo') ||
        text.includes('recomendada') ||
        text.includes('recomendado') ||
        text.includes('me recomendaron') ||
        text.includes('amiga') ||
        text.includes('amigo') ||
        text.includes('contacto de') ||
        text.includes('pasó tu número') ||
        text.includes('paso tu numero')
    ) {
        return 'Referido';
    }

    return null;
}

/**
 * Tool: Convert a chat into a Lead in the CRM
 */
async function convertIntoLead({ phone, name, contactSource, interest, chatId, insurance, firstContactAt }) {
    if (name && isPhrase(name)) {
        return { success: false, error: '[INSTRUCCIÓN INTERNA] El nombre no es válido, parece una frase. Preguntale al cliente su nombre de pila de forma natural.' };
    }
    // Sanitizar teléfono: números @lid falsos suelen tener 15+ dígitos puros
    let cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    if (cleanPhone.length > 15 || cleanPhone.length < 8) {
        console.log(`  ⚠️ Teléfono sospechoso descartado: "${phone}" (${cleanPhone.length} dígitos)`);
        cleanPhone = null;
    } else {
        cleanPhone = phone; // Mantener formato original si es válido
    }

    if (!cleanPhone) {
        return { success: false, error: '[INSTRUCCIÓN INTERNA] El teléfono no es válido. Continuá la conversación normalmente sin mencionar este problema.' };
    }

    try {
        const VALID_SOURCES = ["Google Ads", "Meta", "Calle", "Jemima", "Ya es Cliente", "Tienda nube", "Referido", "Wave", "Salida"];
        let resolvedSource = contactSource;
        if (!resolvedSource || !VALID_SOURCES.includes(resolvedSource)) {
            resolvedSource = await detectContactSourceFromChat(chatId);
        }

        // Si no vino la fecha del primer contacto, se busca acá: el primer mensaje
        // entrante del chat. Así la ficha queda fechada en el día que el cliente
        // escribió, aunque el recuperador la cree días más tarde saldando backlog.
        let resolvedFirstContactAt = firstContactAt || null;
        if (!resolvedFirstContactAt && chatId) {
            try {
                const primero = await prisma.whatsAppMessage.findFirst({
                    where: { chatId, direction: 'INBOUND' },
                    orderBy: { createdAt: 'asc' },
                    select: { createdAt: true },
                });
                resolvedFirstContactAt = primero?.createdAt || null;
            } catch (e) {
                console.error('[convertIntoLead] No se pudo resolver firstContactAt:', e.message);
            }
        }

        const response = await requestWithRetry(() =>
            apiClient.post(`${CRM_API_URL}/clients`, {
                phone: cleanPhone,
                name,
                contactSource: resolvedSource,
                interest: interest || 'Otros',
                status: 'CONTACT',
                insurance,
                firstContactAt: resolvedFirstContactAt
            })
        );
        const newContact = response.data.client || response.data;

        if (!newContact || !newContact.id) {
            throw new Error('No se pudo crear el prospecto.');
        }

        if (chatId) {
            await prisma.whatsAppChat.update({
                where: { id: chatId },
                data: { clientId: newContact.id }
            });
        } else if (cleanPhone && cleanPhone.length > 5) {
            await prisma.whatsAppChat.updateMany({
                where: { waId: { startsWith: cleanPhone } },
                data: { clientId: newContact.id }
            });
        }
        // Auto-etiquetar como Bot Lead
        await addTagToClient({ clientId: newContact.id, tagName: 'Bot Lead' });
        
        // Agregar etiqueta visual explícita según la fuente detectada
        if (resolvedSource === 'Meta') {
            await addTagToClient({ clientId: newContact.id, tagName: 'Meta Ads' });
            await addTagToClient({ clientId: newContact.id, tagName: 'Multifocal' });
        } else if (resolvedSource === 'Google Ads') {
            await addTagToClient({ clientId: newContact.id, tagName: 'Google Ads' });
        }

        // Registrar el hito de origen en la ficha
        if (resolvedSource) {
            await prisma.interaction.create({
                data: {
                    clientId: newContact.id,
                    type: 'SUMMARY',
                    content: `📍 [HITO] Origen: ${resolvedSource}`
                }
            });
        }

        return { success: true, contact: newContact };
    } catch (e) {
        console.error('Error en convertIntoLead:', e.message);
        throw new Error('No se pudo registrar al prospecto debido a un error de base de datos.');
    }
}

/**
 * Tool: Update client info
 */
async function updateClientData({ id, ...data }) {
    const response = await requestWithRetry(() =>
        apiClient.post(`${CRM_API_URL}/clients`, { id, ...data })
    );
    return response.data;
}

/**
 * ¿Es un producto que el cliente elige mirándolo? Solo esos llevan foto.
 * El tipo viene del catálogo ("Armazón", "Armazón de Receta", "Lentes de Sol");
 * los clip-ons no tienen tipo propio y se reconocen por el nombre.
 */
function esArmazonOClipon(p) {
    const texto = `${p.category || ''} ${p.name || ''}`
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
    return /armazon|clip|lentes de sol/.test(texto);
}

/**
 * Tool: Get price list for bot quotes
 */
async function getPriceList({ category, search, botRecommended }) {
    const params = {};
    const onlyRecommended = botRecommended !== undefined ? botRecommended : (search ? false : true);
    if (onlyRecommended === true || onlyRecommended === 'true') {
        params.botRecommended = 'true';
    }
    if (category) params.category = category;
    if (search) params.search = search;
    const response = await requestWithRetry(() =>
        apiClient.get(`${CRM_API_URL}/pricing`, { params })
    );
    const rawData = response.data;

    // ── Formato fijo de presupuesto para WhatsApp ──
    // Filtramos la instrucción del sistema y formateamos cada producto
    const products = (Array.isArray(rawData) ? rawData : []).filter(
        p => p.source !== 'SERVICE' && p.priceCash > 0
    ).filter(
        // Excluir clip-ons infantiles/kids — nadie los consulta por WhatsApp
        p => !(p.name && /kid|niño|nino|infantil|chico/i.test(p.name) && /clip/i.test(p.name))
    );

    if (products.length === 0) {
        return '[INSTRUCCIÓN INTERNA] No se encontraron productos para esta búsqueda. Intentá con otra categoría o sin filtro de búsqueda. NO le digas al cliente que no hay productos.';
    }

    // Para no abrumar al cliente se envían como máximo 3 opciones,
    // priorizando los productos sugeridos por la óptica (botRecommended)
    const MAX_QUOTE_OPTIONS = 3;
    const prioritized = [...products].sort(
        (a, b) => (b.botRecommended === true ? 1 : 0) - (a.botRecommended === true ? 1 : 0)
    );
    const selected = prioritized.slice(0, MAX_QUOTE_OPTIONS);
    const omitted = prioritized.slice(MAX_QUOTE_OPTIONS);

    // Formatear cada producto con template fijo
    // El sistema de index.js splitea por \n\n para crear burbujas separadas
    // Cada producto completo = 1 burbuja de WhatsApp
    const formatted = selected.map((p, i) => {
        const name = p.name || 'Producto';
        const cash = p.priceCash;
        const cashFormatted = cash.toLocaleString('es-AR');
        // El total en cuotas viene calculado del CRM, con el mismo criterio que
        // la tienda: el precio de LISTA es el precio en cuotas, y el contado
        // lleva el descuento aplicado.
        //
        // Acá había `Math.round(cash * 1.15)`: un recargo del 15% inventado en
        // el bot y anunciado dos líneas más abajo como "6 cuotas SIN INTERÉS".
        // Además de la contradicción, hacía que el bot cotizara distinto que la
        // web para el mismo producto — el mismo problema que ya costó plata con
        // los cristales Varilux. El `?? cash` es la red por si algún producto
        // llegara sin `priceCredit`: mejor repetir el contado que inventar.
        const creditTotal = Math.round(p.priceCredit ?? cash);
        const cuota = Math.round(creditTotal / 6);
        const cuotaFormatted = cuota.toLocaleString('es-AR');
        const creditTotalFormatted = creditTotal.toLocaleString('es-AR');

        // La foto va SOLO en lo que se elige mirándolo: armazones y clip-ons.
        // En cristales no hay nada que ver (y de hecho no tienen foto cargada:
        // 341/347 armazones sí, 0 de los cristales), así que una imagen ahí es
        // ruido que alarga la charla. El link lleva a la ficha de la tienda.
        let line = '';
        if (esArmazonOClipon(p) && p.imageUrl) {
            line += `[IMAGE: ${p.imageUrl}]\n`;
        }

        line += `*Opción ${i + 1} – ${name}*\n`;
        line += `• Precio contado: *$${cashFormatted}*\n`;
        line += `• 6 cuotas sin interés de *$${cuotaFormatted}* (total *$${creditTotalFormatted}*)`;

        if (p.is2x1) {
            line += `\n🎉 *Promo 2x1* - Incluye dos pares de cristales!`;
        }

        if (esArmazonOClipon(p) && p.link) {
            line += `\n• Link: ${p.link}`;
        }

        return line;
    }).join('\n\n');

    // Si quedaron opciones afuera, avisar internamente al bot sin exponerlas al cliente
    let omittedNote = '';
    if (omitted.length > 0) {
        const omittedNames = omitted.map(p => p.name).filter(Boolean).join(', ');
        omittedNote = `\n\n[INSTRUCCIÓN INTERNA] Hay ${omitted.length} producto(s) más que coinciden y no se incluyeron para no abrumar al cliente: ${omittedNames}. Si el cliente pide más alternativas o alguno de estos en particular, volvé a consultar 'get_price_list' usando 'search' con ese nombre específico.`;
    }

    // Devolver instrucción + texto pre-formateado para que el LLM lo use directamente
    return `[INSTRUCCIÓN INTERNA] Abajo tenés los precios del sistema ya formateados. Envialos al cliente TAL CUAL están, separando cada opción con un doble salto de línea para que lleguen como burbujas separadas de WhatsApp. Podés agregar una introducción breve antes y una pregunta de cierre después, pero NO modifiques los precios, nombres ni el formato de las opciones.\n\n${formatted}${omittedNote}`;
}

/**
 * Tool: Check order status + balance calculation
 */
async function getOrderStatus({ orderId, clientId }) {
    // Los saldos se piden SIEMPRE al CRM, que los calcula con PricingService
    // (markup, descuentos por pedido, equivalente de lista según método de pago).
    // El bot no calcula nada: muestra exactamente lo que muestran los accesos
    // de saldos del CRM, o no informa ningún monto.
    const SILENT_FAIL_INSTRUCTION = "[INSTRUCCIÓN INTERNA] No se pudo obtener el saldo verificado del sistema. TERMINANTEMENTE PROHIBIDO informar montos, saldos o estados de pago al cliente (ni aproximados ni calculados por vos). Creá una tarea con 'create_task' (description: 'Cliente consulta saldo/estado de pedido - verificar en CRM y responder manualmente') y apagá el bot con 'cancel_bot' en silencio total, sin enviar ningún mensaje.";

    const hasOrderId = orderId && orderId !== 'none' && orderId !== 'null';
    const params = hasOrderId ? { orderId } : { clientId };

    if (!hasOrderId && (!clientId || clientId === 'none' || clientId === 'null')) {
        return { found: false, error: SILENT_FAIL_INSTRUCTION };
    }

    let orderResponse;
    try {
        const response = await requestWithRetry(() =>
            apiClient.get(`${CRM_API_URL}/orders`, { params })
        );
        orderResponse = response.data;
    } catch (e) {
        console.error('[getOrderStatus] Error consultando CRM:', e.message);
        return { found: false, error: SILENT_FAIL_INSTRUCTION };
    }

    if (!orderResponse || !orderResponse.found) {
        return { found: false, error: "No se encontraron pedidos ni presupuestos registrados para este cliente. NO inventes estados ni saldos. Si el cliente insiste en que tiene una compra, derivá a un humano con 'create_task' y 'cancel_bot' en silencio." };
    }

    const order = orderResponse.order;
    const fin = orderResponse.financials;

    if (!fin) {
        // Respuesta del CRM sin desglose financiero verificado: no informar montos
        return { found: false, error: SILENT_FAIL_INSTRUCTION };
    }

    const fmt = (n) => `$${Math.round(n || 0).toLocaleString('es-AR')}`;
    const status = order.labStatus || order.status;
    const isQuote = order.orderType === 'QUOTE';

    let text = `[INSTRUCCIÓN INTERNA] Datos EXACTOS y verificados del sistema para el ${isQuote ? 'presupuesto' : 'pedido'} N° ${order.id}. Usá ÚNICAMENTE estos montos, TAL CUAL están. PROHIBIDO calcular, redondear o aplicar descuentos por tu cuenta.\n`;
    text += `\nEstado: ${status}`;
    text += `\nPrecio de lista: ${fmt(fin.listPrice)}`;
    text += `\nPagado hasta ahora: ${fmt(fin.paidReal)}`;

    if (fin.hasBalance) {
        text += `\n\nSALDO PENDIENTE SEGÚN FORMA DE PAGO (informar las tres opciones):`;
        text += `\n• Efectivo en el local: ${fmt(fin.remainingCash)}`;
        text += `\n• Transferencia: ${fmt(fin.remainingTransfer)}`;
        text += `\n• Tarjeta: ${fmt(fin.remainingCard)} (3 cuotas sin interés de ${fmt(fin.remainingCard / 3)} o 6 cuotas sin interés de ${fmt(fin.remainingCard / 6)})`;
    } else {
        text += `\n\nSALDO PENDIENTE: Ninguno. El ${isQuote ? 'presupuesto' : 'pedido'} está completamente pagado (o con diferencia menor a $1.000). NO le reclames ningún pago al cliente.`;
    }

    return {
        found: true,
        orderId: order.id,
        status,
        isQuote,
        updatedAt: order.updatedAt,
        verifiedBalanceReport: text
    };
}

/**
 * Tool: Create a follow-up task
 */
async function createTask({ clientId, description, dueDate }) {
    // Validar que clientId sea un CUID real y no un valor inventado por el LLM
    if (!clientId || clientId === 'none' || clientId === 'null' || clientId === '') {
        return { success: false, error: '[INSTRUCCIÓN INTERNA] No se pudo crear la tarea porque falta el clientId. Continuá la conversación normalmente sin mencionar errores.' };
    }
    if (!/^c[a-z0-9]{20,30}$/.test(clientId)) {
        console.warn(`[createTask] clientId inválido descartado: "${clientId}"`);
        return { success: false, error: '[INSTRUCCIÓN INTERNA] El clientId no es válido. Solo usá create_task cuando tengas clientData.id real en tu contexto.' };
    }
    const response = await requestWithRetry(() =>
        apiClient.post(`${CRM_API_URL}/tasks`, {
            clientId, description, dueDate
        })
    );
    return response.data;
}

/**
 * Tool: Register an interaction
 */
async function addInteraction({ clientId, type, content }) {
    // Validar que clientId sea un CUID real
    if (!clientId || clientId === 'none' || clientId === 'null' || clientId === '') {
      throw new Error('Falta el clientId para crear la nota');
    }
    if (!/^c[a-z0-9]{20,30}$/.test(clientId)) {
        console.warn(`[addInteraction] clientId inválido descartado: "${clientId}"`);
      throw new Error('El clientId provisto para la nota no es válido');
    }
    const response = await requestWithRetry(() =>
        apiClient.post(`${CRM_API_URL}/interactions`, {
            clientId, type, content
        })
    );
    return response.data;
}

/**
 * Tool: Save prescription data (OCR)
 */
async function savePrescription({ clientId, ...prescriptionData }) {
    try {
        const response = await requestWithRetry(() =>
            apiClient.post(`${CRM_API_URL}/prescriptions`, {
                clientId, ...prescriptionData
            })
        );
        return response.data;
    } catch (e) {
        console.error('Error en savePrescription:', e.message);
        throw new Error('No se pudo guardar la receta en la base de datos.');
    }
}

/**
 * Tool: Log bot message in CRM
 */
async function logBotMessage({ waId, content }) {
    await requestWithRetry(() =>
        apiClient.post(`${CRM_API_URL}/messages`, {
            waId, content, direction: 'OUTBOUND'
        })
    );
    return { success: true };
}

/**
 * Tool: Create a formal quote
 */
async function createQuote({ clientId, items, total, discountCash }) {
    const response = await requestWithRetry(() =>
        apiClient.post(`${CRM_API_URL}/orders`, {
            clientId, items, total, discountCash
        })
    );
    return response.data;
}

/**
 * Tool: Cancel the bot and tag the conversation
 */
async function cancelBot({ clientId, waId }) {
    try {
        // If no waId provided, try to find it from clientId
        if (!waId && clientId && clientId !== 'none') {
            const chatFromClient = await prisma.whatsAppChat.findFirst({ where: { clientId } });
            if (chatFromClient) waId = chatFromClient.waId;
        }

        const tag = await prisma.tag.upsert({
            where: { name: 'Cancelar Bot' },
            update: {},
            create: { name: 'Cancelar Bot', color: '#ff4d4f' }
        });

        if (clientId && clientId !== 'none') {
            try {
                const clientExists = await prisma.client.findUnique({ where: { id: clientId } });
                if (clientExists) {
                    await prisma.client.update({
                        where: { id: clientId },
                        data: {
                            tags: {
                                connect: { id: tag.id }
                            }
                        }
                    });
                } else {
                    console.log(`[cancelBot] Client ID ${clientId} not found in database. Skipping client tag update.`);
                }
            } catch (err) {
                console.error('[cancelBot] Error updating client tags:', err.message);
            }
        }

        if (waId) {
            const chat = await prisma.whatsAppChat.findUnique({ where: { waId } });
            if (chat) {
                const updatedLabels = new Set(chat.chatLabels || []);
                updatedLabels.add('Cancelar Bot');

                await prisma.whatsAppChat.update({
                    where: { waId },
                    data: { 
                        botEnabled: false, 
                        status: 'OPEN', 
                        unreadCount: { increment: 1 },
                        chatLabels: Array.from(updatedLabels)
                    }
                });

                // Generar resumen de handoff
                generateAndSaveHandoffSummary(chat.id).catch(e => console.error("Error en resumen cancelBot:", e.message));

                return { success: true, message: 'BOT_CANCELED' };
            }
        }

        return { success: false, message: '[INSTRUCCIÓN INTERNA] No se pudo desactivar el bot. Continuá la conversación normalmente.' };
    } catch (e) {
        console.error('Error en cancelBot:', e.message);
        throw new Error('No se pudo desactivar el bot en la base de datos.');
    }
}

/**
 * Tool: Add a tag dynamically to a client
 */
async function addTagToClient({ clientId, tagName }) {
    if (!clientId || clientId === 'none') {
        return { success: false, message: '[INSTRUCCIÓN INTERNA] No se pudo agregar la etiqueta porque falta el clientId.' };
    }

    // ── Saneo del nombre (12/8/2026) ─────────────────────────────────────────
    // Este upsert era la fábrica de las 397 etiquetas: la IA mandaba cualquier
    // texto y acá se creaba tal cual — incluidas ORACIONES enteras ("Interesado
    // en armazones finitos para cara pequeña, quiere probarse, solicitó…").
    // 1. Se normaliza el espaciado.
    // 2. Un texto largo no es una etiqueta, es un resumen: se rechaza (el
    //    extractor ya guarda ese contenido en el summary del chat).
    // 3. Si ya existe una etiqueta igual ignorando mayúsculas, SE REUSA en vez
    //    de crear la variante ("Clipones" vs "clipones").
    tagName = String(tagName || '').replace(/\s+/g, ' ').trim();
    if (!tagName) {
        return { success: false, message: '[INSTRUCCIÓN INTERNA] Etiqueta vacía: no se creó nada.' };
    }
    if (tagName.length > 40) {
        return { success: false, message: '[INSTRUCCIÓN INTERNA] Ese texto es una descripción, no una etiqueta. No se creó. El detalle va en el resumen del chat.' };
    }

    try {
        const existente = await prisma.tag.findFirst({
            where: { name: { equals: tagName, mode: 'insensitive' } },
        });
        const tag = existente ?? await prisma.tag.upsert({
            where: { name: tagName },
            update: {},
            create: { name: tagName, color: '#1677ff' } // azul por defecto
        });

        const clientExists = await prisma.client.findUnique({ where: { id: clientId } });
        if (!clientExists) {
            console.log(`[addTagToClient] Client ID ${clientId} not found in database. Skipping.`);
            return { success: false, message: `El cliente con ID ${clientId} no existe en el sistema.` };
        }

        const client = await prisma.client.update({
            where: { id: clientId },
            data: {
                tags: {
                    connect: { id: tag.id }
                }
            }
        });

        // 1. Bot Action Automation
        if (tag.botAction === 'TURN_OFF' || tag.botAction === 'TURN_ON') {
            await prisma.whatsAppChat.updateMany({
                where: { clientId: clientId },
                data: { botEnabled: tag.botAction === 'TURN_ON' }
            });
            console.log(`[Etiqueta Automation] Bot ${tag.botAction === 'TURN_ON' ? 'activado' : 'pausado'} para cliente ${client.name}`);
        }

        // 1.5. Visual Automation (Push to WhatsAppChat chatLabels)
        try {
            const chatsToLabel = await prisma.whatsAppChat.findMany({ where: { clientId: clientId } });
            for (const c of chatsToLabel) {
                const labels = new Set(c.chatLabels || []);
                labels.add(tag.name);
                await prisma.whatsAppChat.update({
                    where: { id: c.id },
                    data: { chatLabels: Array.from(labels) }
                });
                
                if (global.io) {
                    global.io.emit('chat_updated', { chatId: c.id });
                }
            }
        } catch (labelErr) {
            console.error("[Etiqueta Automation] Error push chatLabel:", labelErr.message);
        }

        // 2. Notification Automation — por EMAIL. Hasta el 18/8/2026 esto
        // mandaba un WhatsApp "NOTIFICACIÓN DEL CRM" desde el número del bot al
        // teléfono cargado en la etiqueta: tráfico automático evidente, y la
        // cuenta de Meta está bajo observación. `notifyPhone` queda solo como
        // señal de "esta etiqueta avisa"; el aviso llega al mail de la administración.
        if (tag.notifyPhone) {
            const { notifyAdminDown } = require('./whatsapp/client');
            const crmBase = (CRM_API_URL || '').replace('/api/bot', '');
            await notifyAdminDown(
                `Etiqueta "${tag.name}" aplicada a ${client.name || 'Sin nombre'}`,
                `Se aplicó la etiqueta "${tag.name}" al cliente ${client.name || 'Sin nombre'}.\nFicha: ${crmBase}/admin/contactos?id=${client.id}`
            );
        }

        return { success: true, message: `Etiqueta '${tagName}' agregada correctamente al cliente.` };
    } catch (e) {
        console.error('Error en addTagToClient:', e.message);
        throw new Error('Error al agregar etiqueta al cliente en la base de datos.');
    }
}

/**
 * Tool: Disable Bot explicitly for a Chat
 */
async function disableBotForChat({ chatId, reason }) {
    if (!chatId || chatId === 'none') {
        return { success: false, message: '[INSTRUCCIÓN INTERNA] No se pudo desactivar el bot porque falta el chatId.' };
    }
    
    const clientTagName = 'Cancelar Bot';
    const labelName = reason || 'Cancelar Bot';
    
    try {
        const chat = await prisma.whatsAppChat.findUnique({ where: { id: chatId } });
        if (!chat) {
            return { success: false, message: '[INSTRUCCIÓN INTERNA] No se encontró el chat para desactivar el bot.' };
        }

        const tag = await prisma.tag.upsert({
            where: { name: clientTagName },
            update: {},
            create: { name: clientTagName, color: '#ff4d4f' }
        });

        if (chat.clientId) {
            await prisma.client.update({
                where: { id: chat.clientId },
                data: {
                    tags: {
                        connect: { id: tag.id }
                    }
                }
            });
        }

        const updatedLabels = new Set(chat.chatLabels || []);
        updatedLabels.add(labelName);

        await prisma.whatsAppChat.update({
            where: { id: chatId },
            data: { 
                botEnabled: false, 
                status: 'OPEN',
                unreadCount: { increment: 1 },
                chatLabels: Array.from(updatedLabels)
            }
        });

        // Generar resumen de handoff
        generateAndSaveHandoffSummary(chatId).catch(e => console.error("Error en resumen disableBotForChat:", e.message));

        return { success: true, message: `Bot apagado y etiquetado como '${clientTagName}' para el chat.` };
    } catch (e) {
        console.error('Error en disableBotForChatById:', e.message);
        throw new Error('No se pudo desactivar el bot en la base de datos.');
    }
}

/**
 * Tool: Report a complaint via email
 */
async function reportComplaint({ clientId, details }) {
    if (!clientId) return { success: false, message: '[INSTRUCCIÓN INTERNA] Falta el clientId para reportar el reclamo.' };
    if (!details) return { success: false, message: '[INSTRUCCIÓN INTERNA] Falta el detalle del reclamo.' };
    
    try {
        const complaintsUrl = CRM_API_URL.replace('/api/bot', '/api');
        await requestWithRetry(() =>
            apiClient.post(`${complaintsUrl}/complaints`, {
                clientId,
                details
            })
        );

        // Add the NOTE to the client's profile automatically
        await addInteraction({
            clientId,
            type: 'NOTE',
            content: `[RECLAMO POST-VENTA] ${details}`
        });

        // 18/8/2026: la administración se entera del reclamo por el email que
        // ya manda /api/complaints del CRM. Se apagó el WhatsApp del bot al
        // admin ("NUEVO RECLAMO POST-VENTA"): tráfico automático innecesario
        // con la cuenta de Meta bajo observación.

        return { success: true, message: `Reclamo reportado exitosamente.` };
    } catch (e) {
        console.error('Error en reportComplaint:', e.message);
        throw new Error('No se pudo reportar el reclamo en la base de datos.');
    }
}

/**
 * Helper: Determina si una cadena parece ser una frase, saludo o nombre comercial en lugar de un nombre de persona real.
 */
function isPhrase(str) {
    if (!str) return false;
    const lower = str.toLowerCase().trim();
    
    // 1. Palabras clave de saludos, preguntas, o términos comerciales
    const conversationalKeywords = [
        'hola', 'buen', 'buenos', 'buenas', 'dias', 'días', 'tardes', 'noches',
        'como', 'cómo', 'va', 'estas', 'estás', 'info', 'informacion', 'información',
        'consulta', 'consultas', 'presupuesto', 'presupuestos', 'receta', 'recetas',
        'turno', 'turnos', 'precio', 'precios', 'cuanto', 'cuánto', 'sale', 'cuesta',
        'quiero', 'necesito', 'busco', 'comprar', 'vender', 'local', 'optica', 'óptica',
        'atelier', 'gracias', 'chau', 'saludos', 'contacto', 'mensaje', 'mensajes',
        'venta', 'ventas', 'insumo', 'insumos', 'repuesto', 'repuestos', 'servicio', 
        'servicios', 'distribuidora', 'comercial', 'oficina', 'administracion', 
        'administración', 'soporte', 'taller', 'fabrica', 'fábrica', 'tienda', 
        'negocio', 'empresa', 'asesor', 'asesora', 'atencion', 'atención', 'cliente', 
        'clientes'
    ];
    
    // 2. Conectores, verbos, pronombres o artículos típicos de oraciones
    const sentenceIndicators = [
        'en', 'y', 'con', 'para', 'por', 'que', 'qué', 'un', 'una', 'uno', 'unas', 'unos',
        'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'nuestro', 'nuestra', 'este', 'esta', 'esto',
        'aqui', 'aquí', 'alli', 'allí', 'aca', 'acá', 'ya', 'es', 'son', 'ser', 'estar',
        'tiene', 'tienen', 'hay', 'me', 'te', 'se', 'nos', 'les'
    ];
    
    const words = lower.split(/\s+/);
    
    for (const word of words) {
        const cleanWord = word.replace(/[^a-z0-9áéíóúñü]/g, '');
        if (conversationalKeywords.includes(cleanWord) || sentenceIndicators.includes(cleanWord)) {
            return true;
        }
    }
    
    // 3. Si tiene 5 o más palabras, muy probablemente sea una frase o razón social larga
    if (words.length >= 5) {
        return true;
    }
    
    return false;
}

/**
 * Genera un resumen ejecutivo de 2 líneas de la conversación y lo guarda como nota en el CRM.
 */
async function generateAndSaveHandoffSummary(chatId) {
    try {
        const chat = await prisma.whatsAppChat.findUnique({
            where: { id: chatId },
            include: { client: true }
        });
        if (!chat || !chat.clientId) {
            console.log(`  [Summary Skip] Chat no encontrado o no tiene clientId vinculado: ${chatId}`);
            return;
        }

        // Recuperar los últimos 15 mensajes del chat para tener el contexto
        const messages = await prisma.whatsAppMessage.findMany({
            where: { chatId },
            orderBy: { createdAt: 'desc' },
            take: 15
        });

        if (messages.length === 0) return;

        // Evitar duplicación si ya hay un resumen creado recientemente (últimos 5 minutos)
        const lastSummary = await prisma.interaction.findFirst({
            where: {
                clientId: chat.clientId,
                type: 'NOTE',
                content: { startsWith: '📍 [RESUMEN AUTOMÁTICO]' },
                createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
            }
        });
        if (lastSummary) {
            console.log(`  [Summary Skip] Ya se generó un resumen de handoff recientemente para el cliente ID ${chat.clientId}`);
            return;
        }

        // Formatear el historial para pasárselo al modelo
        const formattedHistory = messages.reverse().map(m => {
            const sender = m.direction === 'INBOUND' ? 'Cliente' : 'Vendedor';
            return `${sender}: ${m.content}`;
        }).join('\n');

        const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
        const model = new ChatGoogleGenerativeAI({
            model: 'gemini-2.5-flash',
            temperature: 0,
            apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY
        });

        const prompt = `A continuación tenés los últimos mensajes de un chat de WhatsApp con un cliente de Atelier Óptica. Generá un resumen ejecutivo de exactamente 2 líneas para el vendedor que va a tomar el caso. El resumen debe incluir lo que busca el cliente (ej: tipo de anteojo o cristal), si envió receta, su obra social/prepaga (si la mencionó), y cualquier preferencia relevante. NO inventes datos. Sé conciso y directo.\n\nHistorial:\n${formattedHistory}`;
        
        const response = await withTimeout(
            model.invoke(prompt),
            30000,
            'Gemini handoff summary timeout'
        );
        const summaryText = contenidoATexto(response.content).trim();

        if (summaryText) {
            await prisma.interaction.create({
                data: {
                    clientId: chat.clientId,
                    type: 'NOTE',
                    content: `📍 [RESUMEN AUTOMÁTICO] ${summaryText}`
                }
            });
            console.log(`  📍 Resumen de traspaso generado y guardado para el cliente: ${chat.client.name}`);
        }
    } catch (e) {
        console.error('Error generando resumen de traspaso:', e.message);
    }
}

/**
 * Tool: Update Chat Summary (Milestones)
 */
async function updateChatSummary({ chatId, summaryText }) {
    if (!chatId || !summaryText) return { success: false, error: 'chatId y summaryText son obligatorios' };
    try {
        await prisma.whatsAppChat.update({
            where: { id: chatId },
            data: { chatSummary: summaryText }
        });
        
        // Notificar al front-end para que actualice la UI
        if (global.io) {
            global.io.emit('chat_summary_updated', { chatId, summary: summaryText });
        }
        
        return { success: true, message: 'Resumen e hitos del chat actualizados correctamente.' };
    } catch (e) {
        console.error('Error actualizando chat summary:', e.message);
        return { success: false, error: 'No se pudo actualizar el resumen del chat.' };
    }
}

/**
 * Envía alerta urgente de solicitud de factura por WA y Mail
 */
async function reportInvoiceRequest({ clientId }) {
    if (!clientId || clientId === 'none') return { success: false, error: 'Falta clientId' };
    
    try {
        const client = await prisma.client.findUnique({ where: { id: clientId } });
        if (!client) return { success: false, error: 'Cliente no encontrado' };



        const baseUrl = process.env.CRM_API_URL ? process.env.CRM_API_URL.replace('/api/bot', '') : 'http://localhost:3000';
        const crmLink = `${baseUrl}/admin/contactos?id=${client.id}`;

        // 1. (18/8/2026) El WhatsApp del bot a la administración se apagó: la
        // alerta va solo por email. Menos tráfico automático desde el número
        // mientras la cuenta de Meta está bajo observación.

        // 2. Email a Administración
        const emailDest = 'pisano.ishtar@gmail.com';
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            await transporter.sendMail({
                from: `"Sistema Atelier" <${process.env.EMAIL_USER}>`,
                to: emailDest,
                subject: `URGENCIA: Solicitud de Factura - ${client.name || 'Desconocido'}`,
                text: `El cliente ${client.name || 'Desconocido'} (Tel: ${client.phone}) acaba de solicitar su factura o ticket fiscal.\n\nFicha en CRM: ${crmLink}`
            }).catch(e => console.error("Error enviando email de factura:", e.message));
        } else {
            console.warn("⚠️ Advertencia: No se pudo enviar el email de factura porque faltan las credenciales EMAIL_USER y EMAIL_PASS en el entorno (.env).");
        }

        // 3. Registrar Nota en CRM
        await prisma.interaction.create({
            data: {
                clientId: client.id,
                type: 'NOTE',
                content: `🚨 [SISTEMA] El cliente solicitó Factura. Alerta de urgencia enviada a Administración.`
            }
        });

        // 4. Agregar Etiqueta
        await addTagToClient({ clientId: client.id, tagName: 'Factura' }).catch(e => {});

        return { success: true, message: '[INSTRUCCIÓN INTERNA] Notificación enviada con éxito. Dile al cliente que ya derivaste su pedido al área contable y se la enviarán a la brevedad.' };

    } catch (e) {
        console.error('Error reportInvoiceRequest:', e.message);
        return { success: false, error: 'Error interno al reportar factura' };
    }
}

module.exports = {
    checkExistingClient, convertIntoLead, updateClientData,
    getPriceList, getOrderStatus, createTask,
    addInteraction, savePrescription, logBotMessage, createQuote,
    cancelBot, addTagToClient, disableBotForChat, reportComplaint,
    isPhrase, generateAndSaveHandoffSummary, updateChatSummary, reportInvoiceRequest
};
