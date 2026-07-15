import { NextResponse } from 'next/server';
import { LabCostReconciliationService } from '@/services/lab-cost-reconciliation.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron DIARIO de conciliación de costos de laboratorio. Hace el ciclo completo:
 *   1. Escanea la casilla IMAP buscando facturas PDF de Optovision y registra
 *      el costo facturado por nº de pedido (alerta sobrecostos nuevos).
 *   2. Re-cruza las entradas sin match (facturas que llegaron antes de que se
 *      cargara el nº de pedido en la venta, o números cargados tarde).
 * Si el paso IMAP falla (p. ej. credencial vencida), el re-cruce corre igual.
 *
 * Alta en cron-job.org: GET diario a /api/cron/lab-invoices?secret=CRON_SECRET
 * Query params opcionales: &days=35 (ventana de búsqueda hacia atrás)
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
        }
        if (secret !== cronSecret && token !== cronSecret) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const days = Math.min(parseInt(searchParams.get('days') || '35', 10) || 35, 365);

        let scan: any;
        try {
            scan = await LabCostReconciliationService.scanOptovisionInbox(days);
        } catch (err: any) {
            console.error('[Cron lab-invoices] Falló el escaneo IMAP:', err);
            scan = { error: err?.message || 'Error IMAP' };
        }

        const recheck = await LabCostReconciliationService.recheckUnmatched();

        return NextResponse.json({ ok: true, scan, recheck });
    } catch (error: any) {
        console.error('[Cron lab-invoices] Error:', error);
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
    }
}
