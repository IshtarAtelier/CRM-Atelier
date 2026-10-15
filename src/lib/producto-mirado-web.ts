/**
 * QUÉ PRODUCTO MIRABA quien escribió desde la tienda.
 *
 * Plan de la tienda del 15/10/2026 (3.7): el origen "Tienda online" se
 * asignaba solo, pero no contaba QUÉ miró la persona. El dato ya viaja en el
 * primer mensaje: los botones de la ficha de producto escriben "Tengo dudas
 * sobre el modelo Victoria C7", "Quiero comprar el anteojo Atelier Victoria
 * C7 — $145.000…", "Quiero consultar las medidas del anteojo …", y el link
 * de la ficha va pegado al final (atelieroptica.com.ar/producto/<slug>).
 * Acá se lee de vuelta, sin base y sin IA, para la ficha y para Cierres.
 *
 * Sin columna nueva a propósito: se calcula al leer, así vale también para
 * los chats de antes de hoy. Si un día hace falta persistirlo, el lugar es
 * una columna en Client y este helper sigue siendo la única lectura.
 */

export interface ProductoMirado {
    /** Como lo nombró el mensaje ("Victoria C7", "Atelier Victoria C7"). */
    nombre: string;
    /** Slug de la ficha de la tienda, si el mensaje traía el link. */
    slug?: string;
}

/** Hasta dónde llega el nombre del modelo dentro de la frase. */
const CORTE = /(?:\s+(?:—|-|\(|y me gustar)|\s*[.,?!]|\s*$)/;

const PATRONES: RegExp[] = [
    /dudas sobre el modelo\s+(.+)/i,
    /consulta mayorista sobre el modelo\s+(.+)/i,
    /quiero comprar el anteojo\s+(.+)/i,
    /consultar las medidas del anteojo\s+(.+)/i,
];

function limpiar(nombre: string): string {
    return nombre.split(CORTE)[0].replace(/\s+/g, ' ').trim().slice(0, 60);
}

/** Qué producto nombra UN mensaje, o null si no nombra ninguno. */
export function productoMiradoEnMensaje(texto: string | null | undefined): ProductoMirado | null {
    const t = (texto || '').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    const link = t.match(/atelieroptica\.com\.ar\/producto\/([a-z0-9-]+)/i);
    const slug = link ? link[1].toLowerCase() : undefined;
    for (const re of PATRONES) {
        const m = t.match(re);
        if (m) {
            const nombre = limpiar(m[1]);
            if (nombre) return slug ? { nombre, slug } : { nombre };
        }
    }
    // Solo el link, sin frase (la persona borró el texto precargado): el slug
    // legible alcanza ("victoria-c7" → "victoria c7").
    if (slug) return { nombre: slug.replace(/-/g, ' '), slug };
    return null;
}

/** El primer producto que nombran los mensajes, en orden. */
export function productoMiradoEnMensajes(mensajes: (string | null | undefined)[]): ProductoMirado | null {
    for (const m of mensajes) {
        const p = productoMiradoEnMensaje(m);
        if (p) return p;
    }
    return null;
}

/** Texto corto para una tarjeta o un chip: "miraba Victoria C7". */
export function etiquetaMiraba(p: ProductoMirado | null | undefined): string {
    return p ? `miraba ${p.nombre}` : '';
}

/** Filtro de Prisma: los entrantes que PUEDEN nombrar un producto (para no traer el chat entero). */
export const FILTRO_MENSAJES_CON_PRODUCTO = {
    OR: [
        { content: { contains: 'sobre el modelo', mode: 'insensitive' as const } },
        { content: { contains: 'el anteojo', mode: 'insensitive' as const } },
        { content: { contains: '/producto/', mode: 'insensitive' as const } },
    ],
};
