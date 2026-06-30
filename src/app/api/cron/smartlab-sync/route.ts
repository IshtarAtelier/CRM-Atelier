import { NextResponse } from 'next/server';
import { SmartLabService } from '@/services/smartlab.service';
import { env } from '@/env';
import { sendEmail } from '@/lib/email';
import { fetchWa, getAdminChatId } from '@/lib/wa-config';
import { prisma } from '@/lib/db';

// Cooldown para alertas de timeout/red: avisar máximo 1 vez cada 2 horas
let lastTimeoutAlertAt: number | null = null;
const TIMEOUT_ALERT_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 horas

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
                // Verificar si el estado anterior era fallido
                const lastSyncStatus = await prisma.systemSetting.findUnique({
                    where: { key: 'smartlab_last_sync_failed' }
                });
                const wasFailed = lastSyncStatus?.value === 'true';

                if (wasFailed) {
                    // Enviar aviso de restauración por Email
                    await sendEmail({
                        to: 'pisano.ishtar@gmail.com',
                        subject: '✅ SmartLab Restablecido — Grupo Óptico funcionando',
                        text: `Atelier Óptica\n\nLa sincronización con el laboratorio (Grupo Óptico) se ha restablecido correctamente.\n\nÚltimo Sync: exitoso (${result.matched || 0} actualizados, ${result.newlyFinished || 0} nuevos fabricados)\nFecha: ${new Date().toLocaleString('es-AR')}`,
                        html: `<h3 style="color: #2e7d32;">✅ SmartLab Restablecido</h3><p>La sincronización con el laboratorio (Grupo Óptico) se ha restablecido correctamente.</p><p><b>Último Sync:</b> exitoso (${result.matched || 0} actualizados, ${result.newlyFinished || 0} nuevos fabricados)</p><p><b>Fecha:</b> ${new Date().toLocaleString('es-AR')}</p>`
                    });

                    // Enviar aviso de restauración por WhatsApp
                    await fetchWa('/api/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chatId: getAdminChatId(),
                            message: `✅ *Atelier Restablecido - SmartLab*\n\nLa sincronización con el laboratorio (Grupo Óptico) se ha restablecido correctamente.\n\n*Último Sync:* exitoso (${result.matched || 0} actualizados, ${result.newlyFinished || 0} nuevos fabricados)\n*Fecha:* ${new Date().toLocaleString('es-AR')}`
                        })
                    });
                    
                    console.log('[CRON SmartLab] Alertas de restauración enviadas a Ishtar.');
                }

                // Guardar/actualizar estado a OK (false)
                await prisma.systemSetting.upsert({
                    where: { key: 'smartlab_last_sync_failed' },
                    update: { value: 'false' },
                    create: { key: 'smartlab_last_sync_failed', value: 'false' }
                });
            } catch (statusError) {
                console.error('[CRON SmartLab] Error procesando estado de restauración:', statusError);
            }
        }
        
        // Si sincronizó bien, resetear el cooldown de timeout para que la próxima caída avise de nuevo
        if (!result.skipped) lastTimeoutAlertAt = null;

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            ...result
        });
    } catch (error: any) {
        console.error('[CRON SmartLab] Error:', error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        try {
            // Guardar/actualizar estado a fallido (true)
            await prisma.systemSetting.upsert({
                where: { key: 'smartlab_last_sync_failed' },
                update: { value: 'true' },
                create: { key: 'smartlab_last_sync_failed', value: 'true' }
            }).catch(err => console.error('[CRON SmartLab] Error al guardar estado fallido en SystemSetting:', err));

            const isTimeout = errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('navigation');
            
            // Para errores de timeout/red: alertar solo si pasaron más de 2 horas desde la última alerta
            // Para otros errores: alertar siempre
            const shouldAlert = !isTimeout || !lastTimeoutAlertAt || (Date.now() - lastTimeoutAlertAt) >= TIMEOUT_ALERT_COOLDOWN_MS;

            if (shouldAlert) {
                const subject = isTimeout
                    ? '⚠️ SmartLab no responde — Grupo Óptico caído'
                    : '🚨 Error en Sincronización Automática SmartLab';
                const waEmoji = isTimeout ? '⚠️' : '🚨';

                // Enviar alerta por Email
                await sendEmail({
                    to: 'pisano.ishtar@gmail.com',
                    subject,
                    text: `Atelier Óptica\n\nSe detectó un error al sincronizar con el laboratorio Grupo Óptico.\n\nError: ${errorMessage}\nFecha: ${new Date().toLocaleString('es-AR')}`,
                    html: `<h3 style="color: #d32f2f;">${subject}</h3><p>Se detectó un error al intentar sincronizar los pedidos con el laboratorio (Grupo Óptico).</p><p><b>Error:</b> ${errorMessage}</p><p><b>Fecha:</b> ${new Date().toLocaleString('es-AR')}</p>${isTimeout ? '<p style="color:#888;font-size:12px;">Si el problema persiste, recibirás otra alerta en 2 horas.</p>' : ''}`
                });

                // Enviar alerta por WhatsApp
                await fetchWa('/api/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: getAdminChatId(),
                        message: `${waEmoji} *Atelier Alerta - SmartLab*\n\nHubo un error al intentar sincronizar los estados con el laboratorio (Grupo Óptico).\n\n*Error:* ${errorMessage}${isTimeout ? '\n\n_Si sigue caído, te aviso de nuevo en 2hs._' : ''}`
                    })
                });
                console.log('[CRON SmartLab] Alertas enviadas a Ishtar.');

                if (isTimeout) lastTimeoutAlertAt = Date.now();
            } else {
                const minsLeft = Math.round((TIMEOUT_ALERT_COOLDOWN_MS - (Date.now() - lastTimeoutAlertAt!)) / 60000);
                console.log(`[CRON SmartLab] Timeout/Red — alerta en cooldown (próxima en ~${minsLeft} min).`);
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
