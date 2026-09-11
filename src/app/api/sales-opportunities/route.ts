import { NextResponse } from 'next/server';
import { serverCache } from '@/lib/cache';
import { getActor } from '@/lib/actor';
import { CierresService, CACHE_CIERRES, esTipoCierre } from '@/services/cierres.service';

/**
 * Oportunidades de Cierre. Toda la lógica vive en `CierresService` (consultas)
 * y en `src/lib/cierres/armado.ts` (reglas puras, probadas por
 * `npm run check:cierres`). Esta ruta valida, llama y responde.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const cached = serverCache.get<unknown>(CACHE_CIERRES);
        if (cached !== null) return NextResponse.json(cached);

        const oportunidades = await CierresService.oportunidades();
        // 120 s > los 60 s de polling: la caché absorbe el request siguiente en
        // vez de expirar justo al llegar.
        serverCache.set(CACHE_CIERRES, oportunidades, 120);
        return NextResponse.json(oportunidades);
    } catch (error) {
        console.error('Error fetching sales opportunities:', error);
        return NextResponse.json({
            error: 'Error al obtener oportunidades de ventas',
            message: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
    }
}

/** El ✓ del panel: finalizar el seguimiento de esa persona. */
export async function POST(req: Request) {
    try {
        const { id, type } = await req.json();
        if (!id || typeof id !== 'string' || !esTipoCierre(type)) {
            return NextResponse.json({ error: 'Faltan parámetros o el tipo es inválido' }, { status: 400 });
        }
        const r = await CierresService.finalizar(id, type, getActor(req));
        serverCache.delete(CACHE_CIERRES);
        return NextResponse.json(r.skipped ? { success: true, skipped: true, message: r.skipped } : { success: true });
    } catch (error) {
        console.error('Error finalizing opportunity:', error);
        return NextResponse.json({
            error: 'Error al finalizar oportunidad',
            message: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
    }
}
