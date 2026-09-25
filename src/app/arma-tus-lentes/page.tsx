import { Metadata } from 'next';
import nextDynamic from 'next/dynamic';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { getArmaTusLentes } from "@/lib/catalog/sources";
import { precioFinal } from "@/lib/precio-oferta";

// ISR y no `force-dynamic`: la página no lee cookies ni searchParams, y el
// catálogo sale de una fuente resiliente (vivo → memoria → snapshot). Con
// `force-dynamic` cada visita renderizaba en el servidor con una consulta a la
// base; medido en producción, 711 ms de TTFB. Cinco minutos es lo mismo que
// usa la ficha: precio y stock se refrescan igual.
export const revalidate = 300;

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
  // Fuente resiliente (vivo → memoria → snapshot): el builder siempre tiene
  // armazones para elegir, aunque la DB esté caída. Ver src/lib/catalog/.
  const { data: dbProducts } = await getArmaTusLentes();

  const products = dbProducts.map(wp => ({
    id: wp.product.id,
    brand: 'ATELIER',
    model: wp.name || wp.product.model || '',
    // El que se cobra (oferta si la hay): la misma regla que la tienda y el
    // checkout. El snapshot viejo no trae salePrice y cae al de lista.
    price: precioFinal(wp.product),
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

  return (
    <div className="min-h-[100dvh] bg-stone-50 dark:bg-stone-950 flex flex-col overflow-hidden">
      <StorefrontNavbar theme="light" />
      <main className="flex-1 flex flex-col pt-[72px] h-[100dvh]">
        <CustomGlassesBuilder products={products} />
      </main>
    </div>
  );
}
