import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { Glasses } from 'lucide-react';

export const metadata: Metadata = {
  title: "Anteojos Clip On | Atelier Óptica Córdoba",
  description: "Anteojos recetados con suplemento solar magnético Clip-On. La solución más práctica para ver bien y protegerte del sol.",
};

export default function ClipOnPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20 flex flex-col">
      <StorefrontNavbar theme="light" />
      
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-32 mt-16">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-8">
          <Glasses className="w-10 h-10" />
        </div>
        <h1 className="text-4xl lg:text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-4">
          Anteojos <span className="text-primary italic">Clip On</span>
        </h1>
        <p className="text-xl text-stone-600 dark:text-stone-400 max-w-2xl mx-auto mb-10">
          Dos anteojos en uno. Armazón recetado + suplemento solar magnético. Escribinos para ver los modelos disponibles.
        </p>
        <a 
          href="https://wa.me/5493541215971"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-bold py-4 px-8 rounded-full hover:bg-stone-800 dark:hover:bg-stone-100 transition-colors shadow-lg"
        >
          Ver modelos Clip On
        </a>
      </main>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
