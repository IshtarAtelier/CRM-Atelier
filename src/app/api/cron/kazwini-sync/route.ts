import { NextResponse } from 'next/server';
import { KazwiniSyncService } from '@/services/kazwini-sync.service';
import { env } from '@/env';

export const maxDuration = 300; // Next.js setting for Vercel/Railway timeout limits (5 minutes)

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    const all = searchParams.get('all') === 'true';
    const markup = parseFloat(searchParams.get('markup') || '1.5');
    
    // Validate secret to prevent unauthorized executions
    if (secret !== env.CRON_SECRET) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        console.log(`[CRON Kazwini] Starting automatic sync task. all=${all}, markup=${markup}`);
        const result = await KazwiniSyncService.syncProducts({
            crawlAll: all,
            markup: markup
        });
        
        console.log(`[CRON Kazwini] Completed. Published: ${result.publishedCount}, Deactivated (stock < 20): ${result.deactivatedCount}`);

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            ...result
        });
    } catch (error: any) {
        console.error('[CRON Kazwini] Error executing sync:', error);
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
