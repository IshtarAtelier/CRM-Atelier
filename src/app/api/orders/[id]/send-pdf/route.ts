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

        // Generar PDF del lado del servidor
        let pdfResult;
        try {
            pdfResult = await generateOrderPDF(order, order.client);
            console.log('[send-pdf] PDF generated successfully:', pdfResult.filename, '| Size:', Math.round(pdfResult.base64.length * 0.75 / 1024), 'KB');
        } catch (pdfError: any) {
            console.error('[send-pdf] PDF generation failed:', pdfError.message);
            return NextResponse.json({ error: `Error generando PDF: ${pdfError.message}` }, { status: 500 });
        }

        // Enviar por WhatsApp
        const res = await fetchWa('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: `${formattedPhone}@c.us`,
                message: text,
                media: {
                    base64: pdfResult.base64,
                    mimetype: 'application/pdf',
                    filename: pdfResult.filename
                }
            }),
        });

        const responseText = await res.text();
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch {
            console.error('[send-pdf] Non-JSON response from wa-service:', res.status, responseText.substring(0, 200));
            return NextResponse.json({ error: `wa-service respondió con formato inválido (${res.status})` }, { status: 502 });
        }

        if (!res.ok) {
            console.error('[send-pdf] Bot API Error:', res.status, responseData);
            return NextResponse.json({ error: `Error del bot al enviar PDF (${res.status}): ${responseData?.error || 'desconocido'}` }, { status: 500 });
        }

        console.log('[send-pdf] PDF sent successfully to:', formattedPhone);
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[send-pdf] Error:', error.message, error.stack);
        return NextResponse.json({ error: `Error interno: ${error.message}` }, { status: 500 });
    }
}
