import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/api-guard';
import { carritoRecuperable } from '@/lib/checkout/recovery';

/**
 * Productos de un carrito abandonado, para reponerlo desde el mail de recupero
 * (GET /api/checkout/recuperar?s=<id de sesión>).
 *
 * Público: la persona llega desde el mail, sin sesión. Devuelve SOLO productos
 * con el precio del armazón de hoy, nunca datos de la persona, y nada si la
 * sesión ya terminó en compra. La lógica vive en src/lib/checkout/recovery.ts.
 */
export async function GET(req: Request) {
    const limitado = enforceRateLimit(req, 'checkout-recuperar', { limit: 20, windowMs: 60_000 });
    if (limitado) return limitado;

    const sessionId = new URL(req.url).searchParams.get('s');
    try {
        const items = await carritoRecuperable(sessionId ?? '');
        return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('[Recupero] No se pudo leer el carrito para reponer:', error);
        return NextResponse.json({ items: [] }, { status: 500 });
    }
}
