/**
 * Agente IA para WhatsApp – Atelier Óptica
 * Usa OpenAI (gpt-4o-mini) para responder automáticamente.
 * 
 * Funcionalidades:
 * - Responde siguiendo el prompt de comportamiento
 * - Inyecta catálogo de precios desde la DB
 * - Detecta interés, obra social y tags del cliente
 * - Genera resúmenes de conversación
 */

const OpenAI = require('openai');
const { PrismaClient } = require('./prisma/generated/client');
const { generateCatalog } = require('./catalog-generator');

const prisma = new PrismaClient();

// ── Configuración ─────────────────────────────
let openaiApiKey = process.env.OPENAI_API_KEY || '';
let openaiModel = 'gpt-4o-mini';
let openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

// Cache del catálogo (se regenera cada 30 min)
let catalogCache = '';
let catalogLastGenerated = 0;
const CATALOG_TTL = 30 * 60 * 1000; // 30 minutos

/**
 * Configura la API key y modelo de OpenAI
 */
function configure({ apiKey, model }) {
    if (apiKey !== undefined) {
        openaiApiKey = apiKey;
        openai = apiKey ? new OpenAI({ apiKey }) : null;
    }
    if (model !== undefined) {
        openaiModel = model;
    }
}

/**
 * Verifica si el agente está configurado correctamente
 */
function isConfigured() {
    return !!openai;
}

/**
 * Obtiene el catálogo de precios (con cache)
 */
async function getCatalog() {
    const now = Date.now();
    if (catalogCache && (now - catalogLastGenerated) < CATALOG_TTL) {
        return catalogCache;
    }
    catalogCache = await generateCatalog();
    catalogLastGenerated = now;
    return catalogCache;
}

/**
 * Obtiene el contexto del contacto desde la DB
 */
async function getContactContext(clientId) {
    if (!clientId) return 'No hay información del contacto aún.';

    try {
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            include: {
                prescriptions: { orderBy: { date: 'desc' }, take: 1 },
                tags: true,
                orders: {
                    where: { isDeleted: false },
                    orderBy: { createdAt: 'desc' },
                    take: 3,
                    include: { items: { include: { product: true } } },
                },
            },
        });

        if (!client) return 'Contacto no encontrado.';

        const lines = [];
        lines.push(`Nombre: ${client.name}`);
        if (client.phone) lines.push(`Teléfono: ${client.phone}`);
        if (client.insurance) lines.push(`Obra social: ${client.insurance}`);
        if (client.interest) lines.push(`Interés: ${client.interest}`);
        if (client.doctor) lines.push(`Médico: ${client.doctor}`);
        lines.push(`Estado: ${client.status === 'CLIENT' ? 'Cliente (ya compró)' : client.status === 'CONFIRMED' ? 'Confirmado' : 'Contacto nuevo'}`);

        if (client.tags.length > 0) {
            lines.push(`Tags: ${client.tags.map(t => t.name).join(', ')}`);
        }

        // Última receta
        const rx = client.prescriptions[0];
        if (rx) {
            const rxLines = [];
            if (rx.sphereOD != null) rxLines.push(`OD: ESF ${rx.sphereOD >= 0 ? '+' : ''}${rx.sphereOD}`);
            if (rx.cylinderOD != null) rxLines.push(`CIL ${rx.cylinderOD}`);
            if (rx.axisOD != null) rxLines.push(`Eje ${rx.axisOD}°`);
            if (rx.sphereOI != null) rxLines.push(`| OI: ESF ${rx.sphereOI >= 0 ? '+' : ''}${rx.sphereOI}`);
            if (rx.cylinderOI != null) rxLines.push(`CIL ${rx.cylinderOI}`);
            if (rx.axisOI != null) rxLines.push(`Eje ${rx.axisOI}°`);
            if (rx.addition) rxLines.push(`| ADD +${rx.addition}`);
            if (rxLines.length > 0) lines.push(`Última receta: ${rxLines.join(' ')}`);
        }

        // Pedidos recientes
        if (client.orders.length > 0) {
            const orderSummaries = client.orders.map(o => {
                const items = o.items.map(i => `${i.product?.brand || ''} ${i.product?.name || i.product?.model || ''}`).join(', ');
                return `  - ${o.orderType === 'SALE' ? 'Venta' : 'Presupuesto'} $${Math.round(o.total).toLocaleString('es-AR')}: ${items}`;
            });
            lines.push(`Pedidos recientes:\n${orderSummaries.join('\n')}`);
        }

        return lines.join('\n');
    } catch (error) {
        console.error('Error obteniendo contexto:', error);
        return 'Error al obtener datos del contacto.';
    }
}

