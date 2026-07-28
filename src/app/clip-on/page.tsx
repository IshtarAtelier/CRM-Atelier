import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { ListadoCategoria } from "@/components/Storefront/ListadoCategoria";
import { Glasses } from 'lucide-react';

export const revalidate = 300;

const DESCRIPCION = 'Armazón recetado con suplemento solar magnético: dos anteojos en uno. Modelos en acetato, metal y TR90, con envío gratis a todo el país.';

export const metadata: Metadata = {
  title: "Anteojos Clip On",
  description: DESCRIPCION,
  alternates: { canonical: 'https://atelieroptica.com.ar/clip-on' },
  openGraph: {
    title: "Anteojos Clip On",
    description: DESCRIPCION,
    url: 'https://atelieroptica.com.ar/clip-on',
    type: 'website',
  },
};

/**
 * Hasta el 28/7/2026 esta página no mostraba ni uno de los clip-on publicados:
 * era un texto con un botón "Ver modelos Clip On" que llevaba a WhatsApp. Quien
 * buscaba clip-on —que es de las búsquedas con más intención de compra, porque
 * ya sabe lo que quiere— caía acá y no veía ninguno de los modelos en stock.
 */
export default async function ClipOnPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await searchParams;
  const texto = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20 flex flex-col">
      <StorefrontNavbar theme="light" />

      <main className="flex-1 flex flex-col px-4 pt-32 pb-16 max-w-[1400px] mx-auto w-full">
        <div className="text-center mb-16 lg:mb-24">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
            <Glasses className="w-8 h-8" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-4">
            Anteojos <span className="text-primary italic">Clip On</span>
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-400 max-w-2xl mx-auto">
            Dos anteojos en uno: armazón recetado y suplemento solar magnético que se pone y se saca.
          </p>
        </div>

        <ListadoCategoria
          categoria="Clip-On"
          url="https://atelieroptica.com.ar/clip-on"
          titulo="Anteojos Clip On"
          descripcion={DESCRIPCION}
          mensajeVacio="Estamos actualizando la colección de clip-on. Escribinos y te contamos qué modelos están entrando."
          filtros={{
            marca: texto('marca'),
            forma: texto('forma'),
            material: texto('material'),
            genero: texto('genero'),
            orden: texto('orden'),
          }}
        />
      </main>

      <StorefrontFooter />
    </div>
  );
}
