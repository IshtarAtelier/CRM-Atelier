import { NextResponse } from 'next/server';
import { BillingService } from '@/services/billing.service';

/**
 * POST /api/billing/invoice — Emitir una Factura C para una orden
 * Body: { orderId, docTipo?, docNro?, puntoDeVenta? }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { orderId, account, docTipo, docNro, puntoDeVenta } = body;

        if (!orderId) {
            return NextResponse.json({ error: 'orderId es requerido' }, { status: 400 });
        }

        const invoice = await BillingService.createInvoice({
            orderId,
            account: account || 'ISH',
            docTipo: docTipo || 99,
            docNro: docNro || '0',
            puntoDeVenta,
        });

        return NextResponse.json(invoice);
    } catch (error: any) {
        console.error('Error emitiendo factura:', error);
        return NextResponse.json(
            { error: error.message || 'Error al emitir la factura' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/billing/invoice — Obtener facturas de una orden
 * Query: ?orderId=xxx
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get('orderId');
        const invoiceId = searchParams.get('invoiceId');

        if (invoiceId) {
            const pdfUrl = await BillingService.getInvoicePdfUrl(invoiceId);
            return NextResponse.json({ pdfUrl });
        }

        if (orderId) {
            const invoices = await BillingService.getInvoicesByOrder(orderId);
            return NextResponse.json(invoices);
        }

        return NextResponse.json({ error: 'orderId o invoiceId es requerido' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
