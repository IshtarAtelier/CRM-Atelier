import { NextResponse } from 'next/server';
import { LabCostReconciliationService } from '@/services/lab-cost-reconciliation.service';
import { armarEmailSemanal } from '@/services/lab-recon/weekly-email';
import { sendEmail } from '@/lib/email';
import { ADMIN_ALERT_EMAILS } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Reporte SEMANAL de conciliación de laboratorio (ambos labs). Pensado para
 * correr los viernes/domingos desde cron-job.org y dejar al día la tratativa:
 * facturas que ingresaron en la semana, montos, sobrecostos vigentes y el
 * estado global por lab (con venta / sin venta / esperando factura).
 *
 * El HTML lo arma `armarEmailSemanal` (lab-recon/weekly-email.ts), que es una
 * función pura: acá solo se autentica, se junta el reporte y se manda.
 *
 * GET /api/cron/lab-weekly-report?secret=CRON_SECRET[&days=7]
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
        if (secret !== cronSecret && token !== cronSecret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const days = Math.min(parseInt(searchParams.get('days') || '7', 10) || 7, 60);
        const to = new Date();
        const from = new Date(to.getTime() - days * 86400000);
        const rep = await LabCostReconciliationService.weeklyReport(from, to);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';
        const { subject, html } = armarEmailSemanal(rep, appUrl);

        await sendEmail({
            to: process.env.ADMIN_EMAIL || ADMIN_ALERT_EMAILS,
            subject,
            html,
        });

        return NextResponse.json({
            ok: true, rango: subject,
            optovision: { facturasSemana: rep.perLab.OPTOVISION.facturasSemana, sobrecostos: rep.perLab.OPTOVISION.sobrecostos },
            grupoOptico: { facturasSemana: rep.perLab.GRUPO_OPTICO.facturasSemana, sobrecostos: rep.perLab.GRUPO_OPTICO.sobrecostos },
        });
    } catch (error: any) {
        console.error('[Cron lab-weekly-report] Error:', error);
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
    }
}
