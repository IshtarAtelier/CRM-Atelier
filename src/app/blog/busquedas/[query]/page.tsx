import { notFound, permanentRedirect } from 'next/navigation';
import { seoKeywords, destinoDeBusqueda } from '@/lib/seo-keywords';

/**
 * `/blog/busquedas/<keyword>` — 48 páginas que ya no se sirven: redirigen 301.
 *
 * Qué eran: una página por keyword, todas con el mismo molde ("En Atelier somos
 * especialistas. Si estás buscando X, llegaste al lugar indicado") y el mismo
 * par de botones a WhatsApp y a la tienda. Cambiaba el título y poco más. Eso
 * es textualmente lo que las guías de spam de Google llaman doorway pages, y
 * estaban las 48 en el sitemap con priority 0.8 — es decir, ofrecidas para
 * indexar. El riesgo no era perder esas URLs: era la acción manual, que se
 * lleva puesto el rendimiento de TODO el dominio.
 *
 * Por qué 301 y no 410: varias de estas búsquedas ya traen tráfico. La
 * redirección permanente le pasa esa señal a la página real que responde la
 * consulta (el mapa vive en `destinoDeBusqueda`, compartido con el acordeón del
 * blog para que ningún enlace interno apunte a una redirección).
 *
 * Ojo: esta ruta NO puede tener `loading.tsx` — una ruta que redirige o hace
 * 404 con loading se convierte en soft-404 para Google (trampa conocida del
 * proyecto, ver CLAUDE.md).
 */

interface PageProps {
  params: Promise<{ query: string }>;
}

// Sin generateStaticParams: no hay nada que prerenderizar, solo redirecciones.
// `dynamic = 'force-static'` tampoco aplica; Next resuelve el redirect en la
// request y lo cachea igual porque el destino es determinístico.

export default async function BusquedaPage({ params }: PageProps) {
  const { query } = await params;

  // Una keyword que nunca existió es un 404 de verdad, no una redirección a la
  // home: redirigir cualquier basura al índice es otra señal de doorway.
  if (!seoKeywords.includes(query)) {
    notFound();
  }

  permanentRedirect(destinoDeBusqueda(query));
}
