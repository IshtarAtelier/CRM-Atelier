import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';
import { serverCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

// GET /api/contacts/attention-count
// Cantidad de contactos sin atender (sin presupuesto ni venta) — badge del sidebar
// y contador del filtro "Sin atender". Definición centralizada en ContactService.
// Se cachea 60s: es un count relacional (none) sobre Client (~1000+ filas) que el
// sidebar pollea cada 30s por cada pestaña abierta. Sin caché cada tab recalculaba
// el anti-join contra Order. La staleza de hasta 1 min en el badge es irrelevante.
export async function GET() {
    try {
        const cacheKey = 'contacts-attention-count';
        const cached = serverCache.get<number>(cacheKey);
        if (cached !== null) {
            return NextResponse.json({ count: cached });
        }

        const count = await ContactService.getUnattendedCount();
        serverCache.set(cacheKey, count, 60);
        return NextResponse.json({ count });
    } catch (error: any) {
        console.error('[CONTACTS ATTENTION COUNT] Error:', error);
        return NextResponse.json({ count: 0 }, { status: 500 });
    }
}
