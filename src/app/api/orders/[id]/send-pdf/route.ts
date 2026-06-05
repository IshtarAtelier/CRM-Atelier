import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchWa } from '@/lib/wa-config';
import { generateOrderPDF } from '@/lib/order-pdf-generator';

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const orderId = params.id;
        const { formattedPhone, text } = await request.json();

        if (!formattedPhone || !text) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

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
        const { base64, filename } = await generateOrderPDF(order, order.client);

        // Enviar por WhatsApp
        const res = await fetchWa('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: `${formattedPhone}@c.us`,
                message: text,
                media: {
                    base64,
                    mimetype: 'application/pdf',
                    filename
                }
            }),
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('[send-pdf] Bot API Error:', errorData);
            return NextResponse.json({ error: 'Error del bot al enviar PDF' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[send-pdf] Error:', error);
        return NextResponse.json({ error: 'Error interno generando o enviando el PDF' }, { status: 500 });
    }
}
