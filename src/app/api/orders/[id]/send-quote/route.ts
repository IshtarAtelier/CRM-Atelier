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
import { prisma } from '@/lib/db';
import { fetchWa } from '@/lib/wa-config';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { buildQuoteMessage } from '@/lib/quote-message';
import { DETALLE_MARK } from '@/lib/order-detail-summary';

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
            const res = await fetchWa('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: destino, message: texto, senderName: actor.name }),
            });

            if (res.ok) {
                await registrar(`por WhatsApp al ${order.client.phone || formattedPhone}.`, true);
                return NextResponse.json({ success: true });
            }

            const detalle = await res.text();
            // 503 = el wa-service garantiza que no salió nada: se puede reintentar
            // sin miedo a duplicar.
            if (res.status === 503 && detalle.includes('notSent')) {
                await registrar('WhatsApp estaba reconectando, no salió nada. Hay que reintentar.', false);
                return NextResponse.json({ error: 'WhatsApp se está reconectando: NO se envió nada. Esperá unos segundos y reintentá.' }, { status: 503 });
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
