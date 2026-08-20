import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { ListadoCatalogoFiltrado } from "@/components/Storefront/ListadoCatalogoFiltrado";
import { ProductFilters } from "@/components/Storefront/ProductFilters";
import { prisma } from '@/lib/db';
import { LISTADO_SELECT } from '@/lib/catalog/queries';
import { getSolListado } from '@/lib/catalog/sources';

// ISR de verdad: la página se prerenderiza y se regenera cada 5 minutos.
// Antes este `revalidate` no hacía nada — el componente recibía `searchParams`
// para armar el WHERE y el ORDER BY de Prisma, y leer searchParams marca la ruta
// como dinámica. Resultado: cero caché y dos consultas al catálogo por visita,
// aun para quien entraba sin ningún filtro (la enorme mayoría). Ahora el
// servidor trae siempre el listado completo en su orden por defecto y el recorte
// por marca/forma/material/género y el orden se aplican en el cliente, sobre
// datos que ya viajaron (ver ListadoCatalogoFiltrado).
export const revalidate = 300;
import { Glasses } from 'lucide-react';
import { Suspense } from 'react';
import { getProductAttributes } from '@/utils/product-controllers';
import { resolveStorageUrl } from '@/lib/utils/storage';

export const metadata: Metadata = {
  title: "Anteojos de Sol",
  description: "Descubrí nuestra colección de anteojos de sol con protección UV400. Las mejores marcas y diseños en Córdoba.",
  alternates: {
    canonical: 'https://atelieroptica.com.ar/lentes-de-sol',
  },
  openGraph: {
    title: "Anteojos de Sol",
    description: 'Descubrí nuestra colección de anteojos de sol con protección UV400. Las mejores marcas y diseños en Córdoba.',
    url: 'https://atelieroptica.com.ar/lentes-de-sol',
    type: 'website',
  },
};

// La marca real no está en LISTADO_SELECT (la grilla muestra siempre "ATELIER"):
// la pedimos sólo acá porque el filtro ?marca= ahora se resuelve en el cliente y
// necesita el dato en cada fila. Fuera de LISTADO_SELECT a propósito, para no
// engordar los snapshots commiteados de src/data/snapshots/.
const SELECT_CON_MARCA = {
  ...LISTADO_SELECT,
  product: { select: { ...LISTADO_SELECT.product.select, brand: true } },
};

