import { Metadata } from 'next';
import nextDynamic from 'next/dynamic';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

// Import dinámico: el builder arrastra framer-motion + LensConfigurator; separarlo
// del chunk inicial baja el TBT de la página. SSR se mantiene (SEO intacto).
const CustomGlassesBuilder = nextDynamic(
  () => import("@/components/Storefront/CustomGlassesBuilder").then(mod => mod.CustomGlassesBuilder),
  { loading: () => <div className="flex-1 bg-stone-50 dark:bg-stone-950" /> }
);


export const metadata: Metadata = {
  title: "Armá tus Lentes a Medida",
  description: "Elegí tu armazón favorito y configurá tus cristales con receta en un solo lugar.",
  alternates: { canonical: 'https://atelieroptica.com.ar/arma-tus-lentes' },
};

export default async function ArmaTusLentesPage() {
  let dbProducts: any[] = [];
  try {
    dbProducts = await prisma.webProduct.findMany({
      where: { 
        category: { contains: "Receta", mode: "insensitive" },
        isActive: true,
        product: { stock: { gt: 0 } }
      },
      include: { product: true },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }]
    });
  } catch (error) {
    console.error("Prerendering warning: Database not reachable at build time on Arma Tus Lentes page.", error);
  }

  const products = dbProducts.map(wp => ({
    id: wp.product.id,
    brand: 'ATELIER',
    model: wp.name || wp.product.model || '',
    price: wp.product.price,
    stock: wp.product.stock,
    imagenesCatalogo: (() => {
      let combinedImages = wp.imageUrl ? [wp.imageUrl, ...wp.images] : (wp.images.length > 0 ? [...wp.images] : []);
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
    slug: wp.slug
  }));

  // Demo fallback si no hay productos
  if (products.length === 0) {
    products.push({
      id: "atelier-carey-vintage",
      brand: "ATELIER",
      model: "9030 (GLD)",
      price: 55000,
      stock: 5,
      imagenesCatalogo: [],
      category: "Receta",
      slug: "atelier-carey-vintage"
    } as any);
  }

  return (
    <div className="min-h-[100dvh] bg-stone-50 dark:bg-stone-950 flex flex-col overflow-hidden">
      <StorefrontNavbar theme="light" />
      <main className="flex-1 flex flex-col pt-[72px] h-[100dvh]">
        <CustomGlassesBuilder products={products} />
      </main>
    </div>
  );
}
