import { prisma } from '@/lib/db';
import { TiendaClient } from './TiendaClient';
import { StorefrontFooterStatic } from '@/components/Storefront/StorefrontFooterStatic';
import { Metadata } from 'next';
import { getProductAttributes } from '@/utils/product-controllers';
import { serverCache } from '@/lib/cache';
import { rethrowUnlessBuild } from '@/lib/db-guard';

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Colección de Anteojos",
  description: 'Descubrí nuestra colección completa de anteojos de diseño. Marcos premium seleccionados a mano.',
  alternates: {
    canonical: 'https://atelieroptica.com.ar/tienda',
  },
  openGraph: {
    title: "Colección de Anteojos",
    description: 'Descubrí nuestra colección completa de anteojos de diseño. Marcos premium seleccionados a mano.',
    url: 'https://atelieroptica.com.ar/tienda',
    type: 'website',
    images: [{ url: '/images/blog/mostrador-marmol.webp', width: 1200, height: 630, alt: 'Colección Atelier Óptica' }],
  },
};

export default async function TiendaPage() {
  // 1) Fetch only filter metadata for the sidebar (very light query selecting only specific text fields)
  let filterMetadata: any[] = [];
  try {
    filterMetadata = await prisma.webProduct.findMany({
      where: {
        isActive: true,
        product: {
          publishToWeb: true,
          category: { not: 'Cristal' },
        }
      },
      select: {
        name: true,
        product: {
          select: {
            brand: true,
            model: true,
            seoTags: true,
          }
        }
      }
    });
  } catch (error) {
    rethrowUnlessBuild(error, 'Tienda/filtros');
  }

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

  // 2) First page of products for the server render & SEO. Same logic and SAME
  // cache key as /api/store/products (web channel): the mapped catalog is shared
  // via serverCache (180s), so the page render and the API endpoint reuse one copy.
  let catalog: any[] = [];
  try {
    catalog = await getWebCatalog();
  } catch (error) {
    rethrowUnlessBuild(error, 'Tienda/catalogo');
  }

  const mappedInitialProducts = catalog.slice(0, 24);
  const initialTotalCount = catalog.length;

  return (
    <TiendaClient
      initialProducts={mappedInitialProducts}
      initialTotalCount={initialTotalCount}
      availableBrands={availableBrands}
      availableShapes={availableShapes}
      availableMaterials={availableMaterials}
      footer={<StorefrontFooterStatic />}
    />
  );
}

// Réplica exacta del armado de catálogo de /api/store/products (canal web),
// compartiendo su clave de caché para no duplicar queries a la base.
async function getWebCatalog(): Promise<any[]> {
  const cacheKey = 'store-products-mapped:web';
  let mappedProducts = serverCache.get<any[]>(cacheKey);
  if (mappedProducts === null) {
    const webProducts = await prisma.webProduct.findMany({
      where: {
        isActive: true,
        product: {
          publishToWeb: true,
          category: { not: 'Cristal' }
        }
      },
      include: {
        product: true
      },
      // Destacados primero (isFeatured), luego lo más nuevo: la vitrina abre por
      // lo curado, no por el último lote. Mismo criterio que la API del catálogo.
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }]
    });

    mappedProducts = webProducts.map(wp => {
      const modelCode = wp.product.model || wp.name || '';
      const { shape, material } = getProductAttributes(modelCode, wp.product.seoTags);

      const isXl = ["9004M C3", "9004M C2", "TL3684 C4", "91501 C6"].some(code => modelCode.toUpperCase().includes(code)) ||
                   ["dionisio", "dionisio-c2", "selene-c4", "armazon-receta-atelier-athena-91501-c6", "poseidon-c3", "poseidon-c2"].includes(wp.slug);

      return {
        id: wp.product.id,
        brand: wp.product.brand || 'ATELIER',
        model: wp.name || modelCode,
        modelCode: modelCode,
        category: wp.category,
        price: wp.product.price,
        salePrice: wp.product.salePrice,
        stock: wp.product.stock,
        slug: wp.slug,
        imagenesCatalogo: (wp.images.length > 0 ? wp.images : (wp.product.imagenesCatalogo || [])).slice(0, 2),
        shape: isXl ? "XL" : (shape || "Otros"),
        material: material || "Acetato",
        gender: wp.product.gender || "Unisex"
      };
    });
    serverCache.set(cacheKey, mappedProducts, 180);
  }
  return mappedProducts;
}
