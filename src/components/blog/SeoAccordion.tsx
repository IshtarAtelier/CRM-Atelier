"use client";

import { useState } from 'react';
import Link from 'next/link';
import { formatQueryToTitle } from '@/lib/seo-keywords';
import { Search, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function SeoAccordion({ keywords }: { keywords: string[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-gradient-to-b from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950 py-10 md:py-16 border-t border-stone-200 dark:border-stone-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-4 md:p-6 bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 hover:shadow-md transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
              <Search className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            </div>
            <div className="text-left">
              <h2 className="text-base md:text-lg font-bold text-stone-900 dark:text-white">
                Búsquedas Populares en Córdoba
              </h2>
              <p className="text-xs md:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                Explorá los temas más consultados por nuestros clientes
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800 group-hover:bg-stone-200 dark:group-hover:bg-stone-700 transition-colors"
          >
            <ChevronDown className="w-4 h-4 text-stone-500 dark:text-stone-400" />
          </motion.div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
              className="overflow-hidden"
            >
              <div className="pt-6 pb-2 px-2 md:px-4">
                <div className="flex flex-wrap gap-2 md:gap-3 justify-center md:justify-start">
                  {keywords.map((keyword) => (
                    <Link 
                      key={keyword} 
                      href={`/blog/busquedas/${keyword}`}
                      className="text-[10px] md:text-[11px] font-medium px-3.5 py-1.5 md:px-4 md:py-2 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 rounded-full border border-stone-200 dark:border-stone-700 shadow-sm hover:shadow hover:border-primary/50 hover:text-primary dark:hover:text-primary transition-all duration-300 hover:-translate-y-0.5"
                    >
                      {formatQueryToTitle(keyword)}
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
