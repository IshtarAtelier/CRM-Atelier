import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { avisosDeVinculo } from '@/lib/cristales-web/claves';
import {
    CambioInvalidoError,
    actualizarOpciones,
    candidatosPorGrupo,
    resolverOpcionesDeCristal,
    type CambioOpcion,
} from '@/services/cristales-web.service';

/**
 * Opciones de cristal de "Arma tus lentes" y el producto del sistema que vende
 * cada una (/admin/web → Cristales). Esto decide qué se vende en la web y a qué
 * precio: solo ADMIN, y cada cambio queda en el AuditLog con quién lo hizo.
 * Ver docs/cristales-web.md.
 */
export const dynamic = 'force-dynamic';

function esAdmin(request: Request) {
    return request.headers.get('x-user-role') === 'ADMIN';
}

async function estadoActual() {
    const [opciones, candidatos] = await Promise.all([resolverOpcionesDeCristal(), candidatosPorGrupo()]);
    return {
        opciones: opciones.map(o => ({
            clave: o.clave,
            grupo: o.grupo,
            codigo: o.codigo,
            etiqueta: o.etiqueta,
            descripcion: o.descripcion,
            badge: o.badge,
            destacados: o.destacados,
            orden: o.orden,
            activa: o.activa,
            disponible: o.disponible,
            motivo: o.motivo,
            precio: o.precio,
            productId: o.productId,
            producto: o.producto
                ? { id: o.producto.id, name: o.producto.name?.trim() ?? null, laboratory: o.producto.laboratory, price: o.producto.price, is2x1: o.producto.is2x1 }
                : null,
            avisos: avisosDeVinculo(o.clave, o.producto),
            updatedAt: o.updatedAt,
            updatedBy: o.updatedBy,
        })),
        candidatos,
    };
}

export async function GET(request: Request) {
    if (!esAdmin(request)) {
        return NextResponse.json({ error: 'Solo el administrador puede ver los cristales de la tienda' }, { status: 403 });
    }
    try {
        return NextResponse.json(await estadoActual());
    } catch (error) {
        console.error('[CRISTALES WEB] Error al listar:', error);
        return NextResponse.json({ error: 'No se pudieron leer las opciones de cristal' }, { status: 500 });
    }
}

/**
 * Body: `{ cambios: [{ clave, productId?, etiqueta?, descripcion?, badge?, destacados?, activa? }] }`.
 * Solo toca lo que viene; `productId: null` desvincula (la opción deja de venderse).
 */
export async function PATCH(request: Request) {
    if (!esAdmin(request)) {
        return NextResponse.json({ error: 'Solo el administrador puede cambiar los cristales de la tienda' }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    const cambios: unknown = body?.cambios;
    if (!Array.isArray(cambios) || cambios.length === 0) {
        return NextResponse.json({ error: 'No hay cambios para guardar.' }, { status: 400 });
    }
    if (cambios.length > 50) {
        return NextResponse.json({ error: 'Demasiados cambios en un solo pedido.' }, { status: 400 });
    }
    try {
        const { actualizadas } = await actualizarOpciones(cambios as CambioOpcion[], getActor(request));
        return NextResponse.json({ ok: true, actualizadas, ...(await estadoActual()) });
    } catch (error) {
        if (error instanceof CambioInvalidoError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        console.error('[CRISTALES WEB] Error al guardar:', error);
        return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
    }
}
