import { NextResponse } from 'next/server';
import { mapaOpcionesPublico } from '@/services/cristales-web.service';
import type { OpcionCristalWeb } from '@/lib/cristales-web/claves';

/**
 * Precios de los cristales del configurador "Arma tus lentes".
 *
 * Público (el middleware deja pasar /api/web/). Devuelve lo que resolvió el
 * service: por opción, título, precio y si está disponible. Nunca un número
 * de respaldo: si una opción no tiene producto vinculado viaja como
 * `disponible: false` y el configurador no la ofrece.
 *
 * `force-dynamic`: cada carga lee la base, así un cambio de precio en el CRM
 * se ve en la siguiente visita. Si la base no responde, 503 y el configurador
 * avisa que no pudo cargar los precios (antes mostraba una tabla inventada).
 */
export const dynamic = 'force-dynamic';

/** El mapa numérico que consumía la versión anterior del configurador (compatibilidad durante el rollout). */
function mapaNumericoAnterior(opciones: OpcionCristalWeb[]) {
    const grupos: Record<string, Record<string, number>> = { MONOFOCAL: {}, BIFOCAL: {}, MULTIFOCAL: {}, EXTRAS: {} };
    for (const o of opciones) {
        if (!o.disponible || o.precio === null) continue;
        if (o.grupo === 'TENIDO') {
            if (o.codigo === 'COMPACTO') grupos.EXTRAS.TINT = o.precio;
        } else {
            grupos[o.grupo][o.codigo] = o.precio;
        }
    }
    return grupos;
}

export async function GET() {
    try {
        const mapa = await mapaOpcionesPublico();
        const opciones = Object.values(mapa).filter((o): o is OpcionCristalWeb => !!o);
        return NextResponse.json(
            { opciones, ...mapaNumericoAnterior(opciones) },
            { headers: { 'Cache-Control': 'no-store' } },
        );
    } catch (error) {
        console.error('[WEB PRICING] No se pudieron resolver las opciones de cristal:', error);
        return NextResponse.json({ error: 'No se pudieron leer los precios de los cristales' }, { status: 503 });
    }
}
