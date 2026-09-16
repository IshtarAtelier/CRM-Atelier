import { redirect, notFound } from 'next/navigation';
import { generoDeSlug } from '@/lib/constants/genero-catalogo';

/**
 * `/catalogo/hombre` y `/catalogo/mujer` — la dirección linda del catálogo,
 * la que el bot manda por WhatsApp.
 *
 * No es una tienda paralela: lleva a la tienda YA FILTRADA
 * (`/tienda?genero=homme`), que es donde ya viven las fotos grandes, el precio
 * al día, la oferta, el stock y el botón de comprar. Un catálogo aparte sería
 * una segunda copia del mismo catálogo, y el día que cambia un precio una de
 * las dos miente — que es justo lo que un PDF mandado hace un mes hace.
 */
export const dynamicParams = false;

export function generateStaticParams() {
    return [{ genero: 'hombre' }, { genero: 'mujer' }];
}

export default async function CatalogoPorGenero({ params }: { params: Promise<{ genero: string }> }) {
    const { genero } = await params;
    const elegido = generoDeSlug(genero);
    if (!elegido) notFound();
    redirect(`/tienda?genero=${elegido.id}`);
}
