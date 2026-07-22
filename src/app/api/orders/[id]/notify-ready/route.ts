import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchWa } from '@/lib/wa-config';
import { normalizeArgentinePhone } from '@/services/contact.service';
import { PricingService } from '@/services/PricingService';

// POST /api/orders/[id]/notify-ready
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: orderId } = await params;
        
        // 1. Obtener la orden con cliente
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { client: true, payments: true }
        });

        if (!order) {
            return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
        }

        if (!order.client.phone) {
            return NextResponse.json({ error: 'El cliente no tiene teléfono registrado' }, { status: 400 });
        }

        // 2. Buscar si hay un chat vinculado a este cliente
        const chat = await prisma.whatsAppChat.findFirst({
            where: { clientId: order.clientId }
        });

        const formattedPhone = normalizeArgentinePhone(order.client.phone);
        const waId = chat ? chat.waId : `${formattedPhone}@c.us`;
        const chatIdForBot = chat ? chat.id : waId; // Si hay chat mandamos el ID interno, sino mandamos el waId

        // 3. Calcular saldo y armar mensaje. Usamos calculateOrderFinancials (la misma
        // fuente que el PDF y el bot): el saldo nominal subtotal−paid ignoraba la
        // equivalencia por método (quien pagó en efectivo/transferencia con descuento
        // veía un saldo inflado que no coincidía con el resto del sistema).
        const financials = PricingService.calculateOrderFinancials(order);
        const shortName = order.client.name.split(' ')[0];

        let msgText = `¡Hola ${shortName}! Te escribimos de *Atelier Óptica* 😊\n\n`;
        msgText += `Tus anteojos ya están listos esperándote en el local (Tejeda 4380).\n\n`;

        if (financials.hasBalance) {
            msgText += `Te recordamos que tenés un saldo pendiente de *$${financials.remainingList.toLocaleString()}*.\n`;
        } else {
            msgText += `¡Ya está todo abonado! ✅\n`;
        }
        msgText += `\nTe esperamos de Lunes a Viernes de 9:00 a 13:30 y de 16:00 a 19:30, o Sábados de 10:00 a 14:00.`;

        // 4. Enviar usando el microservicio wa-service
        const res = await fetchWa('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: chatIdForBot,
                message: msgText,
                senderName: 'Sistema Atelier'
            }),
        });

        if (!res.ok) {
            throw new Error('Fallo en wa-service');
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[Notify Ready] Error:', error.message);
        return NextResponse.json({ error: 'Error al enviar notificación' }, { status: 500 });
    }
}
