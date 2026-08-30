import { NextResponse } from 'next/server';
import { BOT_ACTOR } from '@/lib/actor';
import { sendOrderPdf } from '@/lib/checkout/send-order-pdf';

export const dynamic = 'force-dynamic';

/**
 * El bot arma el PDF de un presupuesto/venta y lo manda por WhatsApp. Puerta
 * paralela a src/app/api/orders/[id]/send-pdf/route.ts (la que usa un
 * vendedor logueado desde el panel) — misma lógica compartida en
 * src/lib/checkout/send-order-pdf.ts, acá solo cambia el actor (BOT_ACTOR,
 * no un humano) y la autenticación (BOT_API_KEY vía middleware, no sesión).
 *
 * `text` lo arma el bot en criollo para acompañar el PDF (lo que el cliente
 * lee en el chat); el detalle del PDF en sí sale siempre de generateOrderPDF
 * — el LLM nunca calcula ni redacta los montos del documento.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: orderId } = await params;
        const { formattedPhone, text } = await request.json();

        if (!formattedPhone || !text) {
            return NextResponse.json({ error: 'Faltan parámetros (formattedPhone o text)' }, { status: 400 });
        }

        const result = await sendOrderPdf(orderId, { formattedPhone, text, actor: BOT_ACTOR });
        if (!result.ok) {
            return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
        }
        return NextResponse.json(
            result.method === 'media'
                ? { success: true, method: 'media', via: result.via, email: result.email }
                : { success: true, method: 'link' },
        );
    } catch (error: any) {
        console.error('[bot send-pdf] Error:', error.message, error.stack);
        return NextResponse.json({ error: `Error interno: ${error.message}` }, { status: 500 });
    }
}
