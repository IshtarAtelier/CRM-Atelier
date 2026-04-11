/**
 * WhatsApp Server para CRM Atelier
 * Se conecta a WhatsApp Web via QR y expone API REST para el CRM.
 * 
 * Uso: node whatsapp-server.js
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const aiAgent = require('./ai-agent');
const { generateCatalog } = require('./catalog-generator');

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

// ── Estado global ──────────────────────────────
let qrCode = null;
let isReady = false;
let connectedPhone = null;

// ── Prompt del agente (en memoria, se puede guardar en DB en el futuro) ──
let agentPrompt = `Sos *Sol*, la asistente virtual de **Atelier Óptica**, la óptica mejor calificada de Córdoba (⭐ 5/5 en Google Business).

══ DATOS DEL NEGOCIO ══
• Dirección: José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba
• Horarios: Lunes a Viernes 9:00 a 18:00 | Sábados 9:00 a 13:00 | Domingos cerrado
• Teléfono: (a completar)
• Instagram: @atelieroptica

══ TU PERSONALIDAD ══
- Tono: cálido, profesional, cercano — como una amiga que sabe mucho de lentes
- Usá emojis con moderación para dar calidez (👓 🌟 ✨ 😊) pero no exageres
- Tuteá o voseá según hable el cliente
- Respondé siempre en español argentino
- Mensajes cortos: máximo 3-4 párrafos por respuesta, ideal 2
- Si es la primera vez que escribe, saludá con su nombre y preguntá en qué podés ayudarlo

══ QUÉ PODÉS HACER ══
1. **Cotizar lentes y armazones** usando los precios del catálogo inyectado abajo
2. **Informar sobre tipos de cristales** (monofocales, multifocales, bifocales, etc.) y sus diferencias
3. **Agendar visitas** al local para mediciones y asesoramiento personalizado
4. **Consultar sobre pedidos existentes** si el cliente ya es contacto del sistema
5. **Responder dudas generales** sobre garantías, tiempos de entrega, obras sociales

══ REGLAS DE COTIZACIÓN ══
- Usá SIEMPRE los precios del catálogo. Nunca inventes precios.
- Al cotizar, mencioná precio de contado Y cuotas (6 cuotas sin interés con 25% de recargo financiero)
- Si preguntan por obra social, decí que la aceptamos y que deben traer la orden/autorización
- El descuento por obra social varía según cobertura; invitá al cliente a consultarlo en el local
- Si la graduación es alta o especial, aclará que el precio puede variar y ofrecé presupuesto personalizado en el local
- Para armazones, podés dar el rango de precios por marca
- El presupuesto completo (armazón + cristales) siempre es personalizado

══ TIEMPOS DE ENTREGA ══
- Cristales de stock: 24-48 hs hábiles
- Cristales de laboratorio (graduaciones especiales): 7 a 10 días hábiles
- Multifocales: 7 a 10 días hábiles

══ RECOLECCIÓN DE DATOS ══
Cuando el cliente muestre interés real, pedí naturalmente (sin ser invasivo):
- Nombre completo (si no lo tenés)
- Si tiene receta y de qué fecha es
- Si usa obra social (cuál)
- Qué tipo de lentes busca

══ CUÁNDO DERIVAR A UN HUMANO ══
Derivá diciendo "Te paso con uno de nuestros asesores para que te ayude mejor 😊" cuando:
- El cliente pide explícitamente hablar con una persona
- Hay un reclamo o problema con un pedido
- La consulta es muy técnica o requiere ver la receta
- El cliente quiere confirmar una compra (el cierre lo hace el vendedor)
- Preguntan por turnos con el oftalmólogo

══ LO QUE NO PODÉS HACER ══
- NO cierres ventas ni confirmes pedidos — eso lo hace el vendedor humano
- NO inventes información que no tengas en el catálogo
- NO des diagnósticos visuales
- NO prometas descuentos específicos por obra social
- NO mandes links ni archivos`;

let agentEnabled = false;
let openaiApiKey = process.env.OPENAI_API_KEY || '';
let openaiModel = 'gpt-4o-mini';

// Configurar agente IA si hay API key
if (openaiApiKey) {
    aiAgent.configure({ apiKey: openaiApiKey, model: openaiModel });
    console.log('🤖 Agente IA configurado con OpenAI');
}

// Contador de mensajes por chat para generar resúmenes periódicos
const chatMessageCount = {};

// ── Cliente WhatsApp ───────────────────────────
const waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

waClient.on('qr', (qr) => {
    qrCode = qr;
    isReady = false;
    console.log('\n📱 Escaneá este QR desde WhatsApp:');
    qrcode.generate(qr, { small: true });
});

waClient.on('ready', () => {
    isReady = true;
    qrCode = null;
    connectedPhone = waClient.info?.wid?.user || 'desconocido';
    console.log(`\n✅ WhatsApp conectado! Número: ${connectedPhone}`);
});

waClient.on('authenticated', () => {
    console.log('🔐 Sesión autenticada');
});

waClient.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación:', msg);
    isReady = false;
});

waClient.on('disconnected', (reason) => {
    console.log('🔌 Desconectado:', reason);
    isReady = false;
    qrCode = null;
});

// ── Recepción de mensajes ──────────────────────
waClient.on('message', async (msg) => {
    // Ignorar mensajes de grupos y de estado
    if (msg.from.includes('@g.us') || msg.from === 'status@broadcast') return;
    // Ignorar mensajes propios
    if (msg.fromMe) return;

    const waId = msg.from; // ej: "5491112345678@c.us"
    const contact = await msg.getContact();
    const profileName = contact.pushname || contact.name || msg.from.replace('@c.us', '');
    const body = msg.body || '';

    console.log(`📩 Mensaje de ${profileName} (${waId}): ${body.substring(0, 50)}`);

    try {
        // 1. Buscar o crear chat
        let chat = await prisma.whatsAppChat.findUnique({ where: { waId } });

        if (!chat) {
            // Crear contacto nuevo en el CRM
            const phoneNumber = waId.replace('@c.us', '');
            const client = await prisma.client.create({
                data: {
                    name: profileName,
                    phone: phoneNumber,
                    status: 'CONTACT',
                    contactSource: 'WhatsApp',
                    interest: '',
                }
            });

            // Crear chat
            chat = await prisma.whatsAppChat.create({
                data: {
                    waId,
                    profileName,
                    clientId: client.id,
                    status: 'OPEN',
                    lastMessageAt: new Date(),
                    unreadCount: 1,
                }
            });

            // Registrar interacción
            await prisma.interaction.create({
                data: {
                    clientId: client.id,
                    type: 'WHATSAPP',
                    content: `Nuevo contacto desde WhatsApp: "${body.substring(0, 100)}"`,
                }
            });

            console.log(`  ✨ Nuevo contacto creado: ${profileName}`);
        } else {
            // Actualizar chat existente
            await prisma.whatsAppChat.update({
                where: { id: chat.id },
                data: {
                    lastMessageAt: new Date(),
                    unreadCount: { increment: 1 },
                    status: 'OPEN',
                    profileName,
                }
            });
        }

        // 2. Guardar mensaje
        await prisma.whatsAppMessage.create({
            data: {
                chatId: chat.id,
                direction: 'INBOUND',
                type: 'TEXT',
                content: body,
                waMessageId: msg.id._serialized,
            }
        });

        // 3. Agente IA
        if (agentEnabled && aiAgent.isConfigured()) {
            try {
                console.log(`  🤖 Agente IA procesando...`);

                const { reply, metadata } = await aiAgent.generateResponse(
                    chat.id,
                    chat.clientId,
                    profileName,
                    body,
                    agentPrompt
                );

                if (reply) {
                    // Enviar respuesta por WhatsApp
                    const sent = await waClient.sendMessage(waId, reply);

                    // Guardar en DB
                    await prisma.whatsAppMessage.create({
                        data: {
                            chatId: chat.id,
                            direction: 'OUTBOUND',
                            type: 'TEXT',
                            content: reply,
                            waMessageId: sent.id._serialized,
                            status: 'SENT',
                        }
                    });

                    await prisma.whatsAppChat.update({
                        where: { id: chat.id },
                        data: { lastMessageAt: new Date() },
                    });

                    console.log(`  ✅ Respuesta enviada: ${reply.substring(0, 60)}...`);
                }

                // Actualizar contacto con metadata detectada
                if (metadata && chat.clientId) {
                    await aiAgent.updateContactFromMetadata(chat.clientId, metadata);

                    // Guardar resumen cada 10 mensajes
                    if (!chatMessageCount[chat.id]) chatMessageCount[chat.id] = 0;
                    chatMessageCount[chat.id]++;

                    if (chatMessageCount[chat.id] % 10 === 0 || metadata.conversationSummary) {
                        const summary = metadata.conversationSummary || await aiAgent.generateSummary(chat.id);
                        if (summary) {
                            await aiAgent.saveConversationSummary(chat.clientId, summary);
                            console.log(`  📋 Resumen guardado`);
                        }
                    }

                    // Si pidió hablar con humano, desactivar agente para este chat
                    if (metadata.shouldNotify) {
                        console.log(`  👤 Cliente pidió atención humana`);
                    }
                }

            } catch (agentError) {
                console.error('  ❌ Error del agente IA:', agentError.message);
            }
        }

    } catch (error) {
        console.error('Error procesando mensaje:', error);
    }
});

// ══════════════════════════════════════════════════
// API REST
// ══════════════════════════════════════════════════

// Estado de conexión
app.get('/api/status', (req, res) => {
    res.json({
        connected: isReady,
        phone: connectedPhone,
        qr: qrCode,
        agentEnabled,
    });
});

// Obtener QR como texto (para el frontend)
app.get('/api/qr', (req, res) => {
    res.json({ qr: qrCode, connected: isReady });
});

// Listar chats
app.get('/api/chats', async (req, res) => {
    try {
        const chats = await prisma.whatsAppChat.findMany({
            include: {
                client: { select: { id: true, name: true, phone: true, status: true } },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                }
            },
            orderBy: { lastMessageAt: 'desc' },
        });
        res.json(chats);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener chats' });
    }
});

// Obtener mensajes de un chat
app.get('/api/chats/:id/messages', async (req, res) => {
    try {
        const messages = await prisma.whatsAppMessage.findMany({
            where: { chatId: req.params.id },
            orderBy: { createdAt: 'asc' },
        });

        // Marcar como leído
        await prisma.whatsAppChat.update({
            where: { id: req.params.id },
            data: { unreadCount: 0 },
        });

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener mensajes' });
    }
});

// Enviar mensaje
app.post('/api/send', async (req, res) => {
    const { chatId, message } = req.body;
    if (!chatId || !message) {
        return res.status(400).json({ error: 'chatId y message son requeridos' });
    }

    try {
        const chat = await prisma.whatsAppChat.findUnique({ where: { id: chatId } });
        if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });

        if (!isReady) return res.status(503).json({ error: 'WhatsApp no conectado' });

        // Enviar por WhatsApp
        const sent = await waClient.sendMessage(chat.waId, message);

        // Guardar en DB
        const dbMsg = await prisma.whatsAppMessage.create({
            data: {
                chatId,
                direction: 'OUTBOUND',
                type: 'TEXT',
                content: message,
                waMessageId: sent.id._serialized,
                status: 'SENT',
            }
        });

        // Actualizar chat
        await prisma.whatsAppChat.update({
            where: { id: chatId },
            data: { lastMessageAt: new Date() },
        });

        res.json(dbMsg);
    } catch (error) {
        console.error('Error enviando mensaje:', error);
        res.status(500).json({ error: 'Error al enviar mensaje' });
    }
});

// Notificar cambio de estado de pedido
app.post('/api/notify-order', async (req, res) => {
    const { orderId, clientPhone, clientName, status, orderNumber } = req.body;

    if (!clientPhone || !status) {
        return res.status(400).json({ error: 'clientPhone y status son requeridos' });
    }

    if (!isReady) return res.status(503).json({ error: 'WhatsApp no conectado' });

    const statusMessages = {
        'SENT': `Hola ${clientName} 👋, te informamos que tu pedido #${orderNumber} fue enviado al laboratorio. Te avisaremos cuando esté listo. 📦`,
        'IN_PROGRESS': `Hola ${clientName} 👋, tu pedido #${orderNumber} está siendo procesado en el laboratorio. 🔬`,
        'READY': `Hola ${clientName} 🎉, ¡tu pedido #${orderNumber} está listo para retirar! Te esperamos en Atelier Óptica. 👓`,
        'DELIVERED': `Hola ${clientName} 😊, gracias por confiar en Atelier Óptica. ¡Esperamos que disfrutes tus lentes! 🌟`,
    };

    const message = statusMessages[status] || `Hola ${clientName}, tu pedido #${orderNumber} cambió a estado: ${status}`;

    try {
        const waId = clientPhone.includes('@c.us') ? clientPhone : `${clientPhone}@c.us`;
        const sent = await waClient.sendMessage(waId, message);

        // Buscar/crear chat para guardar el mensaje
        let chat = await prisma.whatsAppChat.findUnique({ where: { waId } });
        if (chat) {
            await prisma.whatsAppMessage.create({
                data: {
                    chatId: chat.id,
                    direction: 'OUTBOUND',
                    type: 'TEXT',
                    content: message,
                    waMessageId: sent.id._serialized,
                    status: 'SENT',
                }
            });
            await prisma.whatsAppChat.update({
                where: { id: chat.id },
                data: { lastMessageAt: new Date() },
            });
        }

        res.json({ success: true, message: 'Notificación enviada' });
    } catch (error) {
        console.error('Error enviando notificación:', error);
        res.status(500).json({ error: 'Error al enviar notificación' });
    }
});

// Cerrar chat
app.patch('/api/chats/:id', async (req, res) => {
    try {
        const chat = await prisma.whatsAppChat.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json(chat);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar chat' });
    }
});

// ── Prompt del agente ──────────────────────────
app.get('/api/agent', (req, res) => {
    res.json({
        prompt: agentPrompt,
        enabled: agentEnabled,
        apiKey: openaiApiKey ? '••••' + openaiApiKey.slice(-4) : '',
        model: openaiModel,
        configured: aiAgent.isConfigured(),
    });
});

app.post('/api/agent', (req, res) => {
    const { prompt, enabled, apiKey, model } = req.body;
    if (prompt !== undefined) agentPrompt = prompt;
    if (enabled !== undefined) agentEnabled = enabled;
    if (apiKey !== undefined) {
        openaiApiKey = apiKey;
        aiAgent.configure({ apiKey });
        console.log(`🔑 API Key ${apiKey ? 'configurada' : 'eliminada'}`);
    }
    if (model !== undefined) {
        openaiModel = model;
        aiAgent.configure({ model });
        console.log(`🧠 Modelo: ${model}`);
    }
    res.json({
        prompt: agentPrompt,
        enabled: agentEnabled,
        apiKey: openaiApiKey ? '••••' + openaiApiKey.slice(-4) : '',
        model: openaiModel,
        configured: aiAgent.isConfigured(),
    });
    console.log(`🤖 Agente ${agentEnabled ? 'ACTIVADO' : 'DESACTIVADO'}`);
});

// ── Catálogo de precios dinámico ───────────────
app.get('/api/agent/catalog', async (req, res) => {
    try {
        const catalog = await generateCatalog();
        res.type('text/plain').send(catalog);
    } catch (error) {
        res.status(500).json({ error: 'Error generando catálogo' });
    }
});

// Desconectar WhatsApp
app.post('/api/disconnect', async (req, res) => {
    try {
        await waClient.logout();
        isReady = false;
        qrCode = null;
        connectedPhone = null;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al desconectar' });
    }
});

// ── Iniciar servidor ───────────────────────────
const PORT = 3100;
app.listen(PORT, () => {
    console.log(`\n🚀 WhatsApp Server corriendo en http://localhost:${PORT}`);
    console.log('📡 Iniciando conexión con WhatsApp...\n');
    waClient.initialize();
});
