import { NextResponse } from 'next/server';
import { runAllProviders, LAB_PROVIDERS } from '@/services/lab-providers';
import { sendEmail } from '@/lib/email';
import { ADMIN_ALERT_EMAILS } from '@/lib/constants';

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
        const results = await runAllProviders({ days });

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
