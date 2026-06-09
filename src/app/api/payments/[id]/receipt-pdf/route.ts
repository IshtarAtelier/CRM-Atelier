import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateReceiptPDF } from '@/lib/receipt-pdf-generator';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const paymentId = resolvedParams.id;

        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: {
                order: {
                    include: {
                        client: true
                    }
                }
            }
        });

        if (!payment || !payment.order || !payment.order.client) {
            return new Response('Pago o cliente no encontrado', { status: 404 });
        }

        const { base64, filename } = await generateReceiptPDF(payment, payment.order, payment.order.client);
        const pdfBuffer = Buffer.from(base64, 'base64');

        return new Response(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${filename}"`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

    } catch (error: any) {
        console.error('[receipt-pdf] Error generando PDF:', error.message);
        return new Response(`Error generando PDF: ${error.message}`, { status: 500 });
    }
}
