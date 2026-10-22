import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { InvoiceRequestService, SolicitudFacturaError } from '@/services/invoice-request.service';

/**
 * POST /api/billing/invoice-request — el vendedor pide una factura.
 * Body: { orderId, monto, cliente?: { nombre, dni }, datosConfirmados, observaciones? }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const notification = await InvoiceRequestService.solicitar(
            {
                orderId: String(body.orderId || ''),
                monto: Number(body.monto),
                cliente: body.cliente && typeof body.cliente.nombre === 'string'
                    ? { nombre: body.cliente.nombre, dni: typeof body.cliente.dni === 'string' ? body.cliente.dni : null }
                    : null,
                datosConfirmados: body.datosConfirmados === true,
                observaciones: typeof body.observaciones === 'string' ? body.observaciones : null,
            },
            getActor(request),
        );
        return NextResponse.json(notification);
    } catch (error: any) {
        if (error instanceof SolicitudFacturaError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('[invoice-request]', error);
        return NextResponse.json({ error: 'No se pudo enviar la solicitud de factura.' }, { status: 500 });
    }
}
