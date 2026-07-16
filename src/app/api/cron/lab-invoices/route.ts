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
        // venta en el sistema se informa por email URGENTE, clasificado para el
        // triage: posible postventa sin número / posible venta sin número (con el
        // cliente detectado) / dudoso a revisar con urgencia.
        const newOrphans = await prisma.labCostEntry.findMany({
            where: { status: 'UNMATCHED', createdAt: { gte: runStart } },
            orderBy: [{ lab: 'asc' }, { labOrderNumber: 'asc' }],
        });
        if (newOrphans.length > 0) {
            const classified = await Promise.all(newOrphans.map(async (o) => {
                const notes = o.notes || '';
                // 1) Señales de postventa: el portal lo marca reproceso o el nombre lo dice
                if (/reproceso|reclamo|garant[ií]a|cambio\s+(de\s+)?(rx|cristal)/i.test(notes)) {
                    return { o, tipo: 'POSTVENTA', detalle: 'Posible caso de postventa sin nº de operación asignado' };
                }
                // 2) ¿Existe un cliente con ese nombre? → venta a la que falta anotarle el número
                const nameInNote = notes.match(/\(([^,)]{4,60})[,)]/)?.[1]?.trim() || '';
                const words = nameInNote.split(/\s+/).filter(w => w.length >= 3 && !/^\d+$/.test(w)).slice(0, 2);
                if (words.length > 0) {
                    const client = await prisma.client.findFirst({
                        where: { isDeleted: false, AND: words.map(w => ({ name: { contains: w, mode: 'insensitive' as const } })) },
                        select: { id: true, name: true, orders: { where: { isDeleted: false, orderType: 'SALE' }, select: { labOrderNumber: true }, take: 3, orderBy: { createdAt: 'desc' } } },
                    });
                    if (client) {
                        const sinNumero = client.orders.some(v => !v.labOrderNumber?.match(/\d{4,}/));
                        return {
                            o, tipo: 'VENTA_SIN_NUMERO', clientId: client.id,
                            detalle: `Posible venta de «${client.name}»${sinNumero ? ' (tiene venta SIN nº de lab: asignarle este número)' : ''}`,
                        };
                    }
                }
                // 3) Sin explicación → dudoso
                return { o, tipo: 'DUDOSO', detalle: 'DUDOSO — sin cliente ni postventa que lo explique: revisar con urgencia' };
            }));

            const dudosos = classified.filter(c => c.tipo === 'DUDOSO').length;
            const badge: Record<string, string> = {
                POSTVENTA: 'background:#dbeafe;color:#1d4ed8',
                VENTA_SIN_NUMERO: 'background:#fef3c7;color:#92400e',
                DUDOSO: 'background:#fee2e2;color:#b91c1c;font-weight:bold',
            };
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';
            const fmt = (n: number | null) => n ? `$${Math.round(n).toLocaleString('es-AR')}` : '—';
            const rows = classified.map(({ o, tipo, detalle, clientId }: any, i) => `
                <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;font-family:monospace">${o.labOrderNumber}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb">${LAB_LABELS[o.lab] || o.lab}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;font-weight:bold">${fmt(o.billedNet ?? o.billedTotal)}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;font-family:monospace">${o.sourceFile || '—'}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:12px">${o.notes || '—'}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:12px"><span style="padding:2px 8px;border-radius:10px;${badge[tipo]}">${detalle}</span>${clientId ? ` <a href="${appUrl}/admin/contactos?clientId=${clientId}">ver ficha</a>` : ''}</td>
                </tr>`).join('');

            await sendEmail({
                to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
                subject: `🚨 URGENTE: ${newOrphans.length} pedido(s) de lab sin venta en el sistema${dudosos ? ` (${dudosos} dudoso${dudosos > 1 ? 's' : ''})` : ''}`,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;color:#1f2937">
                        <h2 style="color:#b91c1c">🚨 Pedidos de laboratorio sin venta que los respalde</h2>
                        <p>El cruce diario encontró <strong>${newOrphans.length}</strong> pedido(s) nuevos en el laboratorio sin venta en el sistema. Triage sugerido en la última columna: postventa sin número, venta a la que falta anotarle el número, o <strong style="color:#b91c1c">dudoso a revisar con urgencia</strong>.</p>
                        <table style="border-collapse:collapse;width:100%;font-size:13px">
                            <tr style="background:#111827;color:#fff">
                                <th style="padding:8px;text-align:left">Nº operación</th><th style="padding:8px;text-align:left">Lab</th>
                                <th style="padding:8px;text-align:right">Costo real</th><th style="padding:8px;text-align:left">Factura</th>
                                <th style="padding:8px;text-align:left">Pista del portal</th><th style="padding:8px;text-align:left">Clasificación</th>
                            </tr>${rows}
                        </table>
                        <p style="margin-top:14px"><a href="${appUrl}/admin/laboratorio/costos">Ver conciliación completa en el CRM</a></p>
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
