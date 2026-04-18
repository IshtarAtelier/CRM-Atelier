import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { BillingService } from '@/services/billing.service';

/**
 * POST /api/billing/invoice — Emitir una Factura C para una orden
 * Body: { orderId, docTipo?, docNro?, puntoDeVenta? }
 */
export async function POST(request: Request) {
    try {
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';

        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Solo el administrador puede emitir facturas electrónicas.' }, { status: 403 });
        }

        const body = await request.json();
        const { orderId, account, docTipo, docNro, puntoDeVenta, items, amount } = body;

        if (!orderId) {
            return NextResponse.json({ error: 'orderId es requerido' }, { status: 400 });
        }

        const invoice = await BillingService.createInvoice({
            orderId,
            account: account || 'ISH',
            docTipo: docTipo || 99,
            docNro: docNro || '0',
            puntoDeVenta,
            items,
            amount
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

        const stats = searchParams.get('stats') === 'true';

        if (stats) {
            const result = await BillingService.getMonthlyStats();
            return NextResponse.json(result);
        }

        if (invoiceId) {
            const pdfResult = await BillingService.getInvoicePdfUrl(invoiceId);
            
            if (!pdfResult) {
                return NextResponse.json({ error: 'No se pudo generar el PDF' }, { status: 500 });
            }

            // Si es un data URI (base64), servir directamente como PDF binario
            if (typeof pdfResult === 'string' && pdfResult.startsWith('data:application/pdf;base64,')) {
                const base64Data = pdfResult.replace('data:application/pdf;base64,', '');
                const pdfBuffer = Buffer.from(base64Data, 'base64');
                return new NextResponse(pdfBuffer, {
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `inline; filename="factura-${invoiceId.slice(-6)}.pdf"`,
                    },
                });
            }

            // Si es una URL normal
            return NextResponse.json({ pdfUrl: pdfResult });
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
