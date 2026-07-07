import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-stone-50 text-black flex flex-col items-center justify-center px-4 py-32 text-center font-sans">
      <h1 className="text-7xl font-serif mb-4">404</h1>
      <h2 className="text-xs font-bold uppercase tracking-[0.2em] mb-6 text-stone-500">Página no encontrada</h2>
      <p className="text-stone-600 text-sm leading-relaxed mb-8 max-w-md">
        El modelo o la página que estás buscando no existe, o fue trasladada a otra dirección de nuestro catálogo.
      </p>
      <Link
        href="/tienda"
        className="bg-black text-white px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors rounded-full shadow-md"
      >
        Explorar la Tienda
      </Link>
      <Link
        href="/"
        className="mt-4 text-xs uppercase tracking-widest text-stone-500 underline underline-offset-4 hover:text-black transition-colors"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
