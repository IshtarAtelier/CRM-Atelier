import Link from 'next/link';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-stone-50 text-black flex flex-col justify-between" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <StorefrontNavbar theme="light" />
      
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-32 text-center max-w-md mx-auto">
        <h1 className="text-7xl font-serif mb-4">404</h1>
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] mb-6 text-stone-500">Página No Encontrada</h2>
        <p className="text-stone-600 text-sm leading-relaxed mb-8">
          El modelo o la página que estás buscando no existe, o fue trasladada a otra dirección de nuestro catálogo.
        </p>
        <Link 
          href="/tienda" 
          className="bg-black text-white px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors rounded-full shadow-md"
        >
          Explorar la Tienda
        </Link>
      </main>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
