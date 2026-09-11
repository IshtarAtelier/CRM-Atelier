import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { serverCache } from '@/lib/cache';
import { CierresService, CACHE_CIERRES, esTipoCierre } from '@/services/cierres.service';

/**
 * "Ya le escribí" / seguimiento enviado desde Oportunidades de Cierre. Queda
 * firmado en la ficha y esconde la tarjeta 5 días (ver `CierresService`).
 * `via`: 'whatsapp' (el botón verde, default), 'copia' o 'manual'.
 */
export async function POST(req: Request) {
    try {
        const { id, type, message, via } = await req.json();
        if (!id || typeof id !== 'string' || !esTipoCierre(type)) {
            return NextResponse.json({ error: 'Faltan parámetros o el tipo es inválido' }, { status: 400 });
        }
        const r = await CierresService.registrarEscrito(
            { id, type, via: typeof via === 'string' ? via : undefined, message: typeof message === 'string' ? message : undefined },
            getActor(req),
        );
        // Sin esto la tarjeta seguía en el panel hasta 2 minutos (la caché).
        serverCache.delete(CACHE_CIERRES);
        return NextResponse.json({ success: true, ...r });
    } catch (error) {
        console.error('Error registrando seguimiento de oportunidad:', error);
        return NextResponse.json({ error: 'Error al registrar seguimiento' }, { status: 500 });
    }
}
