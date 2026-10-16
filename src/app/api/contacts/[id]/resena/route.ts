import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { ReviewRequestService } from '@/services/review-request.service';

/**
 * POST /api/contacts/:id/resena — "✅ Ya comentó": el cliente ya dejó su
 * reseña en Google. Marca la ficha (firmado), cierra sus pedidos de reseña
 * abiertos y el robot del 2º pedido no lo vuelve a sugerir.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const actor = getActor(request);
        if (!actor.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        const r = await ReviewRequestService.marcarYaComento(id, actor, 'MANUAL');
        return NextResponse.json({ ok: true, ...r });
    } catch (error: any) {
        const msg = String(error?.message || error);
        return NextResponse.json({ error: msg }, { status: msg.includes('no encontrado') ? 404 : 500 });
    }
}