export default async function LentesDeSolPage() {
  // WHERE y ORDER BY fijos: son los de la vista por defecto, la única que se
  // cachea. Los cristales no son armazones: si a uno le queda la categoría web
  // de sol, aparece en la grilla mezclado entre los marcos. Pasó con un
  // Essilor Orma de $280.000 listado en /receta.
  const whereClause = {
    category: { contains: "Sol", mode: "insensitive" as const },
    isActive: true,
    // Sin stock no se muestra (regla 19/8): el stock es compartido con el CRM
    // y un modelo agotado seguía en vitrina hasta despublicarlo a mano.
    product: { category: { not: 'Cristal' }, stock: { gt: 0 } },
  };

  // Execute Queries in parallel
  let dbProducts: any[] = [];
  let uniqueBrandsResult: any[] = [];
  try {
    const [pRes, bRes] = await Promise.all([
      prisma.webProduct.findMany({
        where: whereClause,
        select: SELECT_CON_MARCA,
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      }),
      // Prisma doesn't support distinct easily on nested relations, so we fetch all active sol products to extract brands
      prisma.webProduct.findMany({
        where: whereClause,
        select: { name: true, product: { select: { brand: true, model: true } } }
      })
    ]);
    dbProducts = pRes;
    uniqueBrandsResult = bRes;
  } catch (error) {
    // DB caída: vista por defecto resiliente (memoria → snapshot). La página
    // nunca queda vacía; el filtro por marca se ignora mientras dure la falla
    // (las filas del fallback no traen la marca real).
    console.error('[LentesDeSol] query en vivo falló — usando fallback:', error);
    const fallback = await getSolListado();
    dbProducts = fallback.data.products;
    uniqueBrandsResult = fallback.data.meta;
  }

  // Extract distinct brands
  const brandsSet = new Set<string>();
  uniqueBrandsResult.forEach(wp => {
    if (wp.product?.brand) {
      brandsSet.add(wp.product.brand.toUpperCase()); // Normalize to uppercase for distinct
    }
  });
  const availableBrands = Array.from(brandsSet).sort();

  // Extract distinct shapes and materials dynamically
  const shapesSet = new Set<string>();
  const materialsSet = new Set<string>();
  uniqueBrandsResult.forEach(wp => {
    const model = wp.product?.model || wp.name;
    const { shape, material } = getProductAttributes(model, wp.product?.seoTags);
    if (shape) {
      shape.split(',').forEach(s => shapesSet.add(s.trim()));
    }
    if (material) {
      materialsSet.add(material);
    }
  });
  // Force add "XL" as requested by the user
  shapesSet.add("XL");

  const availableShapes = Array.from(shapesSet).sort();
  const availableMaterials = Array.from(materialsSet).sort();

  const products = dbProducts.map(wp => {
    const modelCode = wp.product.model || wp.name;
    const { shape, material } = getProductAttributes(modelCode, wp.product?.seoTags);
    return {
      id: wp.product.id,
      brand: 'ATELIER',
      // La marca que se muestra es siempre ATELIER; ésta es la del catálogo y
      // sólo la usa el filtro ?marca= del cliente.
      marcaReal: wp.product.brand ?? null,
      model: wp.name || modelCode,
      modelCode: modelCode,
      price: wp.product.price,
      stock: wp.product.stock,
      imagenesCatalogo: (() => {
        let combinedImages = wp.images.length > 0 ? [...wp.images] : [];
        if (wp.product.imagenesCatalogo && wp.product.imagenesCatalogo.length > 0) {
            const avatars = wp.product.imagenesCatalogo.filter((img: string) => img.includes('avatar'));
            if (avatars.length > 0 && !combinedImages.some(img => img.includes('avatar'))) {
                combinedImages = [...combinedImages, ...avatars];
            } else if (combinedImages.length === 0) {
                combinedImages = wp.product.imagenesCatalogo;
            }
        }
        return combinedImages;
      })(),
      category: wp.category,
      slug: wp.slug,
      isFeatured: wp.isFeatured,
      shape,
      material,
      gender: wp.product.gender
    };
  });

  // CollectionPage JSON-LD
  // Se arma sobre el listado SIN filtrar: es lo que devuelve la URL canónica
  // (https://…/lentes-de-sol) y lo único que ve un buscador. Antes se armaba con
  // el resultado filtrado, que en la práctica era lo mismo salvo cuando alguien
  // entraba con parámetros en la URL.
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Anteojos de Sol',
    description: 'Descubrí nuestra colección de anteojos de sol con protección UV400. Las mejores marcas y diseños en Córdoba.',
    url: 'https://atelieroptica.com.ar/lentes-de-sol',
    mainEntity: {
      '@type': 'ItemList',
      // Los que se enumeran, no el total: declarar 89 y listar 20 es una
      // inconsistencia que Google marca al validar el dato estructurado.
      numberOfItems: Math.min(products.length, 20),
      itemListElement: products.slice(0, 20).map((p, i) => {
        const img = p.imagenesCatalogo && p.imagenesCatalogo.length > 0
          ? resolveStorageUrl(p.imagenesCatalogo[0])
          : undefined;
        const absoluteImg = img ? (img.startsWith('http') ? img : `https://atelieroptica.com.ar${img}`) : undefined;
        return {
          '@type': 'ListItem',
          position: i + 1,
          url: `https://atelieroptica.com.ar/producto/${p.slug}`,
          name: `${p.brand} ${p.model}`,
          ...(absoluteImg ? { image: absoluteImg } : {}),
        };
      }),
    },
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20 flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <StorefrontNavbar theme="light" />

      <main className="flex-1 flex flex-col px-4 pt-32 pb-16 max-w-[1400px] mx-auto w-full">
        <div className="text-center mb-16 lg:mb-24">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
            <Glasses className="w-8 h-8" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-4">
            Anteojos de <span className="text-primary italic">Sol</span>
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-400 max-w-2xl mx-auto">
            Protección UV400 y los diseños más exclusivos de la temporada.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 relative">
          <aside className="w-full lg:w-64 flex-shrink-0">
            <Suspense fallback={<div className="h-40 bg-stone-100 animate-pulse rounded-xl" />}>
              <ProductFilters
                availableBrands={availableBrands}
                availableShapes={availableShapes}
                availableMaterials={availableMaterials}
              />
            </Suspense>
          </aside>

          <div className="flex-1">
            <ListadoCatalogoFiltrado
              productos={products}
              nombreCategoria="Lentes de Sol"
              mensajeVacio="Estamos actualizando nuestra colección de anteojos de sol. ¡Volvé pronto para ver los nuevos modelos!"
              plantillaVacioPorMarca="No encontramos anteojos de sol de la marca {marca}."
            />
          </div>
        </div>
      </main>

      <StorefrontFooter />

    </div>
  );
}
