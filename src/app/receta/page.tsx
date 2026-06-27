import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { CategoryGrid } from "@/components/Storefront/CategoryGrid";
import { ProductFilters } from "@/components/Storefront/ProductFilters";
import { prisma } from '@/lib/db';
export const revalidate = 300;
import { Glasses } from 'lucide-react';
import { Suspense } from 'react';
import { getProductAttributes } from '@/utils/product-controllers';
import { resolveStorageUrl } from '@/lib/utils/storage';

export const metadata: Metadata = {
  title: "Anteojos de Receta",
  description: "Armazones de receta de diseño. Encontrá el modelo perfecto para tus cristales monofocales o multifocales.",
  alternates: {
    canonical: 'https://www.atelieroptica.com.ar/receta',
  },
  openGraph: {
    title: "Anteojos de Receta",
    description: 'Armazones de receta de diseño. Encontrá el modelo perfecto para tus cristales monofocales o multifocales.',
    url: 'https://www.atelieroptica.com.ar/receta',
    type: 'website',
  },
};

export default async function RecetaPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const resolvedParams = await searchParams;
  const filterBrand = typeof resolvedParams.marca === 'string' ? resolvedParams.marca : undefined;
  const sortParam = typeof resolvedParams.orden === 'string' ? resolvedParams.orden : 'recientes';
  const filterShape = typeof resolvedParams.forma === 'string' ? resolvedParams.forma : undefined;
  const filterMaterial = typeof resolvedParams.material === 'string' ? resolvedParams.material : undefined;
  const filterGender = typeof resolvedParams.genero === 'string' ? resolvedParams.genero : undefined;

  // Base Where Clause
  const whereClause: any = { 
    category: { contains: "Receta", mode: "insensitive" },
    isActive: true
  };

  // Add Brand Filter if exists
  if (filterBrand) {
    whereClause.product = {
      brand: { equals: filterBrand, mode: "insensitive" }
    };
  }

  // Determine Sort Order
  const orderBy: any[] = [{ isFeatured: 'desc' }];
  if (sortParam === 'menor_precio') {
    orderBy.push({ product: { price: 'asc' } });
  } else if (sortParam === 'mayor_precio') {
    orderBy.push({ product: { price: 'desc' } });
  } else {
    // recientes
    orderBy.push({ createdAt: 'desc' });
  }

  // Execute Queries in parallel
  let dbProducts: any[] = [];
  let uniqueBrandsResult: any[] = [];
  try {
    const [pRes, bRes] = await Promise.all([
      prisma.webProduct.findMany({
        where: whereClause,
        include: { product: true },
        orderBy: orderBy
      }),
      prisma.webProduct.findMany({
        where: { category: { contains: "Receta", mode: "insensitive" }, isActive: true },
        include: { product: { select: { brand: true, model: true } } }
      })
    ]);
    dbProducts = pRes;
    uniqueBrandsResult = bRes;
  } catch (error) {
    console.error("Prerendering warning: Database not reachable at build time on Receta page.", error);
  }

  // Extract distinct brands
  const brandsSet = new Set<string>();
  uniqueBrandsResult.forEach(wp => {
    if (wp.product?.brand) {
      brandsSet.add(wp.product.brand.toUpperCase());
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

  // Agregamos el producto de demostración de Carey Vintage si la lista está vacía para probar el grid y no hay filtros.
  if (products.length === 0 && !filterBrand && !filterShape && !filterMaterial && !filterGender) {
    const demoModel = "9030 (GLD)";
    const { shape, material } = getProductAttributes(demoModel);
    products.push({
      id: "atelier-carey-vintage",
      brand: "ATELIER",
      model: demoModel,
      price: 55000,
      stock: 5,
      imagenesCatalogo: [],
      mockImage: "/images/products/atelier-9030-gold.png",
      category: "Receta",
      slug: "atelier-carey-vintage",
      isFeatured: true,
      shape,
      material,
      gender: "Unisex"
    } as any);
  }

  // Apply shape, material, and gender filters in memory
  let filteredProducts = products;
  if (filterShape) {
    filteredProducts = filteredProducts.filter(p => {
      if (!p.shape) return false;
      const shapes = p.shape.split(',').map(s => s.trim().toLowerCase());
      return shapes.includes(filterShape.toLowerCase());
    });
  }
  if (filterMaterial) {
    filteredProducts = filteredProducts.filter(p => p.material.toLowerCase() === filterMaterial.toLowerCase());
  }
  if (filterGender) {
    const fg = filterGender.toLowerCase();
    filteredProducts = filteredProducts.filter(p => {
      if (!p.gender) return true;
      const g = p.gender.toLowerCase();
      if (fg === 'femme') {
        return g.includes('femenino') || g.includes('mujer') || g.includes('femme') || g.includes('unisex') || g.includes('sin_genero') || g.includes('no_gender');
      } else if (fg === 'homme') {
        return g.includes('masculino') || g.includes('hombre') || g.includes('homme') || g.includes('unisex') || g.includes('sin_genero') || g.includes('no_gender');
      } else if (fg === 'no_gender') {
        return g.includes('unisex') || g.includes('sin_genero') || g.includes('no_gender');
      }
      return true;
    });
  }

  if (sortParam === 'forma') {
    filteredProducts.sort((a, b) => {
      const shapeA = (a.shape || '').toLowerCase();
      const shapeB = (b.shape || '').toLowerCase();
      if (shapeA < shapeB) return -1;
      if (shapeA > shapeB) return 1;
      return 0;
    });
  }

  // CollectionPage JSON-LD
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Anteojos de Receta',
    description: 'Armazones de receta de diseño. Encontrá el modelo perfecto para tus cristales monofocales o multifocales.',
    url: 'https://www.atelieroptica.com.ar/receta',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: filteredProducts.length,
      itemListElement: filteredProducts.slice(0, 20).map((p, i) => {
        const img = p.imagenesCatalogo && p.imagenesCatalogo.length > 0
          ? resolveStorageUrl(p.imagenesCatalogo[0])
          : undefined;
        const absoluteImg = img ? (img.startsWith('http') ? img : `https://www.atelieroptica.com.ar${img}`) : undefined;
        return {
          '@type': 'ListItem',
          position: i + 1,
          url: `https://www.atelieroptica.com.ar/producto/${p.slug}`,
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
            Anteojos de <span className="text-primary italic">Receta</span>
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-400 max-w-2xl mx-auto">
            Armazones de diseño para cristales monofocales y multifocales.
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
            <CategoryGrid 
              products={filteredProducts} 
              categoryName="Armazones de Receta" 
              emptyMessage={filterBrand ? `No encontramos armazones de receta de la marca ${filterBrand}.` : "Estamos actualizando nuestra colección de anteojos de receta. Vení a probarte todos nuestros modelos a nuestro local."} 
            />
          </div>
        </div>
      </main>

      <StorefrontFooter />
      
    </div>
  );
}
