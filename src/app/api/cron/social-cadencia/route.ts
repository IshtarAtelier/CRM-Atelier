import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

/**
 * Aviso diario de la cadencia de publicación en redes.
 *
 * Alta en cron-job.org: GET diario a /api/cron/social-cadencia?secret=CRON_SECRET
 *
 * POR QUÉ MANDA MAIL TODOS LOS DÍAS, incluso cuando está todo bien:
 *
 * Este proyecto ya perdió meses de fichas de clientes y semanas de fotos de
 * recetas sin que nadie se enterara. En los dos casos había un sistema que
 * "avisaba si algo fallaba" — y no avisó nunca, porque la falla era el silencio:
 * nada explotaba, simplemente dejaba de pasar lo que tenía que pasar.
 *
 * Una alarma que solo suena cuando hay problema no se puede distinguir de una
 * alarma rota. Una que manda un número todos los días se prueba sola: el día que
 * no llega el mail, ya sabés que algo se cortó.
 *
 * Por eso el asunto lleva SIEMPRE el número: "3 publicaciones en 7 días".
 */

const META_SEMANAL = 3;   // la cadencia que se sostiene, según el plan
const ALERTA_DIAS = 5;    // más de esto sin publicar, el asunto lo grita

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const secret = token || searchParams.get('secret');

        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
        }
        if (secret !== cronSecret) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const fila = await prisma.systemSetting.findUnique({ where: { key: 'social_publicaciones' } });
        let bitacora: any[] = [];
        try {
            bitacora = fila?.value ? JSON.parse(fila.value) : [];
            if (!Array.isArray(bitacora)) bitacora = [];
        } catch {
            bitacora = [];
        }

        const ahora = Date.now();
        const enUltimos = (dias: number) =>
            bitacora.filter(p => new Date(p.fecha).getTime() >= ahora - dias * 86400000).length;

        const ultima = bitacora[0] || null;
        const dias = ultima ? Math.floor((ahora - new Date(ultima.fecha).getTime()) / 86400000) : null;
        const semana = enUltimos(7);
        const mes = enUltimos(30);

        const nuncaSePublico = dias === null;
        const atrasado = nuncaSePublico || dias >= ALERTA_DIAS;

        // El número va SIEMPRE en el asunto: es lo que hace que el mail sirva
        // aunque nadie lo abra.
        // El asunto se lee de reojo en el celular: tiene que sonar natural.
        const plural = (n: number, sing: string, plur: string) => `${n} ${n === 1 ? sing : plur}`;
        const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;

        const asunto = nuncaSePublico
            ? '📣 Redes: todavía no se publicó ninguna pieza'
            : atrasado
                ? `⚠️ Redes: ${plural(dias!, 'día', 'días')} sin publicar · ${plural(semana, 'publicación', 'publicaciones')} en la última semana`
                : `📣 Redes: ${plural(semana, 'publicación', 'publicaciones')} en 7 días · última ${cuando}`;

        const fecha = (iso: string) =>
            new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

        const ultimasFilas = bitacora.slice(0, 5).map(p =>
            `<tr>
                <td style="padding:5px 8px;border:1px solid #e5e7eb">${fecha(p.fecha)}</td>
                <td style="padding:5px 8px;border:1px solid #e5e7eb">${p.pieza || '—'}</td>
                <td style="padding:5px 8px;border:1px solid #e5e7eb">${(p.plataformas || []).join(' + ') || '—'}</td>
             </tr>`).join('');

        const html = `
            <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
                <h2 style="color:${atrasado ? '#b45309' : '#1b6b5a'}">
                    ${nuncaSePublico ? 'Todavía no se publicó nada' : `${semana} publicaciones en los últimos 7 días`}
                </h2>
                <p style="font-size:15px">
                    ${nuncaSePublico
                        ? 'El sistema de publicación está montado pero no registra ninguna pieza publicada.'
                        : `La última fue <strong>${cuando}</strong>. En los últimos 30 días: <strong>${mes}</strong>.`}
                </p>
                ${atrasado ? `
                <p style="background:#fef3c7;padding:12px 14px;border-radius:8px;font-size:14px">
                    La cadencia que se sostiene es de <strong>${META_SEMANAL} por semana</strong>. Menos de eso y el
                    algoritmo deja de mostrar las publicaciones; más, no se mantiene en el tiempo.
                </p>` : ''}
                ${ultimasFilas ? `
                <p style="margin:18px 0 6px;font-weight:bold">Últimas publicaciones</p>
                <table style="border-collapse:collapse;width:100%;font-size:13px">
                    <tr style="background:#f9fafb">
                        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Fecha</th>
                        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Pieza</th>
                        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Dónde</th>
                    </tr>
                    ${ultimasFilas}
                </table>` : ''}
                <p style="margin-top:22px;font-size:12px;color:#6b7280">
                    Este mail llega todos los días, publiques o no. El día que deje de llegar, algo se cortó.
                </p>
            </div>`;

        await sendEmail({
            to: process.env.ADMIN_EMAIL || 'ventas@atelieroptica.com.ar',
            subject: asunto,
            html,
        });

        return NextResponse.json({
            ok: true,
            diasSinPublicar: dias,
            ultimos7: semana,
            ultimos30: mes,
            atrasado,
        });
    } catch (error: any) {
        console.error('[cron social-cadencia] Error:', error?.message);
        return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
    }
}
