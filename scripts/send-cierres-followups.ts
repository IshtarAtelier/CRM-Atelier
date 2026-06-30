import { PrismaClient } from '@prisma/client';
import { GoogleGenAI, Type } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY || '' });

const TAGS_SIN_BOT = [
  'cancelar bot', 
  'no bot', 
  'proveedor', 
  'no interesado', 
  'error', 
  'familiar', 
  'personal', 
  'spam', 
  'post-venta', 
  'postventa', 
  'ya es cliente', 
  'cerrado'
];

const messageSchema = {
  type: Type.OBJECT,
  properties: {
    message: {
      type: Type.STRING,
      description: "El mensaje de seguimiento generado listo para enviarse por WhatsApp."
    }
  },
  required: ["message"]
};

// ──────────────────────────────────────────────
// Reglas y validaciones de mensajes
// ──────────────────────────────────────────────
function sanitizeMessage(text: string): string {
  if (!text) return '';
  let clean = text.trim();
  clean = clean.replace(/[¿¡]/g, '');
  clean = clean.replace(/^["']+|["']+$/g, '');
  clean = clean.replace(/\*+/g, '');
  clean = clean.replace(/\s{2,}/g, ' ');
  return clean.trim();
}

function validateMessage(text: string, clientName: string): { valid: boolean; reason?: string } {
  if (!text) return { valid: false, reason: 'Mensaje vacío' };
  
  const trimmed = text.trim();
  
  if (trimmed.length < 20) {
    return { valid: false, reason: `Muy corto (${trimmed.length} chars)` };
  }
  
  if (trimmed.length > 250) {
    return { valid: false, reason: `Muy largo (${trimmed.length} chars)` };
  }
  
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 45) {
    return { valid: false, reason: `Demasiadas palabras (${wordCount})` };
  }
  
  if (/[¿¡]/.test(trimmed)) {
    return { valid: false, reason: 'Contiene signos ¿ o ¡' };
  }

  // Verificar que no repita el nombre de pila
  const firstName = clientName.split(/\s+/)[0];
  if (firstName.length >= 3) {
    const regex = new RegExp(firstName, 'gi');
    const matches = trimmed.match(regex);
    if (matches && matches.length > 1) {
      return { valid: false, reason: `Nombre repetido ${matches.length} veces` };
    }
  }

  const validEndings = /[.!?\)😊☕👓👋🙌✨💪🤗😄🫶🤙💐🌟🥰😉👀🏠🔬💎🕶️📋❤️🤝👍🙏😁💙🫠🤓✌️☀️🌞🧡💜]$/u;
  if (!validEndings.test(trimmed)) {
    return { valid: false, reason: `Terminación inválida (char: "${trimmed.slice(-1)}")` };
  }

  return { valid: true };
}

// ──────────────────────────────────────────────
// Elegibilidad
// ──────────────────────────────────────────────
async function checkEligibility(client: any, chat: any, quoteDate: Date | null) {
  const now = new Date();
  if (!chat) return { eligible: false, reason: 'Sin chat de WhatsApp' };

  const labels = chat.chatLabels || [];
  if (labels.includes('SIN_SEGUIMIENTO')) {
    return { eligible: false, reason: 'Etiqueta SIN_SEGUIMIENTO' };
  }

  const clientTags = client.tags || [];
  const tieneTagExclusion = clientTags.some((tag: any) =>
    TAGS_SIN_BOT.some(t => tag.name.toLowerCase().includes(t))
  );
  if (tieneTagExclusion) {
    return { eligible: false, reason: 'Tag de exclusión' };
  }

  const tieneLabelApagado = labels.some((label: string) =>
    label.includes('[SISTEMA - BOT APAGADO]') ||
    TAGS_SIN_BOT.some(t => label.toLowerCase().includes(t))
  );
  if (tieneLabelApagado) {
    return { eligible: false, reason: 'Etiqueta de exclusión' };
  }

  if (chat.lastFollowUpAt) {
    const hoursSinceLastFU = (now.getTime() - new Date(chat.lastFollowUpAt).getTime()) / 3600000;
    if (hoursSinceLastFU < 48) {
      return { eligible: false, reason: `Cooldown activo (${hoursSinceLastFU.toFixed(1)}hs)` };
    }
  }

  if (chat.lastMessageAt) {
    const hoursSinceLastMsg = (now.getTime() - new Date(chat.lastMessageAt).getTime()) / 3600000;
    if (hoursSinceLastMsg < 24) {
      return { eligible: false, reason: `Actividad reciente (${hoursSinceLastMsg.toFixed(1)}hs)` };
    }
  }

  if (quoteDate) {
    const completedOrders = await prisma.order.findFirst({
      where: {
        clientId: client.id,
        orderType: { in: ['SALE', 'ORDER'] },
        createdAt: { gt: quoteDate },
        isDeleted: false,
      },
    });
    if (completedOrders) return { eligible: false, reason: 'Compra posterior' };

    const completedPayments = await prisma.payment.findFirst({
      where: {
        order: { clientId: client.id },
        date: { gt: quoteDate },
      },
    });
    if (completedPayments) return { eligible: false, reason: 'Pago posterior' };
  }

  const inboundCount = await prisma.whatsAppMessage.count({
    where: {
      chatId: chat.id,
      direction: 'INBOUND',
    },
  });
  if (inboundCount === 0) {
    return { eligible: false, reason: 'Contacto frío (0 entrantes)' };
  }

  return { eligible: true };
}

