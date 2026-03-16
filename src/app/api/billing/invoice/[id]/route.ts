import { NextResponse } from 'next/server';
import { BillingService } from '@/services/billing.service';

/**
 * GET /api/billing/invoice/[id] — Obtener datos de una factura
 * Query: ?pdf=true para obtener la URL del PDF
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const wantPdf = searchParams.get('pdf') === 'true';

        if (wantPdf) {
            const pdfUrl = await BillingService.getInvoicePdfUrl(id);
            if (!pdfUrl) {
                return NextResponse.json({ error: 'No se pudo generar el PDF' }, { status: 500 });
            }
            return NextResponse.json({ pdfUrl });
        }

        const invoice = await BillingService.getInvoice(id);
        if (!invoice) {
            return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
        }

        return NextResponse.json(invoice);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
