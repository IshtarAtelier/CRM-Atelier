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
    return GENEROS_DE_CATALOGO.find(g => g.slug === slug.toLowerCase()) ?? null;
}

/** El id de la tienda para una persona: 'HOMBRE' → 'homme'. */
export function generoDeTiendaSegunPersona(genero: 'HOMBRE' | 'MUJER' | null | undefined): 'homme' | 'femme' | null {
    if (genero === 'HOMBRE') return 'homme';
    if (genero === 'MUJER') return 'femme';
    return null;
}
