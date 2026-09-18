import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { formatDate } from '@/lib/format-date';
import { formatearPrecio } from '@/lib/format-precio';
import { textoReciboPago } from '@/lib/recibo-pago';
import { sendWhatsAppConReintento, explainSendFailure } from '@/lib/whatsapp/send';
import { templateSpec } from '@/lib/whatsapp/templates';
import { normalizeArgentinePhone } from '@/services/contact.service';
import { PricingService } from '@/services/PricingService';

/**
 * Reenvía a mano, por WhatsApp, el recibo de un pago ya registrado.
 *
 * Cuando el envío automático falla, la ficha dice "Reenviar el recibo a mano"
 * — y hasta el 17/9/2026 no había cómo: el único botón descargaba el PDF, y el
 * vendedor tenía que adjuntarlo desde el buzón y escribir el texto de memoria.
 * Ese día se perdió el recibo de Luis Greca por un tropiezo de Meta y no
 * existía la forma de repararlo con un clic.
 *
 * Manda lo MISMO que el automático (texto por el mismo helper, la plantilla
 * `comprobante_pago` si la ventana de 24 h está cerrada, el PDF), con reintento
 * ante fallos pasajeros, y deja constancia en la ficha y en la auditoría de
 * quién lo reenvió.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const actor = getActor(request);
    if (!actor.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
            order: {
                include: {
                    client: true,
                    payments: { select: { amount: true, method: true } },
                },
            },
        },
    });
    if (!payment || !payment.order) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    const order = payment.order;
    const client = order.client;
    if (!client) return NextResponse.json({ error: 'El pedido no tiene cliente' }, { status: 400 });
    const tel = (client.phone || '').replace(/\D/g, '');
    if (tel.length < 10) return NextResponse.json({ error: 'El cliente no tiene un teléfono válido' }, { status: 400 });

    const financials = PricingService.calculateOrderFinancials(order);
    const pagoParaPdf = {
        ...payment,
        clientName: client.name,
        clientPhone: client.phone,
        clientId: client.id,
        isSena: financials.hasBalance,
        totalOperacion: financials.listPrice,
        hasBalance: financials.hasBalance,
        remainingCash: financials.remainingCash,
        remainingTransfer: financials.remainingTransfer,
        remainingCard: financials.remainingCard,
    };

    let pdfMedia: { base64: string; mimetype: string; filename: string } | null = null;
    try {
        const { generateReceiptPDF } = await import('@/lib/receipt-pdf-generator');
        const pdf = await generateReceiptPDF(pagoParaPdf, order, client);
        pdfMedia = { base64: pdf.base64, mimetype: 'application/pdf', filename: pdf.filename };
    } catch (err) {
        console.error('[Reenvío de recibo] No se pudo generar el PDF (el texto sale igual):', err);
    }

    const chatId = `${normalizeArgentinePhone(client.phone!)}@c.us`;
    const nroPedido = `#${String(order.id).slice(-4).toUpperCase()}`;
    const texto = textoReciboPago({ clientName: client.name, method: payment.method, amount: payment.amount, fecha: formatDate(payment.date) });

    const res = await sendWhatsAppConReintento({
        chatId,
        message: texto,
        senderName: 'Sistema Atelier',
        isProactive: true,
        template: pdfMedia
            ? templateSpec('comprobante_pago', [client.name.split(' ')[0], `$ ${formatearPrecio(payment.amount)}`, nroPedido])
            : null,
        templateMedia: pdfMedia ?? undefined,
    }, { label: `reenvío de recibo ${nroPedido}` });

    if (!res.ok) {
        return NextResponse.json({ ok: false, error: explainSendFailure(res), code: res.code }, { status: 502 });
    }

    // Con ventana abierta el texto salió solo: el PDF va en un segundo mensaje.
    let pdfEnviado = res.via === 'template';
    if (pdfMedia && !pdfEnviado) {
        const resPdf = await sendWhatsAppConReintento({
            chatId, message: '', senderName: 'Sistema Atelier', isProactive: true, media: pdfMedia,
        }, { label: `PDF del recibo ${nroPedido}` });
        pdfEnviado = resPdf.ok;
        if (!resPdf.ok) console.error('[Reenvío de recibo] El PDF no salió:', resPdf.error);
    }

    await prisma.interaction.create({
        data: {
            clientId: client.id,
            type: 'NOTE',
            content: `🧾 ${actor.name} reenvió por WhatsApp el recibo del pago de $${formatearPrecio(payment.amount)} (${payment.method}) del pedido ${nroPedido}${pdfEnviado ? '' : ' — el texto salió, el PDF no'}.`,
            userId: actor.id,
            userName: actor.name,
        },
    }).catch(err => console.error('[Reenvío de recibo] No se pudo registrar en la ficha:', err));

    await logAudit({
        userId: actor.id, userName: actor.name,
        action: 'NOTIFY', entityType: 'ORDER', entityId: order.id,
        details: { tipo: 'recibo_reenviado', paymentId: payment.id, via: res.via, pdf: pdfEnviado },
    });

    return NextResponse.json({ ok: true, via: res.via, pdf: pdfEnviado });
}
