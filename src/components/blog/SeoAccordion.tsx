"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatQueryToTitle } from '@/lib/seo-keywords';

export function SeoAccordion({ keywords }: { keywords: string[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-stone-200 dark:border-stone-800">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-stone-500 hover:text-primary transition-colors mb-2 mx-auto"
      >
        <span className="text-sm font-medium">Ver Búsquedas Populares en Córdoba</span>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      <div 
        className={`transition-all duration-500 overflow-hidden ${
          isOpen ? 'max-h-[2000px] opacity-100 mt-6' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="flex flex-wrap gap-2 justify-center">
          {keywords.map((keyword) => (
            <Link 
              key={keyword} 
              href={`/blog/busquedas/${keyword}`}
              className="text-xs px-3 py-1.5 bg-stone-100 dark:bg-stone-900 text-stone-500 dark:text-stone-500 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
            >
              {formatQueryToTitle(keyword)}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
