import { NextResponse } from 'next/server';
import { runAllProviders, LAB_PROVIDERS } from '@/services/lab-providers';
import { sendEmail } from '@/lib/email';
import { ADMIN_ALERT_EMAILS } from '@/lib/constants';
import { prisma } from '@/lib/db';

const LAB_LABELS: Record<string, string> = { OPTOVISION: 'Optovision', GRUPO_OPTICO: 'Grupo Óptico' };

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Alertar cuando un proveedor lleva esta cantidad de días sin correr bien.
const STALE_DAYS = 3;

/**
 * Cron DIARIO de conciliación de costos de laboratorio. Orquesta la capa de
 * proveedores (src/services/lab-providers):
 *   - OPTOVISION: facturas PDF por email (IMAP) → costo real + alertas de sobrecosto
 *   - GRUPO_OPTICO: pedidos vía la API del portal SmartLab → cruce y huérfanos
 * Después re-cruza lo pendiente y controla la salud de cada proveedor: si alguno
 * lleva 3+ días sin una corrida exitosa, avisa por email (el sistema se audita
 * a sí mismo — un pipeline caído en silencio es un agujero de auditoría).
 *
 * Alta en cron-job.org: GET diario a /api/cron/lab-invoices?secret=CRON_SECRET
 * Query params opcionales: &days=35 (ventana IMAP hacia atrás)
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
        const runStart = new Date();
        const results = await runAllProviders({ days });

        // Digest diario pedido por el administrador: cada pedido/factura NUEVO sin
        // venta en el sistema se informa por email con sus pistas, siempre.
        const newOrphans = await prisma.labCostEntry.findMany({
            where: { status: 'UNMATCHED', createdAt: { gte: runStart } },
            orderBy: [{ lab: 'asc' }, { labOrderNumber: 'asc' }],
        });
        if (newOrphans.length > 0) {
            const rows = newOrphans.map((o, i) => `
                <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;font-family:monospace">${o.labOrderNumber}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb">${LAB_LABELS[o.lab] || o.lab}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;font-family:monospace">${o.sourceFile || '—'}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:12px">${o.notes || '—'}</td>
                </tr>`).join('');
            await sendEmail({
                to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
                subject: `🔎 ${newOrphans.length} pedido(s) de laboratorio nuevos SIN venta en el sistema`,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;color:#1f2937">
                        <h2 style="color:#b45309">Pedidos de laboratorio sin venta que los respalde</h2>
                        <p>El cruce diario encontró ${newOrphans.length} pedido(s) nuevos en el laboratorio que no corresponden a ninguna venta del sistema. Revisar: anotar el número en la venta correcta, registrar la postventa, o darlo por conocido.</p>
                        <table style="border-collapse:collapse;width:100%;font-size:13px">
                            <tr style="background:#111827;color:#fff">
                                <th style="padding:8px;text-align:left">Nº operación</th><th style="padding:8px;text-align:left">Lab</th>
                                <th style="padding:8px;text-align:left">Factura lab</th><th style="padding:8px;text-align:left">Pista</th>
                            </tr>${rows}
                        </table>
                        <p style="margin-top:14px"><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar'}/admin/laboratorio/costos">Ver conciliación completa en el CRM</a></p>
                    </div>
                `,
            }).catch(err => console.error('[Cron lab-invoices] Error enviando digest de huérfanos:', err));
        }

        // Watchdog: proveedores caídos hace STALE_DAYS o más
        const stale = LAB_PROVIDERS
            .map(p => ({ name: p.name, description: p.description, days: results.health?.[p.name] ?? null }))
            .filter(p => p.days === null || p.days >= STALE_DAYS);

        if (stale.length > 0) {
            const items = stale.map(p =>
                `<li><strong>${p.name}</strong> (${p.description}): ${p.days === null ? 'nunca corrió bien' : `sin corrida exitosa hace ${p.days} días`}</li>`
            ).join('');
            await sendEmail({
                to: ADMIN_ALERT_EMAILS,
                subject: `⚠️ Conciliación de laboratorio: ${stale.length} fuente(s) sin datos`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
                        <h2 style="color: #d97706;">⚠️ Fuentes de costos de laboratorio caídas</h2>
                        <p>El cruce de costos sigue corriendo, pero estas fuentes no traen datos — la auditoría está incompleta hasta resolverlo:</p>
                        <ul style="line-height: 1.7;">${items}</ul>
                        <p style="font-size: 13px; color: #6b7280;">Causa típica: credencial vencida (IMAP de Gmail / login del portal SmartLab).</p>
                    </div>
                `,
            }).catch(err => console.error('[Cron lab-invoices] Error enviando alerta de salud:', err));
        }

        return NextResponse.json({ ok: true, ...results, stale: stale.map(s => s.name) });
    } catch (error: any) {
        console.error('[Cron lab-invoices] Error:', error);
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
    }
}
