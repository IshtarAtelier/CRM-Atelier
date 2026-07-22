import Link from 'next/link';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';

/**
 * 404 de una ficha de producto (modelo discontinuado o link viejo del índice de
 * Google). Va con status 404 real — es lo que Google necesita para sacarlo del
 * índice sin marcarlo como soft-404 — pero le da salida al visitante en vez de
 * dejarlo en un callejón: las categorías, el buscador de la tienda y WhatsApp.
 */
export default function ProductNotFound() {
  return (
    <>
      {/* theme light: la navbar es transparente hasta que hay scroll, y acá no
          hay hero oscuro detrás — sin esto los links quedan blanco sobre blanco. */}
      <StorefrontNavbar theme="light" />
      <div className="min-h-[70vh] bg-stone-50 text-black flex flex-col items-center justify-center px-4 pt-36 pb-24 text-center font-sans">
        <h1 className="text-xs font-bold uppercase tracking-[0.2em] mb-4 text-stone-500">
          Modelo no disponible
        </h1>
        <h2 className="text-3xl md:text-4xl font-serif mb-5 max-w-xl">
          Este modelo ya no está en nuestro catálogo
        </h2>
        <p className="text-stone-600 text-sm leading-relaxed mb-10 max-w-md">
          Puede que se haya agotado o que lo hayamos renovado por una versión nueva.
          Estos son los caminos más cortos para encontrar algo parecido.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/tienda"
            className="bg-black text-white px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors rounded-full shadow-md"
          >
            Ver toda la tienda
          </Link>
          <Link
            href="/lentes-de-sol"
            className="border border-stone-300 px-8 py-4 text-xs font-bold uppercase tracking-widest hover:border-black transition-colors rounded-full"
          >
            Lentes de sol
          </Link>
          <Link
            href="/receta"
            className="border border-stone-300 px-8 py-4 text-xs font-bold uppercase tracking-widest hover:border-black transition-colors rounded-full"
          >
            Anteojos de receta
          </Link>
        </div>
        <p className="mt-10 text-xs text-stone-500 max-w-md leading-relaxed">
          ¿Buscabas un modelo puntual? Escribinos por WhatsApp y te decimos si nos
          queda o qué se le parece.
        </p>
      </div>
    </>
  );
}
