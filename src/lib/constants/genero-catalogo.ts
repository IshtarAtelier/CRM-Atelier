/**
 * Los tres géneros del catálogo de la tienda, en un solo lugar.
 *
 * `id` es el valor que viaja en la URL (`/tienda?genero=homme`) y el que
 * entiende `/api/store/products`; `etiqueta` es lo que lee una persona
 * —estaba escrito a mano en el panel de filtros y el chip de "filtro activo"
 * mostraba el id crudo ("homme") a la clienta—; `slug` es la dirección linda
 * que manda el bot por WhatsApp (`/catalogo/hombre`).
 */
export interface GeneroDeCatalogo {
    id: 'femme' | 'homme' | 'no_gender';
    etiqueta: string;
    /** null = no tiene catálogo propio para mandar por WhatsApp. */
    slug: 'mujer' | 'hombre' | null;
}

export const GENEROS_DE_CATALOGO: readonly GeneroDeCatalogo[] = [
    { id: 'femme', etiqueta: 'Femme', slug: 'mujer' },
    { id: 'homme', etiqueta: 'Homme', slug: 'hombre' },
    { id: 'no_gender', etiqueta: 'No Gender', slug: null },
];

export function etiquetaDeGenero(id: string | null | undefined): string {
    if (!id) return '';
    return GENEROS_DE_CATALOGO.find(g => g.id === id)?.etiqueta ?? id;
}

/** De "hombre"/"mujer" (la URL linda) al id que entiende la tienda. */
export function generoDeSlug(slug: string | null | undefined): GeneroDeCatalogo | null {
    if (!slug) return null;
    const pelado = slug.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
    return GENEROS_DE_CATALOGO.find(g => g.slug === pelado) ?? null;
}

/** El id de la tienda para una persona: 'HOMBRE' → 'homme'. */
export function generoDeTiendaSegunPersona(genero: 'HOMBRE' | 'MUJER' | null | undefined): 'homme' | 'femme' | null {
    if (genero === 'HOMBRE') return 'homme';
    if (genero === 'MUJER') return 'femme';
    return null;
}

/**
 * Los tipos de anteojo que se pueden mandar como catálogo aparte.
 *
 * `categoria` es el valor que entiende la tienda (`?categoria=Clip-On`), el
 * mismo de `CATEGORIES` en TiendaClient; `slug` es la dirección linda
 * (`/catalogo/hombre/sol`). Pedido de Ishtar (16/9/2026): "poder enviar los
 * clip-ons o los de sol también", no solo el catálogo entero.
 */
export interface TipoDeCatalogo {
    slug: 'receta' | 'sol' | 'clip-on';
    /** Tal cual lo espera la tienda. */
    categoria: 'Receta' | 'Sol' | 'Clip-On';
    /** Cómo se nombra en una frase: "los anteojos <nombre>". */
    nombre: string;
}

export const TIPOS_DE_CATALOGO: readonly TipoDeCatalogo[] = [
    { slug: 'receta', categoria: 'Receta', nombre: 'de receta' },
    { slug: 'sol', categoria: 'Sol', nombre: 'de sol' },
    { slug: 'clip-on', categoria: 'Clip-On', nombre: 'con clip-on' },
];

export function tipoDeSlug(slug: string | null | undefined): TipoDeCatalogo | null {
    if (!slug) return null;
    // Sin guiones ni tildes: el cliente reenvía el link escrito a mano y
    // "clipon" tiene que valer igual que "clip-on".
    const pelado = slug.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
    return TIPOS_DE_CATALOGO.find(t =>
        t.slug.replace(/-/g, '') === pelado
        || t.categoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '') === pelado,
    ) ?? null;
}

/** De la categoría de la tienda a su dirección linda: "Clip-On" → "clip-on". */
export function slugDeCategoria(categoria: string | null | undefined): TipoDeCatalogo | null {
    if (!categoria) return null;
    const c = String(categoria).toLowerCase().replace(/\s+/g, '');
    return TIPOS_DE_CATALOGO.find(t => t.categoria.toLowerCase().replace(/\s+/g, '') === c
        || t.slug.replace('-', '') === c.replace('-', '')) ?? null;
}

/**
 * La dirección del catálogo para mandar por WhatsApp. Cualquier combinación de
 * género y tipo, y si no hay ninguno, la tienda entera.
 *   ('hombre', 'sol')  → /catalogo/hombre/sol
 *   (null,     'sol')  → /catalogo/sol
 *   ('mujer',  null)   → /catalogo/mujer
 */
export function rutaDeCatalogo(generoSlug: string | null, tipoSlug: string | null): string {
    const partes = [generoSlug, tipoSlug].filter(Boolean);
    return partes.length ? `/catalogo/${partes.join('/')}` : '/tienda';
}
