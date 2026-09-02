import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsApp, explainSendFailure } from '@/lib/whatsapp/send';
import { templateSpec } from '@/lib/whatsapp/templates';
import { PricingService } from '@/services/PricingService';
import { normalizeArgentinePhone } from '@/services/contact.service';
import { BUSINESS_INFO } from '@/lib/business-info';
import { sendClientEmail, escHtml } from '@/lib/client-email';

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
            include: { client: true, payments: { select: { amount: true, method: true } } }
        });

        if (!order) {
            return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
        }

        // Sin teléfono ya no es un corte: si la ficha tiene mail, el aviso sale
        // igual por ese canal (el caso Pedraza del 7/8: número sin WhatsApp y el
        // cliente se quedaba sin enterarse de que su pedido estaba listo).
        if (!order.client.phone && !order.client.email?.trim()) {
            return NextResponse.json({ error: 'El cliente no tiene teléfono ni email registrado' }, { status: 400 });
        }

        // 2. Buscar si hay un chat vinculado a este cliente
        const chat = await prisma.whatsAppChat.findFirst({
            where: { clientId: order.clientId }
        });

        const formattedPhone = normalizeArgentinePhone(order.client.phone);
        const waId = chat ? chat.waId : `${formattedPhone}@c.us`;
        const chatIdForBot = chat ? chat.id : waId; // Si hay chat mandamos el ID interno, sino mandamos el waId

        // 3. Calcular saldo y armar mensaje.
        // El saldo NO es `precio de lista − cobrado`: lo que se pagó en efectivo o
        // por transferencia ya vino con su descuento, así que vale más en precio de
        // lista. Restando el importe nominal salía un saldo que no existía y se lo
        // mandábamos al cliente.
        const financials = PricingService.calculateOrderFinancials(order);
        const shortName = order.client.name.split(' ')[0];

        let msgText = `¡Hola ${shortName}! Te escribimos de *Atelier Óptica* 😊\n\n`;
        msgText += `Tus anteojos ya están listos esperándote en el local (Tejeda 4380).\n\n`;

        if (financials.hasBalance) {
            msgText += `Te recordamos que queda un saldo de *$${financials.remainingCash.toLocaleString('es-AR')}* abonando en efectivo `;
            msgText += `(o $${financials.remainingTransfer.toLocaleString('es-AR')} por transferencia).\n`;
        } else {
            msgText += `¡Ya está todo abonado! ✅\n`;
        }
        msgText += `\nTe esperamos ${BUSINESS_INFO.hours}.`;

        // 4. Enviar por EMAIL si la ficha tiene mail. Canal adicional e
        // independiente: va primero porque nunca lanza, así un fallo de
        // WhatsApp no se lleva puesto también el aviso por mail.
        const saldoHtml = financials.hasBalance
            ? `<p>Te recordamos que queda un saldo de <strong>$${financials.remainingCash.toLocaleString('es-AR')}</strong> abonando en efectivo (o $${financials.remainingTransfer.toLocaleString('es-AR')} por transferencia).</p>`
            : `<p>¡Ya está todo abonado! ✅</p>`;

        const emailEnviado = await sendClientEmail({
            to: order.client.email,
            subject: '¡Tus anteojos ya están listos! — Atelier Óptica',
            bodyHtml: `<p>¡Hola ${escHtml(shortName)}! Te escribimos de <strong>Atelier Óptica</strong> 😊</p>
<p>Tus anteojos ya están listos esperándote en el local (Tejeda 4380).</p>
${saldoHtml}
<p>Te esperamos ${escHtml(BUSINESS_INFO.hours)}.</p>`,
            label: 'pedido listo',
        });

        // 5. Enviar por WhatsApp (canal principal)
        let whatsappEnviado = false;
        let waDetalle: string | undefined;
        if (order.client.phone) {
            // Texto libre dentro de la ventana de 24 h; plantilla A1/A12 si está cerrada.
            const nro = `#${String(order.id).slice(-4).toUpperCase()}`;
            const fmt = (n: number) => `$ ${Number(n || 0).toLocaleString('es-AR')}`;
            const template = financials.hasBalance
                ? templateSpec('pedido_listo_saldo_v3', [shortName, nro, fmt(financials.remainingCard), fmt(financials.remainingTransfer), fmt(financials.remainingCash)])
                : templateSpec('pedido_listo_v3', [shortName, nro]);
            const res = await sendWhatsApp({
                chatId: chatIdForBot,
                message: msgText,
                senderName: 'Sistema Atelier',
                template,
            });
            whatsappEnviado = res.ok;
            if (!res.ok) waDetalle = explainSendFailure(res);
            // Solo es un fallo real si NINGÚN canal llegó: si el mail salió, el
            // cliente ya está avisado y cortar con error haría que el vendedor
            // reintente y mande el aviso dos veces.
            if (!res.ok && !emailEnviado) {
                return NextResponse.json({ error: waDetalle, code: res.code, notSent: res.notSent }, { status: 502 });
            }
        }

        return NextResponse.json({ success: true, whatsapp: whatsappEnviado, email: emailEnviado, whatsappDetalle: waDetalle });

    } catch (error: any) {
        console.error('[Notify Ready] Error:', error.message);
        return NextResponse.json({ error: 'Error al enviar notificación' }, { status: 500 });
    }
}
