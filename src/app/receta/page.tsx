import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { CategoryGrid } from "@/components/Storefront/CategoryGrid";
import { ProductFilters } from "@/components/Storefront/ProductFilters";
import { prisma } from '@/lib/db';
import { Glasses } from 'lucide-react';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: "Anteojos de Receta | Atelier Óptica Córdoba",
  description: "Armazones de receta de diseño. Encontrá el modelo perfecto para tus cristales monofocales o multifocales.",
};

export default async function RecetaPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const resolvedParams = await searchParams;
  const filterBrand = typeof resolvedParams.marca === 'string' ? resolvedParams.marca : undefined;
  const sortParam = typeof resolvedParams.orden === 'string' ? resolvedParams.orden : 'recientes';

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
  const [dbProducts, uniqueBrandsResult] = await Promise.all([
    prisma.webProduct.findMany({
      where: whereClause,
      include: { product: true },
      orderBy: orderBy
    }),
    prisma.webProduct.findMany({
      where: { category: { contains: "Receta", mode: "insensitive" }, isActive: true },
      include: { product: { select: { brand: true } } }
    })
  ]);

  // Extract distinct brands
  const brandsSet = new Set<string>();
  uniqueBrandsResult.forEach(wp => {
    if (wp.product?.brand) {
      brandsSet.add(wp.product.brand.toUpperCase());
    }
  });
  const availableBrands = Array.from(brandsSet).sort();

  const products = dbProducts.map(wp => ({
    id: wp.product.id,
    brand: wp.product.brand || 'Atelier',
    model: wp.product.model || wp.name,
    price: wp.product.price,
    stock: wp.product.stock,
    imagenesCatalogo: wp.images.length > 0 ? wp.images : wp.product.imagenesCatalogo,
    category: wp.category,
    slug: wp.slug,
    isFeatured: wp.isFeatured
  }));

  // Agregamos el producto de demostración de Carey Vintage si la lista está vacía para probar el grid y no hay filtro.
  if (products.length === 0 && !filterBrand) {
    products.push({
      id: "atelier-carey-vintage",
      brand: "ATELIER",
      model: "9030 (GLD)",
      price: 55000,
      stock: 5,
      imagenesCatalogo: [],
      mockImage: "/images/products/atelier-9030-gold.png",
      category: "Receta",
      slug: "atelier-carey-vintage",
      isFeatured: true
    } as any);
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
            Anteojos de <span className="text-primary italic">Receta</span>
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-400 max-w-2xl mx-auto">
            Armazones de diseño para cristales monofocales y multifocales.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 relative">
          <aside className="w-full lg:w-64 flex-shrink-0">
            <Suspense fallback={<div className="h-40 bg-stone-100 animate-pulse rounded-xl" />}>
              <ProductFilters availableBrands={availableBrands} />
            </Suspense>
          </aside>

          <div className="flex-1">
            <CategoryGrid 
              products={products} 
              categoryName="Armazones de Receta" 
              emptyMessage={filterBrand ? `No encontramos armazones de receta de la marca ${filterBrand}.` : "Estamos actualizando nuestra colección de anteojos de receta. Vení a probarte todos nuestros modelos a nuestro local."} 
            />
          </div>
        </div>
      </main>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
