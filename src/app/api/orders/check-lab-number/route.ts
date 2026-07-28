import { NextResponse } from 'next/server';
import { findLabNumberConflicts, duplicateMessage, parseLabNumbers } from '@/lib/lab-order-numbers';

export const dynamic = 'force-dynamic';

/**
 * Chequeo EN VIVO del nº de operación mientras se tipea: dice si ese número ya
 * está usado en otra venta o en un reproceso de postventa, antes de guardar.
 * El bloqueo de verdad vive en el servidor (order.service / smartlab-submit);
 * esto es para que la vendedora se entere en el momento y no después.
 *
 * GET /api/orders/check-lab-number?numero=588049&orderId=<el que se edita>
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const numero = searchParams.get('numero') || '';
        const orderId = searchParams.get('orderId');

        if (parseLabNumbers(numero).length === 0) {
            return NextResponse.json({ duplicado: false, conflictos: [], mensaje: '' });
        }

        const conflictos = await findLabNumberConflicts({ value: numero, excludeOrderId: orderId });
        return NextResponse.json({
            duplicado: conflictos.length > 0,
            conflictos,
            mensaje: duplicateMessage(conflictos),
        });
    } catch (error: any) {
        console.error('[check-lab-number] Error:', error);
        // Ante una falla del chequeo NO se dice "está libre": se responde sin
        // veredicto y el guardado queda a cargo del bloqueo del servidor.
        return NextResponse.json({ error: 'No se pudo verificar el número' }, { status: 500 });
    }
}
