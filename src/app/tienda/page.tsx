import { TiendaClient } from './TiendaClient';
import { StorefrontFooterStatic } from '@/components/Storefront/StorefrontFooterStatic';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import { getProductAttributes } from '@/utils/product-controllers';
import { getTiendaFiltros } from '@/lib/catalog/sources';
import { getMappedWebCatalog } from '@/lib/catalog/tienda-map';

export const revalidate = 60;

// Sesión OPTICA (mayorista) desde la cookie, server-side. Se usa para el title
// (metadata) y para pasarle isWholesale al footer — la óptica nunca ve Atelier.
async function isOpticaSession(): Promise<boolean> {
  try {
    const token = (await cookies()).get('session')?.value;
    if (!token) return false;
    const payload = await decrypt(token);
    return payload?.role === 'OPTICA';
  } catch {
    return false;
  }
}

// Title condicional por rol: para una óptica el tab dice Cápsula Escarlata.
export async function generateMetadata(): Promise<Metadata> {
  const isOptica = await isOpticaSession();
  if (isOptica) {
    return {
      title: { absolute: 'Catálogo Mayorista · Cápsula Escarlata' },
      robots: { index: false, follow: false },
    };
  }
  return {
    title: 'Colección de Anteojos',
    description: 'Descubrí nuestra colección completa de anteojos de diseño. Marcos premium seleccionados a mano.',
    alternates: {
      canonical: 'https://atelieroptica.com.ar/tienda',
    },
    openGraph: {
      title: 'Colección de Anteojos',
      description: 'Descubrí nuestra colección completa de anteojos de diseño. Marcos premium seleccionados a mano.',
      url: 'https://atelieroptica.com.ar/tienda',
      type: 'website',
      images: [{ url: '/images/blog/mostrador-marmol.webp', width: 1200, height: 630, alt: 'Colección de anteojos de diseño' }],
    },
  };
}

export default async function TiendaPage() {
  const isOptica = await isOpticaSession();

  // 1) Metadatos del sidebar de filtros — fuente resiliente (vivo → memoria →
  //    snapshot): nunca lanza y nunca llega vacía. Ver src/lib/catalog/.
  const { data: filterMetadata } = await getTiendaFiltros();

  const brandsSet = new Set<string>();
  const shapesSet = new Set<string>();
  const materialsSet = new Set<string>();

  filterMetadata.forEach(wp => {
    if (wp.product?.brand) {
      brandsSet.add(wp.product.brand.toUpperCase());
    }
    const modelCode = wp.product?.model || wp.name || '';
    const { shape, material } = getProductAttributes(modelCode, wp.product?.seoTags);
    if (shape) {
      shape.split(',').forEach(s => shapesSet.add(s.trim()));
    }
    if (material) {
      materialsSet.add(material);
    }
  });

  shapesSet.add("XL"); // ensure XL category / shape is available

  const availableBrands = Array.from(brandsSet).sort();
  const availableShapes = Array.from(shapesSet).sort();
  const availableMaterials = Array.from(materialsSet).sort();

  // 2) Primera página de productos para el SSR y el SEO. Mismo catálogo mapeado
  // (y mismo serverCache de 180s) que /api/store/products: una sola copia, con
  // fallback resiliente por debajo — la tienda nunca renderiza vacía.
  const { products: catalog } = await getMappedWebCatalog();

  const mappedInitialProducts = catalog.slice(0, 24);
  const initialTotalCount = catalog.length;

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Colección de Anteojos | Atelier Óptica',
    url: 'https://atelieroptica.com.ar/tienda',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: initialTotalCount,
      itemListElement: mappedInitialProducts.map((p: any, i: number) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://atelieroptica.com.ar/producto/${p.slug || p.id}`,
        name: `${p.brand || 'ATELIER'} ${p.model || ''}`.trim(),
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />
      <TiendaClient
        initialProducts={mappedInitialProducts}
        initialTotalCount={initialTotalCount}
        availableBrands={availableBrands}
        availableShapes={availableShapes}
        availableMaterials={availableMaterials}
        footer={<StorefrontFooterStatic isWholesale={isOptica} />}
      />
    </>
  );
}

// El armado del catálogo mapeado (compartido con /api/store/products) vive en
// src/lib/catalog/tienda-map.ts — una sola definición para página y API.
