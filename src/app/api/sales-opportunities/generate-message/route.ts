import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { prisma } from '@/lib/db';

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY || '' });

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

export async function POST(req: Request) {
    try {
        const { id, type, clientName: reqClientName, taskDescription } = await req.json();

        if (!id || !type) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

        let context = '';
        let clientName = reqClientName || 'Cliente';

        if (type === 'PENDING_QUOTE') {
            const order = await prisma.order.findUnique({
                where: { id },
                include: {
                    client: true,
                    items: {
                        include: { product: true }
                    }
                }
            });

            if (order) {
                clientName = order.client?.name?.split(' ')[0] || 'Cliente';
                const total = order.total || order.subtotalWithMarkup || 0;
                const itemsList = order.items.map(i => {
                    const name = i.product ? `${i.product.brand || ''} ${i.product.name || ''} ${i.product.model || ''}` : (i.productNameSnapshot || 'Producto Genérico');
                    return `- ${i.quantity}x ${name.trim()}`;
                }).join('\n');
                
                context = `
                Tipo de Seguimiento: Presupuesto Pendiente
                Nombre del Cliente: ${clientName}
                Total del Presupuesto: $${total.toLocaleString('es-AR')}
                Productos cotizados:
                ${itemsList}
                `;
            }
        } else if (type === 'STALLED_FAVORITE') {
            const client = await prisma.client.findUnique({
                where: { id },
                include: {
                    interactions: {
                        where: { type: 'FAVORITE' },
                        orderBy: { createdAt: 'desc' },
                        take: 5
                    }
                }
            });

            if (client) {
                clientName = client.name?.split(' ')[0] || 'Cliente';
                const favs = client.interactions.map(i => i.content).join('\n- ');
                context = `
                Tipo de Seguimiento: Cliente con Favoritos (Venta Estancada)
                Nombre del Cliente: ${clientName}
                Armazones/Productos Favoritos guardados:
                - ${favs}
                `;
            }
        } else if (type === 'ABANDONED_CART') {
            const cart = await prisma.checkoutSession.findUnique({
                where: { id }
            });

            if (cart) {
                clientName = cart.firstName || 'Cliente';
                const cartItems = Array.isArray(cart.cartData) ? cart.cartData as any[] : [];
                const itemsList = cartItems.map(i => {
                    const name = `${i.brand || ''} ${i.model || ''} ${i.name || ''}`.trim() || 'Producto Genérico';
                    return `- ${i.quantity || 1}x ${name}`;
                }).join('\n');
                
                context = `
                Tipo de Seguimiento: Carrito Abandonado (Web)
                Nombre del Cliente: ${clientName}
                Total del Carrito: $${cart.total.toLocaleString('es-AR')}
                Productos en el carrito:
                ${itemsList}
                `;
            }
        } else if (type === 'TASK') {
            context = `
            Tipo de Seguimiento: Tarea Pendiente
            Nombre del Cliente: ${clientName}
            Detalle/Instrucción de la Tarea: ${taskDescription || ''}
            `;
        }

        if (!context) {
            return NextResponse.json({ error: 'No se encontró contexto para generar el mensaje' }, { status: 404 });
        }

        const prompt = type === 'TASK'
            ? `
            Eres el mejor asesor de ventas de Atelier Óptica, una óptica moderna y premium.
            Tu objetivo es escribir un mensaje de WhatsApp para un cliente basado en una tarea o recordatorio de seguimiento comercial.
            
            Aquí tienes la información de la tarea de seguimiento:
            ${context}

            Reglas del mensaje:
            1. Tono y voseo: Cercano, muy amable, cálido, utilizando el voseo argentino (ej. "cómo estás", "querés", "contame"). Trata al cliente por su primer nombre (${clientName}). Usa emojis con sutileza (ej. 🤍, ✨, 👓, 😊).
            2. Objetivo del mensaje: Redacta la consulta/aviso de forma muy natural basándote en la tarea/recordatorio.
            3. Finalización: NO te despidas formalmente (evita decir "saludos", "que tengas un buen día" o "quedamos a disposición"). El mensaje debe finalizar con una pregunta abierta e invitar a continuar la conversación en base a la tarea.
            4. Extensión: Corto, directo y conversacional. No más de 3 o 4 líneas.
            `
            : `
            Eres el mejor asesor de ventas de Atelier Óptica, una óptica moderna y premium.
            Tu objetivo es escribir un mensaje de seguimiento de WhatsApp para intentar cerrar una venta pendiente.
            
            Aquí tienes la información de la oportunidad de venta:
            ${context}

            Reglas del mensaje:
            1. Tono y voseo: Cercano, muy amable, cálido, utilizando el voseo argentino (ej. "cómo estás", "querés", "contame"). Trata al cliente por su primer nombre (${clientName}). Usa emojis con sutileza (ej. 🤍, ✨, 👓, 😊).
            2. Muestra disposición: Pregúntale si tiene alguna duda técnica con los productos (sobre cristales o armazones) o si necesita ayuda para avanzar.
            3. Finalización: NO te despidas formalmente (evita decir "saludos", "que tengas un buen día" o "quedamos a disposición"). El mensaje debe finalizar con una pregunta abierta e invitar a la conversación.
            4. Extensión: Corto, directo y conversacional. No más de 3 o 4 líneas.
            `;

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
        if (!jsonStr) throw new Error("No response from AI");
        
        return NextResponse.json(JSON.parse(jsonStr));

    } catch (error: any) {
        console.error('[AI Generate Message Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
