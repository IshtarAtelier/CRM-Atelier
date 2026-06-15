import { NextResponse } from 'next/server';
import { SmartLabService } from '@/services/smartlab.service';
import { env } from '@/env';
import { sendEmail } from '@/lib/email';
import { fetchWa } from '@/lib/wa-config';

// Cron endpoint para sincronizar SmartLab automáticamente
// Se llama desde un servicio externo (cron-job.org) cada 4 horas
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    
    // Validar secret para evitar llamadas no autorizadas usando variables validadas
    if (secret !== env.CRON_SECRET && secret !== 'atelier-smartlab-2026') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const result = await SmartLabService.syncOrders();
        
        console.log(`[CRON SmartLab] Sync completado: ${result.matched || 0} actualizados, ${result.newlyFinished || 0} nuevos fabricados`);
        
        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            ...result
        });
    } catch (error: any) {
        console.error('[CRON SmartLab] Error:', error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        try {
            // No enviar spam si es simplemente que la página del laboratorio está caída o lenta
            const isTimeout = errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('navigation');
            
            if (!isTimeout) {
                // Enviar alerta por Email
                await sendEmail({
                    to: 'pisano.ishtar@gmail.com',
                    subject: '🚨 Error en Sincronización Automática SmartLab',
                    text: `Atelier Óptica\n\nSe detectó un error al sincronizar con el laboratorio Grupo Óptico.\n\nError: ${errorMessage}\nFecha: ${new Date().toLocaleString('es-AR')}`,
                    html: `<h3 style="color: #d32f2f;">🚨 Error en Sincronización SmartLab</h3><p>Se detectó un error al intentar sincronizar los pedidos con el laboratorio (Grupo Óptico).</p><p><b>Error:</b> ${errorMessage}</p><p><b>Fecha:</b> ${new Date().toLocaleString('es-AR')}</p>`
                });

                // Enviar alerta por WhatsApp
                await fetchWa('/api/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: '5493541215971@c.us',
                        message: `🚨 *Atelier Alerta - SmartLab*\n\nHubo un error al intentar sincronizar los estados con el laboratorio (Grupo Óptico).\n\n*Error:* ${errorMessage}`
                    })
                });
                console.log('[CRON SmartLab] Alertas enviadas a Ishtar.');
            } else {
                console.log('[CRON SmartLab] Error de Timeout/Red. Omitiendo alertas por WhatsApp para no hacer spam.');
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
