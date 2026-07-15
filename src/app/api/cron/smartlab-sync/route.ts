import { NextResponse } from 'next/server';
import { SmartLabService } from '@/services/smartlab.service';
import { env } from '@/env';
import { sendEmail } from '@/lib/email';
import { fetchWa, getAdminChatId } from '@/lib/wa-config';
import { prisma } from '@/lib/db';

// Política de alertas: avisar recién cuando SmartLab lleva más de 12 horas
// seguidas sin conexión, y repetir como máximo cada 12 horas si sigue caído.
// El estado se persiste en SystemSetting para sobrevivir redeploys.
const DOWN_ALERT_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12 horas caído antes de alertar
const ALERT_REPEAT_MS = 12 * 60 * 60 * 1000;         // repetir alerta cada 12 horas

const KEY_DOWN_SINCE = 'smartlab_down_since';   // ISO de la primera falla del corte actual
const KEY_ALERTED_AT = 'smartlab_alerted_at';   // ISO de la última alerta enviada (vacío = sin alerta)

async function getSetting(key: string): Promise<string | null> {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    return row?.value || null;
}

async function setSetting(key: string, value: string) {
    await prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
    });
}

function formatDowntime(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const mins = Math.round((ms % 3600000) / 60000);
    return hours > 0 ? `${hours} h ${mins} min` : `${mins} min`;
}

