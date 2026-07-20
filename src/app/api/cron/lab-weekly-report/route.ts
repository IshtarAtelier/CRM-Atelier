import { NextResponse } from 'next/server';
import { LabCostReconciliationService } from '@/services/lab-cost-reconciliation.service';
import { sendEmail } from '@/lib/email';
import { ADMIN_ALERT_EMAILS } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const LAB_LABELS: Record<string, string> = { OPTOVISION: 'Optovision', GRUPO_OPTICO: 'Grupo Óptico' };
const STATUS_LABEL: Record<string, string> = {
    OK: 'OK', OVERCOST: 'Sobrecosto', UNDERCOST: 'Menor costo', PENDING: 'Esperando factura', UNMATCHED: 'Sin venta',
};
const fmt = (n: number | null | undefined) => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;

/**
 * Reporte SEMANAL de conciliación de laboratorio (ambos labs). Pensado para
 * correr los viernes/domingos desde cron-job.org y dejar al día la tratativa:
 * facturas que ingresaron en la semana, montos, sobrecostos vigentes y el
 * estado global por lab (con venta / sin venta / esperando factura).
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

        const labBlock = (lab: string) => {
            const d = rep.perLab[lab];
            const filas = d.detalleSemana.map((r: any, i: number) => `
                <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;font-family:monospace">${r.labOrderNumber}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb">${r.clientId ? `<a href="${appUrl}/admin/contactos?clientId=${r.clientId}">${r.cliente}</a>` : r.cliente}${r.esPostventa ? ' · <span style="color:#1d4ed8">postventa</span>' : ''}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;font-weight:bold">${fmt(r.billed)}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right">${fmt(r.systemCost)}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;color:${(r.difference || 0) > 100 ? '#b91c1c' : (r.difference || 0) < -100 ? '#059669' : '#6b7280'}">${r.difference == null ? '—' : ((r.difference > 0 ? '+' : '') + fmt(r.difference))}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:12px">${STATUS_LABEL[r.status] || r.status}</td>
                </tr>`).join('');
            return `
                <h3 style="margin-top:24px;color:#111">${LAB_LABELS[lab] || lab}</h3>
                <p style="font-size:13px;color:#4b5563">
                    Facturas esta semana: <strong>${d.facturasSemana}</strong> por <strong>${fmt(d.facturadoSemana)}</strong> ·
                    Estado global: ${d.ok} OK, <span style="color:#b91c1c">${d.sobrecostos} sobrecosto(s)</span>,
                    ${d.menorCosto} menor costo, ${d.esperandoFactura} esperando factura,
                    <span style="color:#b45309">${d.sinVenta} sin venta</span> · Facturado acumulado ${fmt(d.facturadoAcumulado)}
                </p>
                ${d.detalleSemana.length ? `
                <table style="border-collapse:collapse;width:100%;font-size:13px">
                    <tr style="background:#111827;color:#fff">
                        <th style="padding:8px;text-align:left">Nº pedido</th><th style="padding:8px;text-align:left">Cliente</th>
                        <th style="padding:8px;text-align:right">Facturado</th><th style="padding:8px;text-align:right">Sistema</th>
                        <th style="padding:8px;text-align:right">Dif.</th><th style="padding:8px;text-align:left">Estado</th>
                    </tr>${filas}
                </table>` : '<p style="font-size:13px;color:#9ca3af">Sin facturas nuevas en la semana.</p>'}`;
        };

        const rango = `${from.toLocaleDateString('es-AR')} – ${to.toLocaleDateString('es-AR')}`;
        const sobre = rep.sobrecostosVigentes.slice(0, 10);
        const cc = (rep.cuentaCorriente || []);
        const html = `
            <div style="font-family:Arial,sans-serif;max-width:920px;margin:0 auto;color:#1f2937">
                <h2 style="color:#b45309">Reporte semanal de laboratorio (${rango})</h2>
                ${cc.length ? `
                <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:12px;margin-bottom:8px">
                    <strong>Cuenta corriente (deuda al día):</strong>
                    <ul style="margin:6px 0 0;font-size:13px;line-height:1.6">
                        ${cc.map((c: any) => `<li>${LAB_LABELS[c.lab] || c.lab}: <strong>${fmt(c.totalDebt)}</strong> (${c.invoiceCount} facturas, al ${new Date(c.statementDate).toLocaleDateString('es-AR')})</li>`).join('')}
                    </ul>
                </div>` : ''}
                ${sobre.length ? `
                <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:8px">
                    <strong style="color:#b91c1c">${sobre.length} sobrecosto(s) vigente(s) a revisar:</strong>
                    <ul style="margin:6px 0 0;font-size:13px;line-height:1.6">
                        ${sobre.map((s: any) => `<li>${LAB_LABELS[s.lab] || s.lab} · pedido ${s.labOrderNumber} (${s.cliente}): <strong style="color:#b91c1c">+${fmt(s.difference)}</strong></li>`).join('')}
                    </ul>
                </div>` : '<p style="color:#059669">✅ Sin sobrecostos vigentes.</p>'}
                ${labBlock('OPTOVISION')}
                ${labBlock('GRUPO_OPTICO')}
                <p style="margin-top:16px;font-size:13px"><a href="${appUrl}/admin/laboratorio/costos">Ver conciliación completa en el CRM</a></p>
                <p style="font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:12px;margin-top:16px">Atelier Óptica — Reporte semanal de costos de laboratorio</p>
            </div>`;

        await sendEmail({
            to: process.env.ADMIN_EMAIL || ADMIN_ALERT_EMAILS,
            subject: `📊 Reporte semanal de laboratorio (${rango})`,
            html,
        });

        return NextResponse.json({
            ok: true, rango,
            optovision: { facturasSemana: rep.perLab.OPTOVISION.facturasSemana, sobrecostos: rep.perLab.OPTOVISION.sobrecostos },
            grupoOptico: { facturasSemana: rep.perLab.GRUPO_OPTICO.facturasSemana, sobrecostos: rep.perLab.GRUPO_OPTICO.sobrecostos },
        });
    } catch (error: any) {
        console.error('[Cron lab-weekly-report] Error:', error);
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
    }
}
