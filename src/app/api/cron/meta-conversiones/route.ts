import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { ADMIN_ALERT_EMAILS } from '@/lib/constants';
import { formatDateTime } from '@/lib/format-date';
import { formatearPrecio } from '@/lib/format-precio';
import { MetaConversionService, type FilaConversion } from '@/services/meta-conversions.service';

export const dynamic = 'force-dynamic';

/**
 * Reintenta las compras que la outbox `MetaConversion` tiene sin entregar a
 * Meta y AVISA por mail (una sola vez por compra) las que ya no van a entrar.
 *
 * Lo dispara `instrumentation.ts` cada 10 minutos, las 24 h: la ventana de
 * Meta es de 7 días y un token caído un viernes a la noche tiene que
 * recuperarse solo el lunes. Regla de Ishtar (25/9/2026): el sistema informa
 * SÍ O SÍ a Meta cada compra; lo que no entra, se ve.
 *
 * GET /api/cron/meta-conversiones  (Authorization: Bearer CRON_SECRET)
 */
export async function GET(request: Request) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
    if (!token || token !== cronSecret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const resumen = await MetaConversionService.reintentarPendientes();

        const paraAvisar = await MetaConversionService.paraAvisar();
        let avisadas = 0;
        if (paraAvisar.length) {
            await avisarPorMail(paraAvisar);
            await MetaConversionService.marcarAvisadas(paraAvisar.map((f) => f.id));
            avisadas = paraAvisar.length;
        }

        if (resumen.revisadas || avisadas) {
            console.log(`[CRON meta-conversiones] ${JSON.stringify({ ...resumen, avisadas })}`);
        }
        return NextResponse.json({ ok: true, ...resumen, avisadas });
    } catch (err: any) {
        console.error('[CRON meta-conversiones] Error:', err);
        return NextResponse.json({ ok: false, error: err?.message || 'Error' }, { status: 500 });
    }
}

const ESTADO_EN_CRIOLLO: Record<string, string> = {
    EXPIRED: 'venció la ventana de 7 días: Meta ya no la acepta',
    REJECTED: 'Meta la rechazó en firme (dato inválido o política)',
    FAILED: 'sigue sin entrar; el sistema la va a seguir intentando',
};

const FUENTE: Record<string, string> = {
    website: 'tienda online',
    physical_store: 'venta del local',
};

/**
 * Un solo mail con todas las compras nuevas que merecen atención. Con FAILED
 * lo más probable es el token del Conversions API (META_ACCESS_TOKEN en
 * Railway): el 10/9/2026 uno de los tokens de Meta se cayó solo y nadie se
 * enteró hasta que fallaron los reportes.
 */
async function avisarPorMail(filas: FilaConversion[]) {
    const app = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';
    const hayFallidas = filas.some((f) => f.status === 'FAILED');
    const filasHtml = filas
        .map(
            (f) => `
            <tr>
                <td style="padding:6px 10px;border-bottom:1px solid #eee"><a href="${app}/admin/ventas?id=${f.orderId}">${f.orderId}</a></td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee">${FUENTE[f.actionSource] ?? f.actionSource}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee">${formatDateTime(f.eventTime)}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${formatearPrecio(f.value)}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee">${ESTADO_EN_CRIOLLO[f.status] ?? f.status} (${f.attempts} intento${f.attempts === 1 ? '' : 's'})</td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#777;font-size:12px">${f.lastError ?? ''}</td>
            </tr>`,
        )
        .join('');

    const html = `
        <div style="font-family:Arial,sans-serif;color:#222;max-width:900px">
            <h2 style="margin:0 0 8px">⚠️ ${filas.length} compra${filas.length === 1 ? '' : 's'} que no ${filas.length === 1 ? 'llegó' : 'llegaron'} a Meta</h2>
            <p style="margin:0 0 14px;color:#555">
                Cada venta se le informa a Meta para que las campañas aprendan quién compra. Estas no entraron.
                ${hayFallidas ? '<br><b>Si hay varias "sigue sin entrar", lo primero es revisar el token del Conversions API (META_ACCESS_TOKEN en Railway): cuando se cae, ninguna compra entra.</b>' : ''}
            </p>
            <table style="border-collapse:collapse;font-size:14px;width:100%">
                <thead><tr style="background:#f5f5f5">
                    <th style="text-align:left;padding:6px 10px">Venta</th>
                    <th style="text-align:left;padding:6px 10px">Canal</th>
                    <th style="text-align:left;padding:6px 10px">Fecha de la compra</th>
                    <th style="text-align:right;padding:6px 10px">Importe</th>
                    <th style="text-align:left;padding:6px 10px">Qué pasó</th>
                    <th style="text-align:left;padding:6px 10px">Detalle técnico</th>
                </tr></thead>
                <tbody>${filasHtml}</tbody>
            </table>
            <p style="margin:14px 0 0;color:#777;font-size:12px">
                Este aviso sale una sola vez por compra. Para ver el estado de todas: <code>node scripts/checks/compras-informadas-a-meta.mjs --prod</code> (solo lee).
            </p>
        </div>`;

    await sendEmail({
        to: ADMIN_ALERT_EMAILS,
        subject: `⚠️ ${filas.length} compra${filas.length === 1 ? '' : 's'} sin informar a Meta`,
        html,
    });
}
