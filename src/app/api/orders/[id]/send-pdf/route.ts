import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchWa } from '@/lib/wa-config';
import { generateOrderPDF } from '@/lib/order-pdf-generator';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const orderId = resolvedParams.id;
        const { formattedPhone, text } = await request.json();

        if (!formattedPhone || !text) {
            return NextResponse.json({ error: 'Faltan parámetros (formattedPhone o text)' }, { status: 400 });
        }

        console.log('[send-pdf] Generating PDF for order:', orderId, 'to:', formattedPhone);

        // Obtener orden y contacto
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                client: true,
                items: {
                    include: { product: true }
                },
                payments: true,
                prescription: true
            }
        });

        if (!order || !order.client) {
            return NextResponse.json({ error: 'Orden o cliente no encontrado' }, { status: 404 });
        }

        // Buscar si hay un chat vinculado a este cliente
        const chat = await prisma.whatsAppChat.findFirst({
            where: { clientId: order.clientId }
        });

        const waId = chat ? chat.waId : `${formattedPhone}@c.us`;
        const chatIdForBot = chat ? chat.id : waId;

        // Generar PDF del lado del servidor
        let pdfResult = null;
        try {
            pdfResult = await generateOrderPDF(order, order.client);
            console.log('[send-pdf] PDF generated successfully:', pdfResult.filename, '| Size:', Math.round(pdfResult.base64.length * 0.75 / 1024), 'KB');
        } catch (pdfError: any) {
            console.error('[send-pdf] PDF generation failed:', pdfError.message);
            // No hacemos un early return: caemos al link de respaldo (Caso B).
        }

        // Caso A: El PDF se generó bien → lo enviamos como Documento adjunto.
        // IMPORTANTE: si el envío de media falla o tarda, NO caemos al link,
        // porque el PDF podría estar en curso y llegar igual → mensaje duplicado.
        // Devolvemos error y que el humano verifique antes de reintentar.
        if (pdfResult) {
            try {
                const res = await fetchWa('/api/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: chatIdForBot,
                        message: text,
                        media: {
                            base64: pdfResult.base64,
                            mimetype: 'application/pdf',
                            filename: pdfResult.filename
                        }
                    }),
                });

                if (res.ok) {
                    console.log('[send-pdf] PDF sent successfully as media to:', formattedPhone);
                    return NextResponse.json({ success: true, method: 'media' });
                }

                const responseText = await res.text();
                console.error('[send-pdf] Media send failed (sin fallback a link para evitar duplicados):', res.status, responseText.substring(0, 200));
                return NextResponse.json(
                    { error: `El bot no pudo adjuntar el PDF (${res.status}). Verificá si le llegó al cliente antes de reintentar.` },
                    { status: 502 }
                );
            } catch (mediaErr: any) {
                console.error('[send-pdf] Media send network error:', mediaErr.message);
                return NextResponse.json(
                    { error: `Error de red enviando el PDF: ${mediaErr.message}. Verificá si le llegó al cliente antes de reintentar.` },
                    { status: 502 }
                );
            }
        }

        // Caso B: No se pudo generar el PDF → único caso donde el link es el respaldo
        // (no hay riesgo de duplicado porque nunca se envió media).
        console.log('[send-pdf] Sin PDF generado, enviando link de respaldo para orden:', orderId);

        const pdfUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar'}/api/orders/${orderId}/pdf`;
        const fallbackText = `${text}\n\n📄 *Descargar Documento:* ${pdfUrl}`;

        try {
            const resLink = await fetchWa('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: chatIdForBot,
                    message: fallbackText
                }),
            });

            if (resLink.ok) {
                console.log('[send-pdf] Link de respaldo enviado a:', formattedPhone);
                return NextResponse.json({ success: true, method: 'link' });
            } else {
                const responseText = await resLink.text();
                console.error('[send-pdf] Bot API Error on Link Fallback:', resLink.status, responseText);
                return NextResponse.json({ error: `Error del bot al enviar link (${resLink.status})` }, { status: 500 });
            }
        } catch (linkErr: any) {
            console.error('[send-pdf] Network error sending link:', linkErr.message);
            return NextResponse.json({ error: `Error de red al enviar el link: ${linkErr.message}` }, { status: 500 });
        }

    } catch (error: any) {
        console.error('[send-pdf] Error:', error.message, error.stack);
        return NextResponse.json({ error: `Error interno: ${error.message}` }, { status: 500 });
    }
}
