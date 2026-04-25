import { prisma } from '@/lib/db';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { WA_SERVER_URL } from '@/lib/wa-config';

export class BotService {
    /**
     * Extrae hitos de una conversación usando IA.
     */
    static async extractHitos(clientId: string) {
        if (!clientId) throw new Error('clientId is required');

        const model = new ChatGoogleGenerativeAI({
            model: "gemini-1.5-flash",
            maxOutputTokens: 2048,
            apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
        });

        // 1. Fetch last 50 messages for this client
        const messages = await prisma.whatsAppMessage.findMany({
            where: {
                chat: {
                    clientId: clientId
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        if (messages.length === 0) {
            throw new Error('No messages found for this client');
        }

        const chatContext = messages
            .reverse()
            .map(m => `${m.direction === 'INBOUND' ? 'Cliente' : 'Asistente'}: ${m.content}`)
            .join('\n');

        // 2. Prompt Gemini for Milestones
        const systemPrompt = `Eres un experto analista de ventas de una óptica. 
        Analiza la conversación adjunta y extrae exactamente 3 hitos clave que resuman el estado actual del cliente.
        
        Usa los siguientes TIPOS de hito:
        - SUMMARY: Resumen general de lo hablado.
        - PRODUCT_OFFERED: Qué productos o precios se le dieron.
        - FOLLOW_UP: Qué pasos quedan pendientes (ej: el cliente prometió pasar el sábado).
        - PRESCRIPTION_RECEIVED: Si envió receta o datos médicos.

        IMPORTANTE: Devuelve un formato JSON estrictamente como este:
        [{ "type": "TIPO", "content": "Descripción breve y profesional" }]
        `;

        const response = await model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(`Conversación:\n${chatContext}`)
        ]);

        // 3. Parse and Save Milestones as Interactions
        let hitos = [];
        try {
            // Basic extraction of JSON from Gemini response
            const text = response.content.toString();
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                hitos = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('Failed to parse Hitos JSON:', e);
            throw new Error('Error procesando hitos con la IA');
        }

        // Save each hito as a Milestone interaction
        const savedHitos = await Promise.all(
            hitos.map((h: any) => 
                prisma.interaction.create({
                    data: {
                        clientId,
                        type: h.type || 'SUMMARY',
                        content: `📍 [HITO] ${h.content}`
                    }
                })
            )
        );

        return savedHitos;
    }

    /**
     * Notifica al cliente por WhatsApp que su pedido está listo y le informa su saldo.
     */
    static async notifyOrderReady(clientId: string, clientName: string, clientPhone: string, total: number, paid: number) {
        try {
            const saldo = total - paid;
            
            let message = `¡Hola ${clientName}! 👋 Tus anteojos ya están listos para retirar en Atelier Óptica (Tejeda 4380).`;
            
            if (saldo > 0) {
                message += ` El saldo pendiente es de $${Math.round(saldo).toLocaleString()}. ¡Te esperamos!`;
            } else {
                message += ` ¡Te esperamos pronto para la entrega!`;
            }

            // Send via internal WA server proxy
            const res = await fetch(`${WA_SERVER_URL}/api/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    chatId: `${clientPhone.replace(/\D/g, '')}@c.us`, 
                    message 
                }),
            });
            
            if (!res.ok) {
                console.warn('[Auto-Notify READY] WhatsApp server returned error:', await res.text());
            }

            // Log interaction
            await prisma.interaction.create({
                data: {
                    clientId,
                    type: 'NOTE',
                    content: `🤖 Notificación automática enviada: Listo para retirar. Saldo informado: $${saldo.toLocaleString()}`
                }
            });
            return true;
        } catch (error: any) {
            console.error('[Auto-Notify READY] Error:', error.message);
            return false;
        }
    }
}
