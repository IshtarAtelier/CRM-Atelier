import { redirect, notFound } from 'next/navigation';
import { GENEROS_DE_CATALOGO, TIPOS_DE_CATALOGO, generoDeSlug, tipoDeSlug } from '@/lib/constants/genero-catalogo';

/**
 * Las direcciones lindas del catálogo, las que el bot manda por WhatsApp:
 *
 *   /catalogo/hombre            todo lo de hombre
 *   /catalogo/mujer/sol         los lentes de sol de mujer
 *   /catalogo/clip-on           los clip-ons, sin filtrar por persona
 *   /catalogo                   la tienda entera
 *
 * No es una tienda paralela: lleva a la tienda YA FILTRADA, que es donde ya
 * viven la foto grande, el precio de hoy, la oferta, el stock y el botón de
 * comprar. Un catálogo aparte sería una segunda copia del mismo catálogo, y el
 * día que cambia un precio una de las dos miente — que es justo lo que le pasa
 * a un PDF mandado hace un mes.
 *
 * El orden de las partes no importa (`/catalogo/sol/hombre` vale igual), y una
 * dirección que no existe da 404 y no una tienda vacía.
 */
export const dynamicParams = false;

export function generateStaticParams() {
    const generos = GENEROS_DE_CATALOGO.filter(g => g.slug).map(g => g.slug as string);
    const tipos = TIPOS_DE_CATALOGO.map(t => t.slug);
    const combos: { partes: string[] }[] = [{ partes: [] }];
    for (const g of generos) {
        combos.push({ partes: [g] });
        for (const t of tipos) combos.push({ partes: [g, t] });
    }
    for (const t of tipos) combos.push({ partes: [t] });
    return combos;
}

export default async function CatalogoPage({ params }: { params: Promise<{ partes?: string[] }> }) {
    const { partes = [] } = await params;
    if (partes.length > 2) notFound();

    let genero: string | null = null;
    let categoria: string | null = null;
    for (const parte of partes) {
        const g = generoDeSlug(parte);
        const t = tipoDeSlug(parte);
        if (g && !genero) genero = g.id;
        else if (t && !categoria) categoria = t.categoria;
        else notFound(); // una parte que no es ni género ni tipo, o repetida
    }

    const query = new URLSearchParams();
    if (genero) query.set('genero', genero);
    if (categoria) query.set('categoria', categoria);
    redirect(query.size ? `/tienda?${query}` : '/tienda');
}
