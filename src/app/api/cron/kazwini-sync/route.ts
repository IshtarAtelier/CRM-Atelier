import { NextResponse } from 'next/server';
import { KazwiniSyncService } from '@/services/kazwini-sync.service';
import { env } from '@/env';
import { verifyCronAuth } from '@/lib/cron-auth';

export const maxDuration = 300; // Next.js setting for Vercel/Railway timeout limits (5 minutes)

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get('all') === 'true';
    const markup = parseFloat(searchParams.get('markup') || '1.5');

    // Auth por header Bearer (preferido) o ?secret= (fallback cron-job.org), tiempo constante.
    const auth = verifyCronAuth(req);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
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
