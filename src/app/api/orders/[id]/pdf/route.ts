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

        // Generamos el PDF usando Playwright en el servidor
        const { base64, filename } = await generateOrderPDF(order, order.client);
        const pdfBuffer = Buffer.from(base64, 'base64');

        // Retornamos el archivo PDF real directamente al navegador
        return new Response(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${filename}"`
            }
        });
    } catch (error: any) {
        console.error('Error generando PDF:', error);
        return new Response(`Error interno: ${error.message}`, { status: 500 });
    }
}