// ──────────────────────────────────────────────
// Generador de Mensajes
// ──────────────────────────────────────────────
async function generateFollowUp(opp: any): Promise<string | null> {
  const clientName = opp.client.name.split(' ')[0] || 'hola';
  
  let context = '';
  if (opp.type === 'PENDING_QUOTE' && opp.quote) {
    const itemsList = opp.quote.items.map((i: any) => `- ${i.quantity}x ${i.productNameSnapshot || 'Producto'}`).join('\n');
    context = `
    Tipo de Seguimiento: Presupuesto Pendiente (hace ${opp.daysElapsed} días)
    Nombre del Cliente: ${clientName}
    Total: $${opp.quote.total.toLocaleString('es-AR')}
    Productos cotizados:
    ${itemsList}
    `;
  } else if (opp.type === 'STALLED_FAVORITE') {
    const favs = opp.client.interactions.map((i: any) => i.content).join('\n- ');
    context = `
    Tipo de Seguimiento: Cliente con Favoritos (Venta Estancada hace ${opp.daysElapsed} días)
    Nombre del Cliente: ${clientName}
    Productos Favoritos guardados:
    - ${favs}
    `;
  } else if (opp.type === 'ABANDONED_CART') {
    context = `
    Tipo de Seguimiento: Carrito Abandonado hace ${opp.daysElapsed} días
    Nombre del Cliente: ${clientName}
    Monto del Carrito: $${opp.amount?.toLocaleString('es-AR')}
    `;
  }

  const prompt = `
  Eres el mejor asesor de ventas de Atelier Óptica, una óptica moderna y premium.
  Tu objetivo es escribir un mensaje de seguimiento de WhatsApp corto y natural para intentar cerrar una venta pendiente.
  
  Aquí tienes la información de la oportunidad de venta:
  ${context}

  Reglas del mensaje:
  1. Tono y voseo: Cercano, muy amable, cálido, utilizando el voseo argentino (ej. "cómo estás", "querés", "contame"). Trata al cliente por su primer nombre (${clientName}). Usa emojis con sutileza (ej. 🤍, ✨, 👓, 😊).
  2. Muestra disposición: Pregúntale si tiene alguna duda con el presupuesto/los lentes que vieron, o si necesita ayuda para avanzar.
  3. Finalización: NO te despidas formalmente (evita decir "saludos", "que tengas un buen día" o "quedamos a disposición"). El mensaje debe finalizar con una pregunta abierta e invitar a la conversación.
  4. Extensión: Corto, directo y conversacional. No más de 35 palabras.
  `;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: messageSchema,
          temperature: 0.7,
        }
      });

      const jsonStr = response.text;
      if (!jsonStr) continue;

      const parsed = JSON.parse(jsonStr);
      let messageText = sanitizeMessage(parsed.message);

      const validation = validateMessage(messageText, opp.client.name);
      if (validation.valid) {
        return messageText;
      } else {
        console.warn(`    ⚠️ [Generación] Intento ${attempt} rechazado para ${opp.client.name}: ${validation.reason}`);
      }
    } catch (err: any) {
      console.error(`    ❌ [Generación] Error en intento ${attempt}:`, err.message);
    }
  }
  return null;
}

