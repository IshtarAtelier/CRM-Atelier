"use client";

import Link from 'next/link';
import { formatQueryToTitle } from '@/lib/seo-keywords';
import { Search } from 'lucide-react';

export function SeoAccordion({ keywords }: { keywords: string[] }) {
  return (
    <div className="bg-gradient-to-b from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950 py-16 border-t border-stone-200 dark:border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4">
            <Search className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-stone-900 dark:text-white tracking-tight">
            Búsquedas Populares en Córdoba
          </h2>
          <p className="text-stone-500 dark:text-stone-400 mt-3 max-w-2xl mx-auto text-sm md:text-base">
            Explorá los temas más consultados por nuestros clientes y encontrá la solución ideal para tu salud visual.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 justify-center items-center">
          {keywords.map((keyword) => (
            <Link 
              key={keyword} 
              href={`/blog/busquedas/${keyword}`}
              className="text-[11px] md:text-xs font-medium px-4 py-2 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 rounded-full border border-stone-200 dark:border-stone-700 shadow-sm hover:shadow-md hover:border-primary/50 hover:text-primary dark:hover:text-primary transition-all duration-300 hover:-translate-y-0.5"
            >
              {formatQueryToTitle(keyword)}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
