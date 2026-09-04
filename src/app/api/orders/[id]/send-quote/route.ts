// POST /api/orders/[id]/send-quote — manda el presupuesto por WhatsApp y lo
// deja asentado en la ficha con la COPIA EXACTA que recibió el cliente.
//
// Antes este envío salía directo desde el navegador contra /api/whatsapp/send:
// el texto se armaba en el componente y la ficha no se enteraba de nada. Un
// cliente podía decir "me pasaron otro precio" y no había con qué contestarle.
//
// Acá el texto se arma en el SERVIDOR desde el pedido (`buildQuoteMessage`), así
// que lo que se manda y lo que se guarda son literalmente el mismo string, y el
// navegador no puede alterar los importes.

import { NextResponse } from 'next/server';
import { VIGENCIA_PRESUPUESTO_DIAS } from '@/lib/constants';
import { prisma } from '@/lib/db';
import { sendWhatsApp, explainSendFailure } from '@/lib/whatsapp/send';
import { templateSpec } from '@/lib/whatsapp/templates';
import { PricingService } from '@/services/PricingService';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { buildQuoteMessage } from '@/lib/quote-message';
import { DETALLE_MARK } from '@/lib/order-detail-summary';
import { generateOrderPDF } from '@/lib/order-pdf-generator';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { formattedPhone } = await request.json().catch(() => ({ formattedPhone: null }));

        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                client: true,
                items: { include: { product: true } },
                payments: true,
            },
        });

        if (!order || !order.client) {
            return NextResponse.json({ error: 'Pedido o cliente no encontrado' }, { status: 404 });
        }

        const actor = getActor(request, 'CRM');
        const texto = buildQuoteMessage(order, order.client.name);
        const esVenta = order.orderType === 'SALE' || order.orderType === 'MAYORISTA';
        const etiqueta = esVenta ? 'Venta' : 'Presupuesto';

        // El chat ya vinculado manda; el teléfono es el respaldo.
        const chat = await prisma.whatsAppChat.findFirst({ where: { clientId: order.clientId } });
        const destino = chat ? chat.id : `${formattedPhone}@c.us`;
        if (!chat && !formattedPhone) {
            return NextResponse.json({ error: 'No hay chat ni teléfono para este cliente' }, { status: 400 });
        }

        const registrar = async (resumen: string, ok: boolean) => {
            await prisma.interaction.create({
                data: {
                    clientId: order.clientId,
                    type: ok ? 'NOTE' : 'ERROR',
                    userId: actor.id,
                    userName: actor.name,
                    // Detrás del separador va la copia TAL CUAL, que la ficha
                    // muestra colapsada: se despliega y se lee lo mismo que leyó
                    // el cliente, cuotas incluidas.
                    content: `${ok ? '📄' : '⚠️'} ${etiqueta} ${ok ? 'enviado' : 'NO enviado'} por ${actor.name}: ${resumen}${DETALLE_MARK}${texto}`,
                },
            }).catch(e => console.error('[send-quote] No se pudo registrar en la ficha:', e));

            logAudit({
                userId: actor.id,
                userName: actor.name,
                action: 'OTHER',
                entityType: 'ORDER',
                entityId: id,
                details: { evento: 'envio_presupuesto_texto', ok, clientName: order.client!.name },
            }).catch(console.error);
        };

        try {
            const f = PricingService.calculateOrderFinancials(order);
            const money = (n: number) => `$ ${Number(n || 0).toLocaleString('es-AR')}`;
            const nombre = order.client.name.split(' ')[0];

            // 1) Texto libre, que solo sale si el cliente escribió en las últimas 24 h.
            let res = await sendWhatsApp({ chatId: destino, message: texto, senderName: actor.name });
            let conPdf = false;

            // 2) Ventana cerrada: plantilla CON el PDF adjunto. Antes caía a la
            // plantilla `presupuesto` (solo texto): el cliente recibía cuatro
            // importes sueltos y ningún documento, y la vendedora veía "enviado"
            // sin saber que el PDF no había ido (reporte del 3/9/26: "no permite
            // enviar el presupuesto en PDF a clientes que pasaron 24 h"). El PDF
            // se genera recién acá, porque dentro de la ventana no hace falta.
            if (!res.ok && res.needsTemplate) {
                let pdf: Awaited<ReturnType<typeof generateOrderPDF>> | null = null;
                try {
                    pdf = await generateOrderPDF(order, order.client, actor.name);
                } catch (e: any) {
                    console.error('[send-quote] No se pudo generar el PDF para la plantilla:', e?.message);
                }
                if (pdf) {
                    const nro = `#${String(order.id).slice(-4).toUpperCase()}`;
                    const template = esVenta
                        ? templateSpec('venta_confirmada', [nombre, nro, money(f.totalCard)])
                        : templateSpec('presupuesto_pdf', [nombre, money(f.totalCard), String(VIGENCIA_PRESUPUESTO_DIAS)]);
                    res = await sendWhatsApp({
                        chatId: destino,
                        message: texto,
                        senderName: actor.name,
                        forceTemplate: true,
                        template,
                        templateMedia: { base64: pdf.base64, mimetype: 'application/pdf', filename: pdf.filename },
                    });
                    conPdf = res.ok;
                } else {
                    // Sin PDF (Chromium caído, etc.): la plantilla de texto, que es mejor que nada.
                    res = await sendWhatsApp({
                        chatId: destino,
                        message: texto,
                        senderName: actor.name,
                        forceTemplate: true,
                        template: templateSpec('presupuesto', [nombre, money(f.totalCard), money(f.totalTransfer), money(f.totalCash)]),
                    });
                }
            }

            if (res.ok) {
                const comoSalio = res.via === 'template'
                    ? (conPdf ? ' (fuera de la ventana de 24 h: salió como plantilla con el PDF adjunto)' : ' (plantilla de texto, fuera de la ventana de 24 h)')
                    : '';
                await registrar(`por WhatsApp al ${order.client.phone || formattedPhone}${comoSalio}.`, true);
                return NextResponse.json({ success: true, via: res.via, conPdf });
            }

            // notSent = el wa-service garantiza que no salió nada: se puede
            // reintentar sin miedo a duplicar.
            if (res.notSent) {
                await registrar(`no salió nada: ${explainSendFailure(res)}`, false);
                return NextResponse.json({ error: explainSendFailure(res), code: res.code }, { status: res.status === 503 ? 503 : 409 });
            }

            await registrar(`el bot no pudo enviarlo (HTTP ${res.status}). Verificar si le llegó antes de reintentar.`, false);
            return NextResponse.json({ error: `El bot no pudo enviarlo (${res.status}).` }, { status: 502 });
        } catch (err: any) {
            if (err?.status === 503) {
                await registrar('WhatsApp estaba reconectando, no salió nada. Hay que reintentar.', false);
                return NextResponse.json({ error: 'WhatsApp se está reconectando: NO se envió nada. Esperá unos segundos y reintentá.' }, { status: 503 });
            }
            await registrar(`error de red (${err.message}). Verificar si le llegó antes de reintentar.`, false);
            return NextResponse.json({ error: `Error de red: ${err.message}` }, { status: 502 });
        }
    } catch (error: any) {
        console.error('[send-quote] Error:', error.message);
        return NextResponse.json({ error: `Error interno: ${error.message}` }, { status: 500 });
    }
}