// ──────────────────────────────────────────────
// Envío a producción
// ──────────────────────────────────────────────
async function sendWhatsApp(phone: string, text: string): Promise<boolean> {
  const BOT_API_KEY = process.env.BOT_API_KEY || 'atelier-bot-secret-key-2026';
  const url = 'https://crm-atelier-production-ae72.up.railway.app/api/whatsapp/send';

  // Formatear el teléfono
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.length >= 10 ? '549' + cleanPhone.slice(-10) : cleanPhone;
  const chatId = `${formattedPhone}@c.us`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BOT_API_KEY
      },
      body: JSON.stringify({
        chatId: chatId,
        message: text
      })
    });

    if (res.ok) {
      const data = await res.json();
      return data.success !== false;
    } else {
      console.error(`    ❌ [WhatsApp Send API] HTTP Error: ${res.status}`);
      return false;
    }
  } catch (err: any) {
    console.error(`    ❌ [WhatsApp Send API] Error de conexión:`, err.message);
    return false;
  }
}

// ──────────────────────────────────────────────
// Flujo Principal
// ──────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  console.log(`\n======================================================`);
  console.log(isDryRun ? `🧪 MODO SIMULACIÓN (DRY-RUN) - No se realizarán envíos` : `🚀 MODO PRODUCCIÓN - ENVÍOS DE WhatsApp ACTIVER`);
  console.log(`======================================================\n`);

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const opportunities: any[] = [];

  // STALLED_FAVORITE
  const favoriteClients = await prisma.client.findMany({
    where: {
      isFavorite: true,
      status: { notIn: ['CLIENT', 'active'] },
      orders: {
        none: {
          OR: [
            { orderType: 'SALE' },
            { status: 'CONFIRMED', updatedAt: { gte: sevenDaysAgo } }
          ],
          isDeleted: false
        }
      }
    },
    include: {
      interactions: { orderBy: { createdAt: 'desc' }, take: 5 },
      orders: { orderBy: { createdAt: 'desc' }, take: 1 },
      tasks: { orderBy: { createdAt: 'desc' }, take: 1 },
      whatsappChats: { orderBy: { lastMessageAt: 'desc' }, take: 1 },
      prescriptions: { orderBy: { date: 'desc' }, take: 1 },
      tags: true,
    }
  });

  for (const client of favoriteClients) {
    const dates = [
      client.updatedAt,
      client.interactions[0]?.createdAt,
      client.orders[0]?.createdAt,
      client.tasks[0]?.createdAt,
      client.whatsappChats[0]?.lastMessageAt
    ].filter(Boolean) as Date[];

    const lastActivity = dates.length > 0
      ? new Date(Math.max(...dates.map(d => d.getTime())))
      : client.createdAt;

    if (lastActivity < threeDaysAgo && lastActivity > thirtyDaysAgo) {
      const latestRx = client.prescriptions[0];
      const latestOrder = client.orders[0];

      const isHighValue = 
        (latestOrder && latestOrder.total >= 250000) ||
        (latestRx && (
          Math.abs(latestRx.sphereOD || 0) >= 4.0 ||
          Math.abs(latestRx.sphereOI || 0) >= 4.0 ||
          Math.abs(latestRx.cylinderOD || 0) >= 2.0 ||
          Math.abs(latestRx.cylinderOI || 0) >= 2.0
        )) ||
        (latestRx && (latestRx.additionOD != null || latestRx.additionOI != null)) ||
        (client.interest && (
          client.interest.toLowerCase().includes('multifocal') ||
          client.interest.toLowerCase().includes('progresivo') ||
          client.interest.toLowerCase().includes('bifocal') ||
          client.interest.toLowerCase().includes('miop') ||
          client.interest.toLowerCase().includes('myofix') ||
          client.interest.toLowerCase().includes('myolens') ||
          client.interest.toLowerCase().includes('myopilux')
        ));

      if (!isHighValue) continue;

      const daysElapsed = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
      const chat = client.whatsappChats[0];
      opportunities.push({
        type: 'STALLED_FAVORITE',
        client,
        chat,
        quoteDate: null,
        daysElapsed,
        amount: latestOrder?.total || null
      });
    }
  }

  // PENDING_QUOTE
  const pendingQuotes = await prisma.order.findMany({
    where: {
      orderType: 'QUOTE',
      status: { in: ['PENDING', 'CONFIRMED'] },
      isDeleted: false,
      createdAt: { lt: threeDaysAgo, gt: thirtyDaysAgo },
      client: {
        status: { notIn: ['CLIENT', 'active'] },
        orders: {
          none: {
            OR: [
              { orderType: 'SALE' },
              { status: 'CONFIRMED', updatedAt: { gte: sevenDaysAgo } }
            ],
            isDeleted: false
          }
        }
      }
    },
    include: {
      client: {
        include: {
          whatsappChats: { orderBy: { lastMessageAt: 'desc' }, take: 1 },
          tags: true
        }
      },
      items: true
    }
  });

  for (const quote of pendingQuotes) {
    if (!quote.client) continue;

    const hasHighValue = quote.total >= 250000;
    let hasHighGraduation = false;
    let hasSpecialLenses = false;

    for (const item of quote.items) {
      if (
        (item.sphereVal != null && Math.abs(item.sphereVal) >= 4.0) ||
        (item.cylinderVal != null && Math.abs(item.cylinderVal) >= 2.0)
      ) {
        hasHighGraduation = true;
      }

      if (item.additionVal != null) hasSpecialLenses = true;

      const name = `${item.productBrandSnapshot || ''} ${item.productNameSnapshot || ''} ${item.productCategorySnapshot || ''}`.toLowerCase();
      if (
        name.includes('multifocal') ||
        name.includes('progresivo') ||
        name.includes('bifocal') ||
        name.includes('myofix') ||
        name.includes('myopilux') ||
        name.includes('myolens') ||
        name.includes('miopía') ||
        name.includes('miopia') ||
        name.includes('control miop')
      ) {
        hasSpecialLenses = true;
      }
    }

    if (!hasHighValue && !hasHighGraduation && !hasSpecialLenses) continue;

    const daysElapsed = Math.floor((Date.now() - quote.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const chat = quote.client.whatsappChats[0];
    opportunities.push({
      type: 'PENDING_QUOTE',
      client: quote.client,
      chat,
      quoteDate: quote.createdAt,
      daysElapsed,
      amount: quote.total,
      quote
    });
  }

  // ABANDONED_CART
  const abandonedCarts = await prisma.checkoutSession.findMany({
    where: {
      status: { in: ['PENDING', 'ABANDONED'] },
      createdAt: { lt: oneDayAgo, gt: thirtyDaysAgo }
    },
    orderBy: { createdAt: 'desc' }
  });

  for (const cart of abandonedCarts) {
    const hasHighValue = cart.total >= 250000;
    let hasSpecialLenses = false;

    const cartItems = Array.isArray(cart.cartData) ? cart.cartData as any[] : [];
    for (const item of cartItems) {
      const name = `${item.brand || ''} ${item.model || ''} ${item.category || ''}`.toLowerCase();
      if (
        name.includes('multifocal') ||
        name.includes('progresivo') ||
        name.includes('bifocal') ||
        name.includes('myofix') ||
        name.includes('myopilux') ||
        name.includes('myolens') ||
        name.includes('miopía') ||
        name.includes('miopia') ||
        name.includes('control miop')
      ) {
        hasSpecialLenses = true;
      }
    }

    if (!hasHighValue && !hasSpecialLenses) continue;

    let client = null;
    let chat = null;
    if (cart.phone) {
      const cleanPhone = cart.phone.replace(/\D/g, '');
      chat = await prisma.whatsAppChat.findFirst({
        where: {
          OR: [
            { waId: `${cleanPhone}@c.us` },
            { realPhone: cleanPhone }
          ]
        },
        include: { client: { include: { tags: true } } }
      });
      client = chat?.client || null;
    }

    if (!client) continue;

    const daysElapsed = Math.floor((Date.now() - cart.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    opportunities.push({
      type: 'ABANDONED_CART',
      client,
      chat,
      quoteDate: cart.createdAt,
      daysElapsed,
      amount: cart.total
    });
  }

  // Deduplicar e filtrar por clientes que ya compraron
  const clientsWithSales = await prisma.client.findMany({
    where: {
      OR: [
        { status: { in: ['CLIENT', 'active'] } },
        {
          orders: {
            some: {
              OR: [
                { orderType: 'SALE' },
                { status: 'CONFIRMED', updatedAt: { gte: sevenDaysAgo } }
              ],
              isDeleted: false
            }
          }
        }
      ]
    },
    select: { name: true, phone: true }
  });

  const clientPhones = new Set<string>();
  const clientNames = new Set<string>();

  for (const c of clientsWithSales) {
    clientNames.add(c.name.trim().toLowerCase());
    if (c.phone) {
      const cleaned = c.phone.replace(/\D/g, '');
      if (cleaned.length >= 8) {
        clientPhones.add(cleaned.slice(-8));
      }
    }
  }

  const uniqueOpps = [];
  const seenClients = new Set<string>();
  const seenPhones = new Set<string>();

  for (const opp of opportunities) {
    let isDuplicate = false;
    if (opp.client.id) {
      if (seenClients.has(opp.client.id)) isDuplicate = true;
      seenClients.add(opp.client.id);
    }
    if (opp.client.phone) {
      const cleaned = opp.client.phone.replace(/\D/g, '');
      if (cleaned.length >= 8) {
        const last8 = cleaned.slice(-8);
        if (seenPhones.has(last8)) isDuplicate = true;
        seenPhones.add(last8);
      }
    }

    if (clientNames.has(opp.client.name.trim().toLowerCase())) isDuplicate = true;
    if (opp.client.phone) {
      const cleaned = opp.client.phone.replace(/\D/g, '');
      if (cleaned.length >= 8) {
        const last8 = cleaned.slice(-8);
        if (clientPhones.has(last8)) isDuplicate = true;
      }
    }

    if (!isDuplicate) {
      uniqueOpps.push(opp);
    }
  }

  console.log(`Oportunidades encontradas: ${uniqueOpps.length}`);

  // Filtrar elegibles (ignorado botEnabled)
  const eligibleOpps = [];
  for (const opp of uniqueOpps) {
    const el = await checkEligibility(opp.client, opp.chat, opp.quoteDate);
    if (el.eligible) {
      eligibleOpps.push(opp);
    }
  }

  console.log(`Clientes elegibles para seguimiento: ${eligibleOpps.length}\n`);

  if (eligibleOpps.length === 0) {
    console.log("No hay clientes elegibles que cumplan con los cooldowns de 48hs o inactividad de 24hs.");
    process.exit(0);
  }

  for (let i = 0; i < eligibleOpps.length; i++) {
    const opp = eligibleOpps[i];
    console.log(`[${i + 1}/${eligibleOpps.length}] Procesando ${opp.client.name} (${opp.type})...`);

    // 1. Generar mensaje
    const message = await generateFollowUp(opp);
    if (!message) {
      console.error(`  ❌ No se pudo generar mensaje válido para ${opp.client.name}. Salteando.`);
      continue;
    }
    console.log(`  📝 Mensaje: "${message}"`);

    if (isDryRun) {
      console.log(`  🧪 [SIMULACIÓN] Mensaje generado con éxito. No se envía.`);
      continue;
    }

    // Guardar estado original de botEnabled
    const originalBotEnabled = opp.chat.botEnabled;

    // 2. Enviar WhatsApp
    const success = await sendWhatsApp(opp.client.phone, message);

    if (success) {
      console.log(`  ✅ WhatsApp enviado con éxito.`);

      // 3. Restaurar botEnabled y agregar etiquetas/cooldowns en la DB
      try {
        const currentChat = await prisma.whatsAppChat.findUnique({ where: { id: opp.chat.id } });
        let updatedLabels = [...(currentChat?.chatLabels || [])];
        const label = 'Seguimiento Cierre';
        if (!updatedLabels.includes(label)) {
          updatedLabels.push(label);
        }

        await prisma.whatsAppChat.update({
          where: { id: opp.chat.id },
          data: {
            chatLabels: updatedLabels,
            lastMessageAt: new Date(),
            lastFollowUpAt: new Date(),
            botEnabled: originalBotEnabled // Restaurar el estado original del bot!
          }
        });

        // Registrar Interacción
        await prisma.interaction.create({
          data: {
            clientId: opp.client.id,
            type: 'FOLLOWUP',
            content: `📍 [BOT SEGUIMIENTO CIERRES] Mensaje automático enviado:\n"${message}"`
          }
        });

        console.log(`  ✅ Estado de chat e interacción actualizados en DB.`);
      } catch (dbErr: any) {
        console.error(`  ⚠️ Error actualizando base de datos para ${opp.client.name}:`, dbErr.message);
      }
    } else {
      console.error(`  ❌ Falló el envío de WhatsApp.`);
    }

    // Esperar delay aleatorio (3 a 7 minutos) si no es el último
    if (i < eligibleOpps.length - 1) {
      const minDelay = 180000; // 3 min
      const maxDelay = 420000; // 7 min
      const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
      console.log(`⏳ Esperando ${(delay / 1000 / 60).toFixed(2)} minutos antes del próximo envío...\n`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.log(`\n🎉 ¡Seguimiento finalizado con éxito!`);
  process.exit(0);
}

main().catch(console.error);
