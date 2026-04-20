import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export const dynamic = 'force-dynamic';

const model = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-flash",
    maxOutputTokens: 2048,
    apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
});

export async function POST(request: Request) {
    try {
        const { clientId } = await request.json();

        if (!clientId) {
            return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
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
            return NextResponse.json({ error: 'No messages found for this client' }, { status: 404 });
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
            const jsonMatch = text.match(/\[.*\]/s);
            if (jsonMatch) {
                hitos = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('Failed to parse Hitos JSON:', e);
            return NextResponse.json({ error: 'Error procesando hitos con la IA' }, { status: 500 });
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

        return NextResponse.json(savedHitos);
    } catch (error: any) {
        console.error('[Hitos Extract] Error:', error);
        return NextResponse.json({ error: 'Error interno al extraer hitos' }, { status: 500 });
    }
}
