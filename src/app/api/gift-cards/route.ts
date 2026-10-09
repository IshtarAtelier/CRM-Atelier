import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { GiftCardService, GiftCardError } from '@/services/gift-card.service';

export const dynamic = 'force-dynamic';

function responderError(e: unknown) {
    if (e instanceof GiftCardError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[gift-cards]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
}

/** GET /api/gift-cards[?q=] — las últimas tarjetas emitidas. */
export async function GET(request: Request) {
    try {
        const q = new URL(request.url).searchParams.get('q');
        const cards = await GiftCardService.listar(getActor(request), q);
        return NextResponse.json({ cards });
    } catch (e) { return responderError(e); }
}

/** POST /api/gift-cards — emite una tarjeta (el código lo genera el service). */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const card = await GiftCardService.crear(body, getActor(request));
        return NextResponse.json(card, { status: 201 });
    } catch (e) { return responderError(e); }
}
