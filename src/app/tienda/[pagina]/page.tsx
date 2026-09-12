import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Vitrina } from '../Vitrina';
import { getMappedWebCatalog } from '@/lib/catalog/tienda-map';
import {
  RUTA_TIENDA,
  urlDePagina,
  totalDePaginas,
  MAX_PAGINAS_RESTAURABLES,
} from '@/lib/catalog/paginacion-tienda';

const ORIGEN = 'https://atelieroptica.com.ar';

// Mismo ISR que /tienda: se prerenderiza a pedido y se regenera cada minuto.
export const revalidate = 60;

/**
 * Páginas 2, 3, 4… del catálogo.
 *
 * Por qué existen: el HTML de /tienda enlaza los 24 primeros modelos y el resto
 * aparece apretando "Cargar más". Google no aprieta botones. El sitemap listaba
 * los 112 igual, así que se indexaban — pero sin ningún link interno que los
 * respaldara, y los links internos son lo que reparte autoridad entre las
 * fichas. Las páginas de acá son ese camino: URLs reales, con `<a>` de verdad,
 * que un robot puede recorrer hasta el último modelo.
 *
 * Para la clienta no cambia nada: sigue usando "Cargar más". Estas URLs son
 * igual de usables si cae en una (muestran la vitrina completa, filtros
 * incluidos) y quedan como dirección estable de un tramo del catálogo.
 */

/**
 * El parámetro se valida acá y en un solo lugar: tiene que ser un entero ≥ 2 y
 * no pasarse del catálogo. `/tienda/0`, `/tienda/2.5`, `/tienda/abc` y
 * `/tienda/99` son 404 — no páginas vacías, que Google trata como soft-404.
 */
async function resolverPagina(valor: string): Promise<number> {
  if (!/^[1-9]\d{0,3}$/.test(valor)) notFound();
  const pagina = Number(valor);
  // La página 1 tiene su propia URL. Servirla también acá sería el mismo
  // contenido en dos direcciones, que es justo lo que el canonical evita.
  if (pagina === 1) redirect(RUTA_TIENDA);
  if (pagina > MAX_PAGINAS_RESTAURABLES) notFound();
  const { products } = await getMappedWebCatalog();
  if (pagina > totalDePaginas(products.length)) notFound();
  return pagina;
}

/**
 * Se prerenderizan en el build, como /tienda. Sin esto la ruta quedaba marcada
 * "server-rendered on demand": cada visita del robot rearmaba el catálogo
 * entero. Son cuatro o cinco páginas, así que el costo en el build es nulo.
 *
 * Si el catálogo no está disponible al buildear (la fuente cae a los snapshots
 * commiteados), se devuelve la lista vacía: las páginas se generan a pedido y
 * quedan cacheadas igual. Nunca es motivo de build roto.
 */
export async function generateStaticParams(): Promise<{ pagina: string }[]> {
  try {
    const { products } = await getMappedWebCatalog();
    const paginas = totalDePaginas(products.length);
    return Array.from({ length: Math.max(0, paginas - 1) }, (_, i) => ({ pagina: String(i + 2) }));
  } catch {
    return [];
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ pagina: string }> }
): Promise<Metadata> {
  const { pagina: crudo } = await params;
  const pagina = await resolverPagina(crudo);
  const titulo = `Colección de Anteojos — Página ${pagina}`;
  const descripcion = `Página ${pagina} de la colección completa de anteojos de diseño de Atelier Óptica.`;
  return {
    title: titulo,
    description: descripcion,
    // Canonical a sí misma, NO a /tienda: apuntar todas las páginas a la
    // primera le dice a Google que las demás son duplicados y las saca del
    // índice — con ellas, el camino a los modelos del 25 en adelante.
    alternates: { canonical: `${ORIGEN}${urlDePagina(pagina)}` },
    openGraph: {
      title: titulo,
      description: descripcion,
      url: `${ORIGEN}${urlDePagina(pagina)}`,
      type: 'website',
      images: [{ url: '/images/og-image.jpg', width: 1200, height: 630, alt: 'Anteojos Atelier Óptica' }],
    },
  };
}

export default async function TiendaPaginaPage(
  { params }: { params: Promise<{ pagina: string }> }
) {
  const { pagina: crudo } = await params;
  return <Vitrina pagina={await resolverPagina(crudo)} />;
}
