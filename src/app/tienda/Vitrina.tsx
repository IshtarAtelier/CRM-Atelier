import { TiendaClient } from './TiendaClient';
import { PieSegunSesion } from './PieSegunSesion';
import { notFound } from 'next/navigation';
import { getProductAttributes } from '@/utils/product-controllers';
import { getTiendaFiltros } from '@/lib/catalog/sources';
import { getMappedWebCatalog } from '@/lib/catalog/tienda-map';
import { calcularFacetas, facetaValorUnico, facetaValoresMultiples } from '@/lib/catalog/facetas';
import { PRODUCTOS_POR_PAGINA, urlDePagina } from '@/lib/catalog/paginacion-tienda';

const ORIGEN = 'https://atelieroptica.com.ar';

/**
 * La vitrina de /tienda, armada UNA vez y servida por dos rutas: `/tienda`
 * (página 1) y `/tienda/2`, `/tienda/3`… (las páginas indexables que le dan a
 * Google un camino hasta los 112 modelos, no solo hasta los 24 primeros).
 *
 * Vive acá y no duplicada en cada `page.tsx` porque las dos rutas tienen que
 * mostrar exactamente lo mismo: los mismos filtros, los mismos conteos y el
 * mismo recorte del catálogo. Dos copias divergen: alcanza con que alguien
 * agregue una faceta en una y no en la otra.
 */
export async function Vitrina({ pagina }: { pagina: number }) {
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
      // `.split(',')` sigue acá por las dudas: hasta el 5/9/26 el heurístico de
      // respaldo de getProductAttributes() podía devolver "Cuadrado, XL" (un
      // bug real, ver product-controllers.ts) y esto lo separaba en dos
      // opciones válidas para el LISTADO de chips, aunque el producto en sí
      // quedara sin filtrar bien por ninguna de las dos. El bug ya no puede
      // pasar (la función nunca devuelve un valor compuesto), pero un valor
      // con coma sigue siendo, en el peor de los casos, dos opciones de más
      // en la lista — nunca un chip roto.
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
  // Color: solo las familias que ALGÚN producto del catálogo tiene hoy (no
  // tiene sentido mostrar un chip "Verde" si nadie es verde). Se calcula sobre
  // el catálogo ya mapeado (`catalog`, más abajo) en vez de `filterMetadata`
  // porque ahí es donde vive `coloresFamilia`, ya resuelto por tienda-map.ts.

  // 2) Primera página de productos para el SSR y el SEO. Mismo catálogo mapeado
  // (y mismo serverCache de 180s) que /api/store/products: una sola copia, con
  // fallback resiliente por debajo — la tienda nunca renderiza vacía.
  const { products: catalog } = await getMappedWebCatalog();

  const desde = (pagina - 1) * PRODUCTOS_POR_PAGINA;
  const mappedInitialProducts = catalog.slice(desde, desde + PRODUCTOS_POR_PAGINA);
  const initialTotalCount = catalog.length;

  // Una página vacía no es una página: /tienda/9 con 112 modelos no existe, y
  // servirla con la grilla en blanco sería un soft-404 (Google la indexa como
  // buena y después la degrada). Se responde 404 de verdad.
  if (mappedInitialProducts.length === 0) notFound();

  // F1-02: los conteos por opción para el PRIMER pintado.
  //
  // El cliente los recibe del endpoint en cada filtrado, pero la primera carga
  // no llama al endpoint a propósito (el servidor ya mandó los productos, ver
  // la guarda `isFirstRenderWithInitialData` en TiendaClient). Sin esto, quien
  // abre el panel sin haber filtrado todavía no ve ningún número — justo la
  // primera vez, que es cuando más orienta.
  //
  // Se usa el MISMO módulo genérico que el endpoint (`calcularFacetas`), con
  // `filtrosActivos: {}` — sin nada elegido, cada faceta cuenta el catálogo
  // entero, que es exactamente lo que hacía el contador de acá antes a mano.
  // La ventaja de no reimplementarlo: el color (multi-valor) sale gratis, sin
  // escribir un tercer contador que solo entienda un valor por producto.
  const FACETAS_INICIALES = [
    facetaValorUnico<any>('marca', (p) => p.brand),
    facetaValorUnico<any>('forma', (p) => p.shape),
    facetaValorUnico<any>('material', (p) => p.material),
    facetaValoresMultiples<any>('color', (p) => p.coloresFamilia || []),
  ];
  const initialConteos = calcularFacetas(catalog, FACETAS_INICIALES, {}) as {
    marca: Record<string, number>;
    forma: Record<string, number>;
    material: Record<string, number>;
    color: Record<string, number>;
  };
  const availableColors = Object.keys(initialConteos.color || {}).sort();

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Colección de Anteojos | Atelier Óptica',
    url: `${ORIGEN}${urlDePagina(pagina)}`,
    mainEntity: {
      '@type': 'ItemList',
      // Tiene que coincidir con los ítems que efectivamente se enumeran abajo,
      // no con el total del catálogo: declarar 113 y listar 24 es una
      // inconsistencia que Google marca al validar el dato estructurado.
      // `position` arranca en el índice real dentro del catálogo, para que la
      // página 3 declare del 49 al 72 y no del 1 al 24 otra vez.
      numberOfItems: mappedInitialProducts.length,
      itemListElement: mappedInitialProducts.map((p: any, i: number) => ({
        '@type': 'ListItem',
        position: desde + i + 1,
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
        paginaInicial={pagina}
        availableBrands={availableBrands}
        availableShapes={availableShapes}
        availableMaterials={availableMaterials}
        availableColors={availableColors}
        // El `key` no es decorativo. Este elemento se crea en un componente de
        // servidor y viaja como prop hasta un componente cliente: React lo
        // deserializa en posición de lista y, sin key, avisaba en cada carga de
        // /tienda ("Each child in a list should have a unique key prop"). El
        // aviso es de desarrollo, pero es el mismo mecanismo que hace que React
        // desmonte y remonte un nodo cuando no puede identificarlo — acá, el pie
        // entero. Verificado: con `footer={null}` el aviso desaparece.
        footer={<PieSegunSesion key="pie-tienda" />}
      />
    </>
  );
}

// El armado del catálogo mapeado (compartido con /api/store/products) vive en
// src/lib/catalog/tienda-map.ts — una sola definición para página y API.
