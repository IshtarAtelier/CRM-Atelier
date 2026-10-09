import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { GiftCardService, GiftCardError } from '@/services/gift-card.service';

export const dynamic = 'force-dynamic';

function responderError(e: unknown) {
    if (e instanceof GiftCardError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[gift-cards/id]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
}

/** PATCH — `{ estado: 'USADA' | 'ACTIVA' | 'ANULADA' }`. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await ctx.params;
        const body = await request.json();
        const card = await GiftCardService.cambiarEstado(id, body.estado, getActor(request));
        return NextResponse.json(card);
    } catch (e) { return responderError(e); }
}
