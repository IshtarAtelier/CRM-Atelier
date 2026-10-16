/**
 * Qué productos de una categoría de ARMAZÓN (receta, sol, clip-on) puede
 * ofrecer el bot de WhatsApp — para cotizar Y para mandar fotos.
 *
 * POR QUÉ un solo resolvedor (auditoría del 10/10/2026): `/api/bot/pricing`
 * tenía dos universos distintos para la misma pregunta.
 *   - `get_price_list` (cotizar) buscaba los clip-on por "clip" en nombre o
 *     marca, y encontraba "Classic" (marca Clip-on, NO publicado en la
 *     tienda): $200.000 de lista / $170.000 de contado.
 *   - `send_product_photos` (fotos, `paraFotos=1`) usaba la categoría de la
 *     tienda (`WebProduct.category = 'Clip-On'`) y encontraba Cápsula
 *     Escarlata: $175.000 / $148.750.
 * El mismo cliente podía recibir dos precios de clip-on en la misma charla.
 *
 * Criterio: lo que el bot ofrece es lo PUBLICADO en la tienda, en la misma
 * categoría que ve el cliente en la web. Un producto que no está publicado no
 * se cotiza por el bot (para eso está el local). El stock (> 0) se sigue
 * exigiendo solo para las fotos, como hasta ahora (16/9/2026): cotizar algo
 * sin stock es una decisión de negocio que no se toma acá.
 *
 * Los CRISTALES no pasan por acá: tienen su propio camino (receta, rango, tipo).
 *
 * Puro (arma filtros, no consulta): lo fija `npm run check:catalogo-bot`.
 */

/** Categorías del bot que son armazones → la categoría de la tienda (`WebProduct.category`). */
export const CATEGORIA_DE_TIENDA = {
    ARMAZON: 'Receta',
    SOL: 'Sol',
    CLIPON: 'Clip-On',
} as const;

export type CategoriaDeArmazon = keyof typeof CATEGORIA_DE_TIENDA;

export function esCategoriaDeArmazon(c: string | null | undefined): c is CategoriaDeArmazon {
    return !!c && Object.prototype.hasOwnProperty.call(CATEGORIA_DE_TIENDA, c);
}

/** "clip on", "clipon", "clip-on", "clipones", "clips" → es un pedido de clip-on. */
function pideClipOn(search: string | null | undefined): boolean {
    const limpio = (search || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return limpio.includes('clip');
}

/**
 * Normaliza lo que mandó el modelo.
 *
 * - Si buscó "clip" (con o sin categoría), la categoría es CLIPON y el texto se
 *   DESCARTA: ningún clip-on publicado se llama "clip" (se llaman Torino,
 *   Milano, Cápsula Escarlata…), así que buscar "clip" solo encuentra filas
 *   viejas no publicadas — que es cómo aparecía "Classic".
 *
 * @returns la categoría efectiva (en mayúsculas) y el texto a buscar (o null)
 */
export function resolverPedidoDelBot(category: string | null | undefined, search: string | null | undefined): {
    categoria: string | null;
    search: string | null;
} {
    const cat = category ? category.toUpperCase() : null;
    const texto = search?.trim() || null;
    if (pideClipOn(texto) && (!cat || cat === 'CLIPON' || esCategoriaDeArmazon(cat))) {
        return { categoria: 'CLIPON', search: null };
    }
    return { categoria: cat, search: texto };
}

/**
 * Los filtros de Prisma (`Product`) del universo que el bot puede ofrecer en
 * una categoría de armazón. Iguales para cotizar y para fotos.
 */
export function filtrosDeArmazonDelBot(categoria: CategoriaDeArmazon) {
    return [
        { publishToWeb: true },
        { webProducts: { some: { category: CATEGORIA_DE_TIENDA[categoria], isActive: true } } },
        // Una fila sin precio no es un producto que se pueda ofrecer.
        { price: { gt: 1 } },
    ];
}