/**
 * Carga el historial de mensajes del chat
 */
async function getChatHistory(chatId, limit = 20) {
    try {
        const messages = await prisma.whatsAppMessage.findMany({
            where: { chatId },
            orderBy: { createdAt: 'asc' },
            take: limit,
        });

        return messages.map(m => ({
            role: m.direction === 'INBOUND' ? 'user' : 'assistant',
            content: m.content,
        }));
    } catch (error) {
        console.error('Error cargando historial:', error);
        return [];
    }
}

/**
 * Determina la hora del día para el saludo
 */
function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 13) return 'mañana';
    if (hour >= 13 && hour < 20) return 'tarde';
    return 'noche';
}

/**
 * Genera una respuesta del agente IA
 * @param {string} chatId - ID del chat
 * @param {string} clientId - ID del contacto (puede ser null)
 * @param {string} profileName - Nombre del perfil de WhatsApp
 * @param {string} newMessage - Mensaje entrante del cliente
 * @param {string} agentPrompt - Prompt de comportamiento configurado
 * @returns {Promise<{reply: string, metadata: object}>}
 */
async function generateResponse(chatId, clientId, profileName, newMessage, agentPrompt) {
    if (!openai) {
        throw new Error('OpenAI no configurado. Agregá tu API Key en Configuración.');
    }

    // 1. Obtener catálogo de precios
    const catalog = await getCatalog();

    // 2. Obtener info del contacto
    const contactInfo = await getContactContext(clientId);

    // 3. Obtener historial
    const history = await getChatHistory(chatId);

    // 4. Construir system prompt
    const timeOfDay = getTimeOfDay();
    const systemPrompt = `${agentPrompt}

═══════════════════════════
HORA ACTUAL Y SALUDO
═══════════════════════════
Hora del día: ${timeOfDay}
Nombre del cliente: ${profileName}

═══════════════════════════
INFORMACIÓN DEL CONTACTO EN EL SISTEMA
═══════════════════════════
${contactInfo}

═══════════════════════════
CATÁLOGO DE PRECIOS ACTUALIZADO
═══════════════════════════
${catalog}

═══════════════════════════
INSTRUCCIÓN DE FORMATO DE RESPUESTA
═══════════════════════════
Respondé SOLO con el mensaje para el cliente. No agregues comentarios internos ni metadatos.
Después del mensaje, en una línea nueva separada por "---METADATA---", enviá un JSON con:
{
  "detectedInterest": "MONOFOCAL|MULTIFOCAL|BIFOCAL|SOL|LENTES_CONTACTO|null",
  "detectedInsurance": "nombre de la obra social o null",
  "tags": ["tag1", "tag2"],
  "shouldNotify": false,
  "conversationSummary": "breve resumen de la conversación hasta ahora (1-2 oraciones)"
}
Si no detectaste nada nuevo, enviá null en esos campos.
"shouldNotify" = true si el cliente pidió hablar con un humano, llamado, o desactivar el bot.`;

    // 5. Enviar a OpenAI
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: newMessage },
    ];

    try {
        const completion = await openai.chat.completions.create({
            model: openaiModel,
            messages,
            temperature: 0.7,
            max_tokens: 500,
        });

        const fullResponse = completion.choices[0]?.message?.content || '';

        // 6. Parsear respuesta y metadata
        const parts = fullResponse.split('---METADATA---');
        const reply = parts[0].trim();
        let metadata = {};

        if (parts[1]) {
            try {
                const jsonStr = parts[1].trim();
                metadata = JSON.parse(jsonStr);
            } catch (e) {
                console.warn('⚠️ No se pudo parsear metadata del agente:', e.message);
            }
        }

        return { reply, metadata };
    } catch (error) {
        console.error('❌ Error OpenAI:', error.message);

        // Errores comunes
        if (error.code === 'insufficient_quota') {
            throw new Error('Sin crédito en OpenAI. Revisá tu cuenta.');
        }
        if (error.code === 'invalid_api_key') {
            throw new Error('API Key de OpenAI inválida. Revisala en Configuración.');
        }

        throw error;
    }
}

