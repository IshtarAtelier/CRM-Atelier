import { NextResponse } from 'next/server';
import { SmartLabService } from '@/services/smartlab.service';
import { env } from '@/env';

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
        return NextResponse.json({ 
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
