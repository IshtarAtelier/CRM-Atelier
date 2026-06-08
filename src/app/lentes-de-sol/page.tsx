import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { CategoryGrid } from "@/components/Storefront/CategoryGrid";
import { ProductFilters } from "@/components/Storefront/ProductFilters";
import { prisma } from '@/lib/db';

export const revalidate = 300;
import { Glasses } from 'lucide-react';
import { Suspense } from 'react';
import { getProductAttributes } from '@/utils/product-controllers';

export const metadata: Metadata = {
  title: "Anteojos de Sol | Atelier Óptica Córdoba",
  description: "Descubrí nuestra colección de anteojos de sol con protección UV400. Las mejores marcas y diseños en Córdoba.",
};

export default async function LentesDeSolPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const resolvedParams = await searchParams;
  const filterBrand = typeof resolvedParams.marca === 'string' ? resolvedParams.marca : undefined;
  const sortParam = typeof resolvedParams.orden === 'string' ? resolvedParams.orden : 'recientes';
  const filterShape = typeof resolvedParams.forma === 'string' ? resolvedParams.forma : undefined;
  const filterMaterial = typeof resolvedParams.material === 'string' ? resolvedParams.material : undefined;

  // Base Where Clause
  const whereClause: any = { 
    category: { contains: "Sol", mode: "insensitive" },
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
  const [dbProducts, uniqueBrandsResult] = await Promise.all([
    prisma.webProduct.findMany({
      where: whereClause,
      include: { product: true },
      orderBy: orderBy
    }),
    // Prisma doesn't support distinct easily on nested relations, so we fetch all active sol products to extract brands
    prisma.webProduct.findMany({
      where: { category: { contains: "Sol", mode: "insensitive" }, isActive: true },
      include: { product: { select: { brand: true, model: true } } }
    })
  ]);

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
    const { shape, material } = getProductAttributes(model);
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
    const { shape, material } = getProductAttributes(modelCode);
    return {
      id: wp.product.id,
      brand: wp.product.brand || 'Atelier',
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
      material
    };
  });

  // Apply shape and material filters in memory
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

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20 flex flex-col">
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
            <CategoryGrid 
              products={filteredProducts} 
              categoryName="Lentes de Sol" 
              emptyMessage={filterBrand ? `No encontramos anteojos de sol de la marca ${filterBrand}.` : "Estamos actualizando nuestra colección de anteojos de sol. ¡Volvé pronto para ver los nuevos modelos!"} 
            />
          </div>
        </div>
      </main>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