/**
 * Genera un resumen de la conversación
 */
async function generateSummary(chatId) {
    if (!openai) return null;

    const history = await getChatHistory(chatId, 50);
    if (history.length < 3) return null;

    try {
        const completion = await openai.chat.completions.create({
            model: openaiModel,
            messages: [
                {
                    role: 'system',
                    content: `Sos un asistente que genera resúmenes breves de conversaciones de una óptica.
Generá un resumen en 2-3 oraciones que incluya:
- Qué buscaba el cliente
- Si se envió presupuesto
- Estado actual (interesado, dudoso, cerró compra, etc.)
- Datos relevantes (obra social, graduación, preferencias)
Respondé SOLO con el resumen, sin encabezados ni formato.`
                },
                ...history.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
                { role: 'user', content: 'Generá el resumen de esta conversación.' }
            ],
            temperature: 0.3,
            max_tokens: 200,
        });

        return completion.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
        console.error('Error generando resumen:', error.message);
        return null;
    }
}

/**
 * Actualiza el contacto con metadata detectada por el agente
 */
async function updateContactFromMetadata(clientId, metadata) {
    if (!clientId || !metadata) return;

    try {
        const updateData = {};

        // Actualizar interés si se detectó
        if (metadata.detectedInterest) {
            const interestMap = {
                'MONOFOCAL': 'Monofocal',
                'MULTIFOCAL': 'Multifocal',
                'BIFOCAL': 'Bifocal',
                'SOL': 'Sol',
                'LENTES_CONTACTO': 'Lentes de Contacto',
            };
            updateData.interest = interestMap[metadata.detectedInterest] || metadata.detectedInterest;
        }

        // Actualizar obra social si se detectó
        if (metadata.detectedInsurance) {
            updateData.insurance = metadata.detectedInsurance;
        }

        if (Object.keys(updateData).length > 0) {
            await prisma.client.update({
                where: { id: clientId },
                data: updateData,
            });
            console.log(`  📝 Contacto actualizado:`, updateData);
        }

        // Sincronizar tags
        if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.length > 0) {
            for (const tagName of metadata.tags) {
                // Buscar o crear tag
                let tag = await prisma.tag.findUnique({ where: { name: tagName } });
                if (!tag) {
                    tag = await prisma.tag.create({ data: { name: tagName } });
                }
                // Conectar al contacto (si no está ya)
                try {
                    await prisma.client.update({
                        where: { id: clientId },
                        data: { tags: { connect: { id: tag.id } } },
                    });
                } catch (e) {
                    // Ya conectado, ignorar
                }
            }
        }
    } catch (error) {
        console.error('Error actualizando contacto:', error);
    }
}

/**
 * Guarda un resumen de conversación en el historial del contacto
 */
async function saveConversationSummary(clientId, summary) {
    if (!clientId || !summary) return;

    try {
        await prisma.interaction.create({
            data: {
                clientId,
                type: 'WHATSAPP_SUMMARY',
                content: `🤖 Resumen IA: ${summary}`,
            },
        });
    } catch (error) {
        console.error('Error guardando resumen:', error);
    }
}

module.exports = {
    configure,
    isConfigured,
    generateResponse,
    generateSummary,
    updateContactFromMetadata,
    saveConversationSummary,
    getCatalog,
};