// Cron endpoint para sincronizar SmartLab automáticamente
// Se llama desde un servicio externo (cron-job.org) cada 4 horas
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    // Validar secret para evitar llamadas no autorizadas usando variables validadas
    if (secret !== env.CRON_SECRET) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const result = await SmartLabService.syncOrders();

        if (result.skipped) {
            console.log(`[CRON SmartLab] Sync omitido: ${result.reason}`);
        } else {
            console.log(`[CRON SmartLab] Sync completado: ${result.matched || 0} actualizados, ${result.newlyFinished || 0} nuevos fabricados`);

            try {
                const downSince = await getSetting(KEY_DOWN_SINCE);
                const alertedAt = await getSetting(KEY_ALERTED_AT);

                // Avisar la recuperación SOLO si el corte fue lo suficientemente
                // largo como para haber alertado (evita "Restablecido" por micro-cortes)
                if (downSince && alertedAt) {
                    const downtime = Date.now() - new Date(downSince).getTime();

                    await sendEmail({
                        to: 'pisano.ishtar@gmail.com',
                        subject: '✅ SmartLab Restablecido — Grupo Óptico funcionando',
                        text: `Atelier Óptica\n\nLa sincronización con el laboratorio (Grupo Óptico) se ha restablecido correctamente tras ${formatDowntime(downtime)} sin conexión.\n\nÚltimo Sync: exitoso (${result.matched || 0} actualizados, ${result.newlyFinished || 0} nuevos fabricados)\nFecha: ${new Date().toLocaleString('es-AR')}`,
                        html: `<h3 style="color: #2e7d32;">✅ SmartLab Restablecido</h3><p>La sincronización con el laboratorio (Grupo Óptico) se ha restablecido correctamente tras <b>${formatDowntime(downtime)}</b> sin conexión.</p><p><b>Último Sync:</b> exitoso (${result.matched || 0} actualizados, ${result.newlyFinished || 0} nuevos fabricados)</p><p><b>Fecha:</b> ${new Date().toLocaleString('es-AR')}</p>`
                    });

                    await fetchWa('/api/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chatId: getAdminChatId(),
                            message: `✅ *Atelier Restablecido - SmartLab*\n\nLa sincronización con el laboratorio (Grupo Óptico) se ha restablecido correctamente tras ${formatDowntime(downtime)} sin conexión.\n\n*Último Sync:* exitoso (${result.matched || 0} actualizados, ${result.newlyFinished || 0} nuevos fabricados)\n*Fecha:* ${new Date().toLocaleString('es-AR')}`
                        })
                    });

                    console.log('[CRON SmartLab] Alertas de restauración enviadas a Ishtar.');
                } else if (downSince) {
                    console.log('[CRON SmartLab] Recuperado de un corte corto (sin alerta previa) — no se avisa.');
                }

                // Limpiar el estado del corte
                if (downSince) await setSetting(KEY_DOWN_SINCE, '');
                if (alertedAt) await setSetting(KEY_ALERTED_AT, '');
            } catch (statusError) {
                console.error('[CRON SmartLab] Error procesando estado de restauración:', statusError);
            }
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            ...result
        });
    } catch (error: any) {
        console.error('[CRON SmartLab] Error:', error);

        const errorMessage = error instanceof Error ? error.message : String(error);

        try {
            // Registrar el inicio del corte si es la primera falla
            let downSince = await getSetting(KEY_DOWN_SINCE);
            if (!downSince) {
                downSince = new Date().toISOString();
                await setSetting(KEY_DOWN_SINCE, downSince);
            }

            const downtimeMs = Date.now() - new Date(downSince).getTime();
            const alertedAt = await getSetting(KEY_ALERTED_AT);
            const sinceLastAlertMs = alertedAt ? Date.now() - new Date(alertedAt).getTime() : Infinity;

            // Alertar solo si lleva más de 12 h caído, y repetir cada 12 h como máximo
            const shouldAlert = downtimeMs >= DOWN_ALERT_THRESHOLD_MS && sinceLastAlertMs >= ALERT_REPEAT_MS;

            if (shouldAlert) {
                const subject = `⚠️ SmartLab lleva ${formatDowntime(downtimeMs)} sin conexión — Grupo Óptico`;

                // Enviar alerta por Email
                await sendEmail({
                    to: 'pisano.ishtar@gmail.com',
                    subject,
                    text: `Atelier Óptica\n\nLa sincronización con el laboratorio Grupo Óptico lleva ${formatDowntime(downtimeMs)} sin funcionar (desde ${new Date(downSince).toLocaleString('es-AR')}).\n\nÚltimo error: ${errorMessage}\nFecha: ${new Date().toLocaleString('es-AR')}`,
                    html: `<h3 style="color: #d32f2f;">${subject}</h3><p>La sincronización con el laboratorio (Grupo Óptico) lleva <b>${formatDowntime(downtimeMs)}</b> sin funcionar (desde ${new Date(downSince).toLocaleString('es-AR')}).</p><p><b>Último error:</b> ${errorMessage}</p><p><b>Fecha:</b> ${new Date().toLocaleString('es-AR')}</p><p style="color:#888;font-size:12px;">Si sigue caído, recibirás otra alerta en 12 horas. Al recuperarse te llega un aviso de restablecido.</p>`
                });

                // Enviar alerta por WhatsApp
                await fetchWa('/api/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: getAdminChatId(),
                        message: `⚠️ *Atelier Alerta - SmartLab*\n\nLa sincronización con el laboratorio (Grupo Óptico) lleva *${formatDowntime(downtimeMs)}* sin funcionar.\n\n*Último error:* ${errorMessage}\n\n_Si sigue caído, te aviso de nuevo en 12 hs._`
                    })
                });
                console.log('[CRON SmartLab] Alertas enviadas a Ishtar.');

                await setSetting(KEY_ALERTED_AT, new Date().toISOString());
            } else {
                const reason = downtimeMs < DOWN_ALERT_THRESHOLD_MS
                    ? `caído hace ${formatDowntime(downtimeMs)} (< 12 h, aún sin alertar)`
                    : `alerta en cooldown (próxima en ~${Math.round((ALERT_REPEAT_MS - sinceLastAlertMs) / 60000)} min)`;
                console.log(`[CRON SmartLab] Falla registrada — ${reason}.`);
            }
        } catch (alertError) {
            console.error('[CRON SmartLab] No se pudieron enviar las alertas:', alertError);
        }

        return NextResponse.json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
