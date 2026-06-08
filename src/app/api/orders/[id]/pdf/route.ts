import { prisma } from '@/lib/db';
import { generateOrderPDF } from '@/lib/order-pdf-generator';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                client: true,
                items: {
                    include: {
                        product: true
                    }
                },
                prescription: true,
                payments: true
            }
        });

        if (!order) {
            return new Response('Pedido no encontrado', { status: 404 });
        }

        // Generamos el PDF en el servidor (Playwright con fallback a jsPDF)
        console.log('[pdf/route] Generating PDF for order:', id);
        const { base64, filename } = await generateOrderPDF(order, order.client);
        const pdfBuffer = Buffer.from(base64, 'base64');
        console.log('[pdf/route] PDF generated:', filename, '| Size:', Math.round(pdfBuffer.length / 1024), 'KB');

        // Retornamos el archivo PDF real directamente al navegador
        return new Response(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${filename}"`
            }
        });
    } catch (error: any) {
        console.error('[pdf/route] Error generando PDF:', error.message, error.stack);
        return new Response(`Error generando PDF: ${error.message}`, { status: 500 });
    }
}
