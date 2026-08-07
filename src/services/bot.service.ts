import { prisma } from '@/lib/db';
import { ChatVertexAI } from "@langchain/google-vertexai-web";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { fetchWa } from '@/lib/wa-config';
import { PricingService } from './PricingService';
import { normalizeArgentinePhone } from './contact.service';
import { BUSINESS_INFO } from '@/lib/business-info';
import { sendClientEmail, escHtml } from '@/lib/client-email';

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

        // Sync contact source in milestones
        try {
            const client = await prisma.client.findUnique({
                where: { id: clientId },
                select: { contactSource: true }
            });
            
            if (client && client.contactSource) {
                const existingSourceHito = await prisma.interaction.findFirst({
                    where: {
                        clientId,
                        content: { startsWith: '📍 [HITO] Origen:' }
                    }
                });
                
                if (!existingSourceHito) {
                    const sourceHito = await prisma.interaction.create({
                        data: {
                            clientId,
                            type: 'SUMMARY',
                            content: `📍 [HITO] Origen: ${client.contactSource}`
                        }
                    });
                    savedHitos.push(sourceHito);
                }
            }
        } catch (syncErr) {
            console.error('[Hitos Source Sync] Error syncing contactSource milestone:', syncErr);
        }

        return savedHitos;
    }

    /**
     * Notifica al cliente que su pedido está listo, con el desglose financiero
     * exacto. Sale por WhatsApp y —si la ficha tiene mail— también por email,
     * con copia al negocio. Es el aviso AUTOMÁTICO (cron de recordatorios); el
     * botón manual vive en /api/orders/[id]/notify-ready y cubre lo mismo.
     */
    static async notifyOrderReady(order: any) {
        try {
            const clientName = order.client?.name || 'Cliente';
            const clientPhone = order.client?.phone;
            const clientEmail = order.client?.email?.trim() || null;

            // Sin teléfono NI mail no hay canal posible. Antes cortaba solo por
            // teléfono, así que un cliente con mail cargado y número inválido
            // nunca se enteraba de que su pedido estaba listo.
            if (!clientPhone && !clientEmail) return false;

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
            message += `${BUSINESS_INFO.hoursWhatsAppBlock}\n\n`;
            message += `¡Te esperamos! Muchas gracias.\n`;

            // Email primero: nunca lanza, así un fallo de WhatsApp no se lleva
            // puesto también este canal.
            const saldoHtml = financials.hasBalance
                ? `<p><strong>Detalle del saldo:</strong></p>
<ul>
  <li>Saldo con <strong>TARJETA / CUOTAS</strong>: $${financials.remainingCard.toLocaleString('es-AR')}</li>
  <li>Saldo con <strong>TRANSFERENCIA</strong>: $${financials.remainingTransfer.toLocaleString('es-AR')}</li>
  <li>Saldo si pagás en <strong>EFECTIVO</strong>: $${financials.remainingCash.toLocaleString('es-AR')}</li>
</ul>
<p>Podés abonar con cualquier medio de pago. ¿Nos podrías avisar cómo quisieras abonar el saldo?</p>`
                : `<p>Tu pedido está <strong>completamente pago</strong>.</p>`;

            const emailEnviado = await sendClientEmail({
                to: clientEmail,
                subject: '¡Tu pedido ya está listo para retirar! — Atelier Óptica',
                bodyHtml: `<p><strong>Hola ${escHtml(clientName)}</strong>,</p>
<p>Te avisamos que <strong>tu pedido ya está listo para retirar</strong> en Atelier Óptica.</p>
${saldoHtml}
<p>${escHtml(BUSINESS_INFO.hours)}</p>
<p>¡Te esperamos! Muchas gracias.</p>`,
                label: 'pedido listo (automático)',
            });

            let whatsappEnviado = false;
            if (clientPhone) {
                const formattedPhone = normalizeArgentinePhone(clientPhone);
                if (formattedPhone) {
                    const res = await fetchWa('/api/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chatId: `${formattedPhone}@c.us`,
                            message
                        }),
                    });

                    whatsappEnviado = res.ok;
                    // Solo escala a error si NINGÚN canal llegó: con el mail
                    // enviado, tirar acá crearía una tarea de "notificar a mano"
                    // por un cliente que ya está avisado.
                    if (!res.ok && !emailEnviado) {
                        const errText = await res.text();
                        console.warn('[Auto-Notify READY] WhatsApp server returned error:', errText);
                        throw new Error(errText || `HTTP ${res.status}`);
                    }
                    if (!res.ok) {
                        console.warn('[Auto-Notify READY] WhatsApp falló pero el email salió: no se escala.');
                    }
                }
            }

            if (!whatsappEnviado && !emailEnviado) {
                throw new Error('No se pudo notificar por ningún canal');
            }

            // Log interaction
            const canales = [whatsappEnviado ? 'WhatsApp' : null, emailEnviado ? 'email' : null].filter(Boolean).join(' y ');
            await prisma.interaction.create({
                data: {
                    clientId: order.clientId,
                    type: 'NOTE',
                    content: `🤖 Notificación automática enviada por ${canales}: Listo para retirar. Saldo restante: Efectivo $${financials.remainingCash.toLocaleString('es-AR')}, Tarjeta $${financials.remainingCard.toLocaleString('es-AR')}, Transferencia $${financials.remainingTransfer.toLocaleString('es-AR')}.`
                }
            });
            return true;
        } catch (error: any) {
            console.error('[Auto-Notify READY] Error:', error.message);
            // Log fallback task for failure
            try {
                await prisma.clientTask.create({
                    data: {
                        clientId: order.clientId,
                        description: `⚠️ Falló la notificación automática de Listo para Retirar al cliente (${order.client?.name || 'Cliente'}). Por favor, notificar manualmente.`,
                        status: 'PENDING',
                        type: 'TASK'
                    }
                });
            } catch (dbErr) {
                console.error('Error creating fallback task for notifyOrderReady failure:', dbErr);
            }
            return false;
        }
    }
}
