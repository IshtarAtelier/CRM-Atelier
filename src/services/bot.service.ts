import { prisma } from '@/lib/db';
import { ChatVertexAI } from "@langchain/google-vertexai-web";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { fetchWa } from '@/lib/wa-config';
import { PricingService } from './PricingService';
import { normalizeArgentinePhone } from './contact.service';

export class BotService {
    /**
     * Extrae hitos de una conversación usando IA.
     */
    static async extractHitos(clientId: string) {
        if (!clientId) throw new Error('clientId is required');

        let model;
        try {
            model = new ChatVertexAI({
                model: "gemini-2.5-flash",
                location: "global",
                maxOutputTokens: 2048,
            });
        } catch (initErr: any) {
            console.error('[Hitos] Error initializing ChatVertexAI, falling back:', initErr.message);
            // Fallback: try with API key-based model
            const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
            model = new ChatGoogleGenerativeAI({
                model: "gemini-2.5-flash",
                maxOutputTokens: 2048,
                apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
            });
        }

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
            throw new Error('No hay mensajes de WhatsApp para este cliente. Asegurate de que el chat esté vinculado.');
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
        
        SOLO devuelve el JSON, sin texto adicional, sin bloques de código markdown.
        `;

        let response;
        try {
            response = await model.invoke([
                new SystemMessage(systemPrompt),
                new HumanMessage(`Conversación:\n${chatContext}`)
            ]);
        } catch (aiErr: any) {
            console.error('[Hitos] AI model invocation failed:', aiErr.message);
            const { handleAIError } = await import('@/lib/ai-error-handler');
            await handleAIError(aiErr, 'Extracción de Hitos de Conversación (WhatsApp)');
            throw aiErr; // handleAIError rethrows if not quota error
        }

        // 3. Parse and Save Milestones as Interactions
        let hitos = [];
        try {
            // Basic extraction of JSON from Gemini response
            const text = response.content.toString();
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const cleaned = jsonMatch[0].replace(/```json/g, '').replace(/```/g, '').trim();
                hitos = JSON.parse(cleaned);
            } else {
                console.error('[Hitos] No JSON array found in response:', text.substring(0, 200));
                throw new Error('La IA no devolvió un formato JSON válido');
            }
        } catch (e: any) {
            console.error('[Hitos] Failed to parse JSON:', e.message);
            throw new Error('Error procesando hitos con la IA: ' + e.message);
        }

        if (!hitos || hitos.length === 0) {
            throw new Error('No se pudieron extraer hitos de la conversación');
        }

        // Save each hito as a Milestone interaction with the 📍 [HITO] prefix
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
     * Notifica al cliente por WhatsApp que su pedido está listo y le informa su saldo usando el desglose financiero exacto.
     */
    static async notifyOrderReady(order: any) {
        try {
            const clientName = order.client?.name || 'Cliente';
            const clientPhone = order.client?.phone;
            
            if (!clientPhone) return false;

            const financials = PricingService.calculateOrderFinancials(order);
            
            let message = `*Hola ${clientName}*\n\n`;
            message += `Te avisamos que *tu pedido ya está listo para retirar* en *Atelier Óptica*\n\n`;
            
            if (financials.hasBalance) {
                message += `*Detalle del saldo:*\n`;
                message += `• *Saldo con TARJETA / CUOTAS: $${financials.remainingCard.toLocaleString('es-AR')}*\n`;
                message += `• *Saldo con TRANSFERENCIA: $${financials.remainingTransfer.toLocaleString('es-AR')}*\n`;
                message += `• *Saldo si pagás en EFECTIVO: $${financials.remainingCash.toLocaleString('es-AR')}*\n`;
                message += `\nPodés abonar con cualquier medio de pago.\n`;
                message += `*¿Nos podrías avisar cómo quisieras abonar el saldo?*\n\n`;
            } else {
                message += `Tu pedido está *completamente pago*.\n\n`;
            }
            message += `*Dirección:* José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba\n`;
            message += `*Ubicación:* https://share.google/j2ZT7ReboDLt7onCp\n`;
            message += `*Horarios:*\n   • Lunes a viernes de 9:00 a 13:30 y de 16:00 a 19:30\n   • Sábados de 10:00 a 14:00 hs\n\n`;
            message += `¡Te esperamos! Muchas gracias.\n`;
            message += `\n_La óptica mejor calificada en Google Business 5/5_`;

            let formattedPhone = normalizeArgentinePhone(clientPhone);
            if (!formattedPhone) return false;

            // Send via internal WA server proxy
            const res = await fetchWa('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    chatId: `${formattedPhone}@c.us`, 
                    message 
                }),
            });
            
            if (!res.ok) {
                console.warn('[Auto-Notify READY] WhatsApp server returned error:', await res.text());
            }

            // Log interaction
            await prisma.interaction.create({
                data: {
                    clientId: order.clientId,
                    type: 'NOTE',
                    content: `🤖 Notificación automática enviada: Listo para retirar. Saldo restante: Efectivo $${financials.remainingCash.toLocaleString('es-AR')}, Tarjeta $${financials.remainingCard.toLocaleString('es-AR')}, Transferencia $${financials.remainingTransfer.toLocaleString('es-AR')}.`
                }
            });
            return true;
        } catch (error: any) {
            console.error('[Auto-Notify READY] Error:', error.message);
            return false;
        }
    }
}
