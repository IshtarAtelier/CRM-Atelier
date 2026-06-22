import { PrismaClient } from '@prisma/client';
import { ChatVertexAI } from "@langchain/google-vertexai-web";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { retryWithBackoff } from '../src/lib/retry-utils';

const prisma = new PrismaClient();

// Helper para enviar WhatsApp directamente
async function fetchWa(url: string, init?: RequestInit): Promise<Response> {
    const WA_SERVER_URL = process.env.WA_SERVER_URL || 'http://127.0.0.1:3100';
    const headers = new Headers(init?.headers);
    if (process.env.WA_API_KEY) {
        headers.set('x-api-key', process.env.WA_API_KEY);
    }
    
    const resolvedUrl = url.startsWith('/') ? `${WA_SERVER_URL}${url}` : url;

    return retryWithBackoff(
        async () => {
            const res = await fetch(resolvedUrl, { ...init, headers });
            if (!res.ok && [502, 503, 504].includes(res.status)) {
                throw Object.assign(
                    new Error(`WhatsApp API responded with transient status ${res.status}`),
                    { status: res.status }
                );
            }
            return res;
        },
        { maxRetries: 3, delayMs: 500, maxDelayMs: 2000, label: `WhatsApp API (${url})` }
    );
}

// Random delay entre envíos (Throttling)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min = 120000, max = 300000) => Math.floor(Math.random() * (max - min + 1) + min);

async function main() {
    console.log("Iniciando Bot de Seguimiento Masivo...");

    // Inicializar modelo de IA
    let model;
    try {
        model = new ChatVertexAI({
            model: "gemini-2.5-flash",
            location: "global",
            maxOutputTokens: 500,
        });
    } catch (err: any) {
        console.warn("Vertex AI falló, usando GoogleGenerativeAI fallback");
        const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
        model = new ChatGoogleGenerativeAI({
            model: "gemini-2.5-flash",
            apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
            maxOutputTokens: 500,
        });
    }

    // 1. Obtener clientes creados este mes con status "CIERRE"
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const clients = await prisma.client.findMany({
        where: {
            status: 'CIERRE',
            createdAt: {
                gte: startOfMonth
            }
        },
        include: {
            whatsappChats: {
                orderBy: { updatedAt: 'desc' },
                take: 1
            }
        }
    });

    console.log(`Se encontraron ${clients.length} clientes en estado CIERRE creados desde ${startOfMonth.toLocaleDateString()}`);

    for (const client of clients) {
        try {
            const chat = client.whatsappChats[0];
            if (!chat || !chat.realPhone) {
                console.log(`[Skip] Cliente ${client.name} no tiene un chat de WhatsApp vinculado o no hay número real.`);
                continue;
            }

            // Obtener últimos mensajes para dar contexto a la IA
            const messages = await prisma.whatsAppMessage.findMany({
                where: { chatId: chat.id },
                orderBy: { createdAt: 'desc' },
                take: 20
            });

            if (messages.length === 0) {
                console.log(`[Skip] Cliente ${client.name} no tiene mensajes en el historial.`);
                continue;
            }

            // Evitar enviar mensaje si el último mensaje fue del negocio y se envió hoy
            const lastMessage = messages[0];
            const isFromUs = lastMessage.direction === 'OUTBOUND';
            const isToday = new Date().getTime() - new Date(lastMessage.createdAt).getTime() < 86400000;
            
            if (isFromUs && isToday) {
                console.log(`[Skip] Ya le enviamos un mensaje a ${client.name} en las últimas 24hs.`);
                continue;
            }

            // Preparar contexto para la IA
            const chatContext = messages
                .reverse()
                .map(m => `${m.direction === 'INBOUND' ? 'Cliente' : 'Vendedor'}: ${m.content}`)
                .join('\n');

            const systemPrompt = `
Eres un vendedor súper amable, cálido y experto de Atelier Óptica. Vas a hacer un seguimiento por WhatsApp a un cliente.
Nombre del cliente: ${client.name}

Aquí está la charla previa:
---
${chatContext}
---

INSTRUCCIONES CRÍTICAS:
1. Escribe UN SOLO PÁRRAFO CORTO, no más de 2 oraciones.
2. Suena 100% humano, empático y muy amigable. Retoma el último tema que hablaron.
3. Haz una pregunta sutil y servicial al final, usando un tono similar a: "¿Contame un poquito qué te pareció?", "¿Necesitás que te cotice alguna otra opción?", o "¿Te quedó alguna duda con los precios?".
4. NO uses saludos formales robóticos. Di "Hola [Nombre]" o similar, relajado.
5. NO TE DESPIDAS definitivamente. Queremos que el cliente se sienta cómodo para responder.
6. Devuelve SOLO el texto del mensaje, nada más.
`;

            // 2. Generar mensaje
            console.log(`Generando mensaje para ${client.name}...`);
            const response = await model.invoke([
                new SystemMessage(systemPrompt),
                new HumanMessage("Por favor, escribí el mensaje de seguimiento para este cliente.")
            ]);

            const followUpMessage = response.content.toString().trim();
            console.log(`\nMensaje generado para ${client.name}:\n"${followUpMessage}"\n`);

            // 3. Enviar mensaje por WhatsApp
            const res = await fetchWa('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    chatId: `${chat.realPhone}@c.us`, 
                    message: followUpMessage 
                }),
            });

            if (!res.ok) {
                console.error(`[Error WA] No se pudo enviar el WhatsApp a ${client.name}. Status: ${res.status}`);
                continue;
            }

            // 4. Registrar en la base de datos (Interacción + Mensaje WA)
            await prisma.interaction.create({
                data: {
                    clientId: client.id,
                    type: 'NOTE',
                    content: `📍 [SEGUIMIENTO BOT] Se envió mensaje de seguimiento automático:\n"${followUpMessage}"`
                }
            });

            await prisma.whatsAppMessage.create({
                data: {
                    chatId: chat.id,
                    direction: 'OUTBOUND',
                    type: 'TEXT',
                    content: followUpMessage,
                    status: 'SENT',
                    senderName: 'Seguimiento Bot'
                }
            });

            // Actualizar el estado del chat para mantenerlo abierto/unread
            await prisma.whatsAppChat.update({
                where: { id: chat.id },
                data: {
                    lastMessageAt: new Date(),
                    lastFollowUpAt: new Date()
                }
            });

            console.log(`✅ Seguimiento enviado a ${client.name}.`);

            // 5. Throttling (dormir de 2 a 5 minutos)
            const waitTime = randomDelay(120000, 300000); // 120s to 300s
            console.log(`⏳ Esperando ${(waitTime / 1000 / 60).toFixed(2)} minutos antes del próximo envío...\n`);
            await sleep(waitTime);

        } catch (err: any) {
            console.error(`Error procesando al cliente ${client.name}:`, err.message);
        }
    }

    console.log("¡Proceso de seguimiento finalizado!");
    process.exit(0);
}

main().catch(console.error);
