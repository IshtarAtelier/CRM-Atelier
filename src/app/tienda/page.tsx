import { TiendaClient } from './TiendaClient';
import { PieSegunSesion } from './PieSegunSesion';
import { Metadata } from 'next';
import { getProductAttributes } from '@/utils/product-controllers';
import { getTiendaFiltros } from '@/lib/catalog/sources';
import { getMappedWebCatalog } from '@/lib/catalog/tienda-map';

// ISR de verdad: la página se prerenderiza y se regenera cada minuto.
//
// Antes este `revalidate` no hacía nada, por dos motivos que marcaban la ruta
// como dinámica:
//   1. `cookies()` — se leía la sesión para saber si quien mira es una óptica
//      mayorista (título del tab, pie sin marca Atelier). Ahora eso lo resuelve
//      PieSegunSesion en el cliente, como el resto del rebrandeo mayorista que
//      TiendaClient ya venía haciendo ahí.
//   2. `searchParams` — la categoría de ?categoria= se resolvía en el servidor.
//      No hay forma de conservar eso y tener ISR: una página estática sirve el
//      mismo HTML para todas las querystrings. La categoría la aplica ahora
//      TiendaClient al hidratar (ya leía los otros cinco filtros de la URL así).
//      Contrapartida: el HTML inicial de /tienda?categoria=Sol trae la vitrina
//      completa y la grilla se recorta un instante después. Para tráfico e
//      indexación de una categoría sola están /lentes-de-sol y /receta, que sí
//      son URLs propias y siguen saliendo enteras del servidor.
export const revalidate = 60;

export const metadata: Metadata = {
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
    // La misma imagen que el home: el ATELIER grabado en la varilla. Es la
    // única del sitio que ya viene en 1200×630 (el formato que usan WhatsApp,
    // Instagram y Facebook). La anterior —mostrador-marmol— es vertical
    // (1600×2842) aunque el código declarara 1200×630: al compartir el link,
    // WhatsApp la recortaba y se veían las flores y el frasco de caramelos.
    images: [{ url: '/images/og-image.jpg', width: 1200, height: 630, alt: 'Anteojos Atelier Óptica' }],
  },
};

export default async function TiendaPage() {
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

  // F1-02: los conteos por opción para el PRIMER pintado.
  //
  // El cliente los recibe del endpoint en cada filtrado, pero la primera carga
  // no llama al endpoint a propósito (el servidor ya mandó los productos, ver
  // la guarda `isFirstRenderWithInitialData` en TiendaClient). Sin esto, quien
  // abre el panel sin haber filtrado todavía no ve ningún número — justo la
  // primera vez, que es cuando más orienta. El plan pide calcularlos acá, en el
  // Server Component.
  //
  // Sin filtros aplicados, el conteo de cada opción es simplemente cuántos hay
  // en todo el catálogo: no hay "otros filtros activos" contra los cuales
  // acotar. Por eso acá alcanza con contar, sin replicar la lógica de facetas
  // del endpoint.
  const contarCatalogoPor = (campo: 'brand' | 'shape' | 'material') => {
    const cuenta: Record<string, number> = {};
    for (const p of catalog) {
      const valor = (p as any)[campo];
      if (!valor) continue;
      cuenta[String(valor)] = (cuenta[String(valor)] || 0) + 1;
    }
    return cuenta;
  };
  const initialConteos = {
    marca: contarCatalogoPor('brand'),
    forma: contarCatalogoPor('shape'),
    material: contarCatalogoPor('material'),
  };

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Colección de Anteojos | Atelier Óptica',
    url: 'https://atelieroptica.com.ar/tienda',
    mainEntity: {
      '@type': 'ItemList',
      // Tiene que coincidir con los ítems que efectivamente se enumeran abajo,
      // no con el total del catálogo: declarar 113 y listar 24 es una
      // inconsistencia que Google marca al validar el dato estructurado.
      numberOfItems: mappedInitialProducts.length,
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
      {/* El JSON-LD nombra Atelier (SEO minorista). Va siempre: el HTML es el
          mismo para todos porque la página es estática, y una óptica no lo ve
          —vive en un <script>, y el rebrandeo de lo visible lo hace el cliente. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />
      <TiendaClient
        initialProducts={mappedInitialProducts}
        initialTotalCount={initialTotalCount}
        initialConteos={initialConteos}
        availableBrands={availableBrands}
        availableShapes={availableShapes}
        availableMaterials={availableMaterials}
        footer={<PieSegunSesion />}
      />
    </>
  );
}

// El armado del catálogo mapeado (compartido con /api/store/products) vive en
// src/lib/catalog/tienda-map.ts — una sola definición para página y API.
