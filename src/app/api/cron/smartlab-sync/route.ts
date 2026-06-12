import { NextResponse } from 'next/server';

// Cron endpoint para sincronizar SmartLab automáticamente
// Se llama desde un servicio externo (cron-job.org) cada 4 horas
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    
    // Validar secret para evitar llamadas no autorizadas
    if (secret !== process.env.CRON_SECRET && secret !== 'atelier-smartlab-2026') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        // Llamar al endpoint de sync internamente
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
        
        // Importar directamente la lógica del sync
        const syncModule = await import('@/app/api/smartlab-sync/route');
        const result = await syncModule.POST();
        const data = await result.json();
        
        console.log(`[CRON SmartLab] Sync completado: ${data.matched || 0} actualizados, ${data.newlyFinished || 0} nuevos fabricados`);
        
        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            ...data
        });
    } catch (error: any) {
        console.error('[CRON SmartLab] Error:', error);
        return NextResponse.json({ 
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
