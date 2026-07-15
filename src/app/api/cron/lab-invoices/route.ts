import { NextResponse } from 'next/server';
import { LabCostReconciliationService } from '@/services/lab-cost-reconciliation.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron de conciliación de costos de laboratorio.
 * Escanea la casilla IMAP buscando facturas PDF de Optovision, registra el costo
 * facturado por nº de pedido en LabCostEntry y alerta sobrecostos vs. el costo
 * de lista del CRM. Pensado para correr 1 vez por día desde cron-job.org.
 *
 * Query params: ?secret=CRON_SECRET (o header Authorization: Bearer)
 *               &days=35 (ventana de búsqueda hacia atrás, opcional)
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
        const result = await LabCostReconciliationService.scanOptovisionInbox(days);

        return NextResponse.json({ ok: true, ...result });
    } catch (error: any) {
        console.error('[Cron lab-invoices] Error:', error);
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
    }
}
