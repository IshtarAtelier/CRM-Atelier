import { prisma } from '@/lib/db';
import { generateOrderPDF } from '@/lib/order-pdf-generator';
import { getActor } from '@/lib/actor';

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
                payments: true,
                // Los armazones del pedido: el repaso del PDF sale del mismo
                // resumen que la pantalla, y sin esto del 3º en adelante no
                // aparecía ninguno (las columnas viejas solo llegan a dos).
                frames: { orderBy: { position: 'asc' } },
            }
        });

        if (!order) {
            return new Response('Pedido no encontrado', { status: 404 });
        }

        // Generamos el PDF con jsPDF en el servidor
        console.log('[pdf/route] Generating PDF for order:', id);
        // Si lo baja un vendedor logueado, el PDF sale firmado con su nombre
        // (para ventas manda labSentBy igual — lo resuelve el generador).
        const { base64, filename } = await generateOrderPDF(order, order.client, getActor(request, 'CRM').name);
        const pdfBuffer = Buffer.from(base64, 'base64');
        console.log('[pdf/route] PDF generated:', filename, '| Size:', Math.round(pdfBuffer.length / 1024), 'KB');

        // Retornamos el archivo PDF real directamente al navegador
        return new Response(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${filename}"`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    } catch (error: any) {
        console.error('[pdf/route] Error generando PDF:', error.message, error.stack);
        return new Response(`Error generando PDF: ${error.message}`, { status: 500 });
    }
}
