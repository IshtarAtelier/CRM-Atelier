import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { LabCostReconciliationService } from '@/services/lab-cost-reconciliation.service';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/lab-costs/:id — marcar una entrada como RESUELTA a mano, o
 * reabrirla (solo ADMIN). Body: { resuelto: boolean, nota?: string }.
 * Resuelve también a los pedidos hermanos de la misma venta (ver resolver.ts).
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const actor = getActor(request);
        if (actor.role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }
        const { id } = await ctx.params;
        const body = await request.json().catch(() => ({}));
        const resuelto = body?.resuelto !== false;
        const nota = typeof body?.nota === 'string' ? body.nota.slice(0, 500) : null;

        const resultado = await LabCostReconciliationService.resolverEntrada(id, resuelto, nota, actor);
        if (!resultado) return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 });
        return NextResponse.json({ ok: true, resuelto, ...resultado });
    } catch (error: any) {
        console.error('[lab-costs PATCH] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
