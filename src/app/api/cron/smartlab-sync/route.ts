import { NextResponse } from 'next/server';
import { SmartLabService } from '@/services/smartlab.service';
import { env } from '@/env';
import { verifyCronAuth } from '@/lib/cron-auth';
import { sendEmail } from '@/lib/email';
import { fetchWa, getAdminChatId } from '@/lib/wa-config';
import { prisma } from '@/lib/db';
import { GrupoOpticoProvider } from '@/services/lab-providers/grupo-optico.provider';
import { LabCostReconciliationService } from '@/services/lab-cost-reconciliation.service';

// Ventana del pase rápido de facturación: lo recién facturado aparece cuando el
// pedido pasa a FINALIZADO en el portal; 21 días dan margen incluso para pedidos
// lentos (la pasada diaria completa cubre cualquier cola más vieja).
const FAST_INVOICE_WINDOW_DAYS = 21;

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

    // Auth por header Bearer (preferido) o ?secret= (fallback cron-job.org), tiempo constante.
    const auth = verifyCronAuth(req);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
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
                // largo como para haber alertado (evita "Restablecido" por micro-cortes).
                // El estado del corte se limpia ANTES de avisar: si el aviso falla
                // (p. ej. wa-service caído), NO se repite "Restablecido" en loop
                // cada 10 minutos — perder un aviso de recuperación es barato,
                // spamear al administrador no.
                if (downSince) await setSetting(KEY_DOWN_SINCE, '');
                if (alertedAt) await setSetting(KEY_ALERTED_AT, '');

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
            } catch (statusError) {
                console.error('[CRON SmartLab] Error procesando estado de restauración:', statusError);
            }
        }

        // PASE RÁPIDO de conciliación de costos (pedido del administrador: revisión
        // cada 10 minutos de todo lo NUEVO facturado por Grupo Óptico). Ventana
        // corta del portal + PDF de comprobantes → completa importes de lo recién
        // FINALIZADO, re-cruza pendientes y dispara las alertas inmediatas
        // (diferencias de costo y pedidos sin venta ni postventa). Tolerante a
        // fallas: nunca rompe el sync de estados que corre arriba.
        let fastReconciliation: Record<string, unknown> | null = null;
        if (!result.skipped) {
            try {
                // El modo silencioso pre-backfill lo decide upsertEntry por lab
                // (isQuietLab): hasta que el cron diario complete el backfill de un
                // lab, sus entradas se estampan sin alertar. Acá solo se corre.
                const collect = await GrupoOpticoProvider.collect({ sinceDays: FAST_INVOICE_WINDOW_DAYS });
                const recheck = await LabCostReconciliationService.recheckUnmatched();
                const alerts = await LabCostReconciliationService.alertNewFindings();
                // Pedidos de Optovision facturados hace 3+ días hábiles → FINISHED
                // (la factura llega unos días antes de que el pedido esté listo).
                const promoted = await LabCostReconciliationService.promoteFinishedOptovision()
                    .catch((err: any) => { console.error('[CRON SmartLab] promoteFinishedOptovision:', err); return { promoted: 0 }; });
                fastReconciliation = { ...collect, recheck, alerts, promoted };

                // Red de seguridad: el backfill (y con él, TODO el régimen de
                // alertas) depende de que el cron diario corra — y su alta en
                // cron-job.org es manual. Si pasadas 24 h desde el primer pase
                // rápido algún lab sigue sin backfill, avisar al administrador
                // (máximo una vez por día) en vez de quedar mudos para siempre.
                try {
                    const pendientes = [];
                    for (const lab of LabCostReconciliationService.BACKFILL_LABS) {
                        if (await LabCostReconciliationService.isQuietLab(lab)) pendientes.push(lab);
                    }
                    if (pendientes.length > 0) {
                        const FIRST_KEY = 'lab_recon_first_fast_pass';
                        const WARN_KEY = 'lab_recon_nodaily_warned_at';
                        const first = await getSetting(FIRST_KEY);
                        if (!first) {
                            await setSetting(FIRST_KEY, new Date().toISOString());
                        } else if (Date.now() - new Date(first).getTime() > 24 * 3600000) {
                            const warned = await getSetting(WARN_KEY);
                            if (!warned || Date.now() - new Date(warned).getTime() > 24 * 3600000) {
                                const r: any = await sendEmail({
                                    to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
                                    subject: '⚠️ Conciliación de laboratorio: el cron diario nunca corrió',
                                    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
                                        <h2 style="color:#d97706">⚠️ Falta la corrida diaria de conciliación</h2>
                                        <p>Pasaron más de 24 horas y el backfill inicial de <strong>${pendientes.join(' y ')}</strong> sigue pendiente: el cron diario <code>/api/cron/lab-invoices</code> no corrió nunca. Hasta que corra, las alertas de costos de esa(s) fuente(s) están en silencio.</p>
                                        <p>Revisar el alta del cron en cron-job.org (GET diario a <code>/api/cron/lab-invoices?secret=…</code>).</p>
                                    </div>`,
                                });
                                if (r?.success) await setSetting(WARN_KEY, new Date().toISOString());
                            }
                        }
                    }
                } catch (warnErr) {
                    console.error('[CRON SmartLab] Aviso de backfill pendiente falló:', warnErr);
                }
                console.log(`[CRON SmartLab] Conciliación rápida: ${collect.withCost || 0} con costo, ` +
                    `${recheck.rematched || 0} re-cruzados, ${alerts.alerted || 0} alerta(s) nueva(s)`);
            } catch (fastErr) {
                console.error('[CRON SmartLab] Conciliación rápida falló (el sync de estados salió bien):', fastErr);
                fastReconciliation = { error: fastErr instanceof Error ? fastErr.message : String(fastErr) };
            }
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            ...result,
            fastReconciliation,
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

                // Enviar alerta por Email. sendEmail no rechaza (devuelve {success:false}):
                // hay que mirar el retorno, si no marcaríamos KEY_ALERTED_AT sin que
                // saliera nada y la próxima alerta recién en 12 h.
                const emailRes = await sendEmail({
                    to: 'pisano.ishtar@gmail.com',
                    subject,
                    text: `Atelier Óptica\n\nLa sincronización con el laboratorio Grupo Óptico lleva ${formatDowntime(downtimeMs)} sin funcionar (desde ${new Date(downSince).toLocaleString('es-AR')}).\n\nÚltimo error: ${errorMessage}\nFecha: ${new Date().toLocaleString('es-AR')}`,
                    html: `<h3 style="color: #d32f2f;">${subject}</h3><p>La sincronización con el laboratorio (Grupo Óptico) lleva <b>${formatDowntime(downtimeMs)}</b> sin funcionar (desde ${new Date(downSince).toLocaleString('es-AR')}).</p><p><b>Último error:</b> ${errorMessage}</p><p><b>Fecha:</b> ${new Date().toLocaleString('es-AR')}</p><p style="color:#888;font-size:12px;">Si sigue caído, recibirás otra alerta en 12 horas. Al recuperarse te llega un aviso de restablecido.</p>`
                }).catch((err: any) => { console.error('[CRON SmartLab] Error email:', err); return { success: false } as any; });

                // Enviar alerta por WhatsApp
                const waRes = await fetchWa('/api/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: getAdminChatId(),
                        message: `⚠️ *Atelier Alerta - SmartLab*\n\nLa sincronización con el laboratorio (Grupo Óptico) lleva *${formatDowntime(downtimeMs)}* sin funcionar.\n\n*Último error:* ${errorMessage}\n\n_Si sigue caído, te aviso de nuevo en 12 hs._`
                    })
                }).then((r: any) => !!r?.ok).catch((err: any) => { console.error('[CRON SmartLab] Error WhatsApp:', err); return false; });

                // Solo registrar el envío si al menos un canal salió (si no, se reintenta).
                if ((emailRes && emailRes.success) || waRes) {
                    console.log('[CRON SmartLab] Alertas enviadas a Ishtar.');
                    await setSetting(KEY_ALERTED_AT, new Date().toISOString());
                } else {
                    console.error('[CRON SmartLab] Alerta de caída NO entregada (email y WhatsApp fallaron): se reintentará.');
                }
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
