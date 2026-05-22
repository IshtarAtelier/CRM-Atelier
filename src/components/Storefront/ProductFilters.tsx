"use client";

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { ChevronDown, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductFiltersProps {
  availableBrands: string[];
}

export function ProductFilters({ availableBrands }: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  // Get current state from URL
  const currentBrand = searchParams.get('marca') || '';
  const currentSort = searchParams.get('orden') || 'recientes';

  // Helper to update URL params cleanly
  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      return params.toString();
    },
    [searchParams]
  );

  const handleFilterChange = (name: string, value: string) => {
    router.push(`${pathname}?${createQueryString(name, value)}`, { scroll: false });
  };

  const clearFilters = () => {
    router.push(pathname, { scroll: false });
  };

  return (
    <>
      {/* Botón flotante para móviles */}
      <button 
        onClick={() => setIsOpen(true)}
        className="lg:hidden w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-4 font-bold tracking-widest text-xs uppercase mb-8 rounded-full"
      >
        <Filter className="w-4 h-4" />
        Filtrar y Ordenar
      </button>

      {/* Contenedor de Filtros (Sidebar en Desktop, Modal en Mobile) */}
      <AnimatePresence>
        {(isOpen || typeof window !== 'undefined' && window.innerWidth >= 1024) && (
          <>
            {/* Overlay para móviles */}
            {isOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
              />
            )}

            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className={`
                fixed lg:relative inset-y-0 left-0 z-50 w-4/5 max-w-sm lg:w-full lg:max-w-none 
                bg-white lg:bg-transparent shadow-2xl lg:shadow-none p-8 lg:p-0 
                overflow-y-auto lg:overflow-visible flex flex-col gap-10
                ${!isOpen ? 'hidden lg:flex' : 'flex'}
              `}
            >
              {/* Cabecera Móvil */}
              <div className="flex lg:hidden items-center justify-between border-b pb-4 mb-4">
                <span className="font-serif text-xl tracking-tight">Filtros</span>
                <button onClick={() => setIsOpen(false)} className="p-2 bg-stone-100 rounded-full">
                  <X className="w-5 h-5 text-stone-600" />
                </button>
              </div>

              {/* Sección Ordenar */}
              <div>
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                  Ordenar por
                </h3>
                <div className="flex flex-col gap-3">
                  {[
                    { id: 'recientes', label: 'Más Recientes' },
                    { id: 'menor_precio', label: 'Menor Precio' },
                    { id: 'mayor_precio', label: 'Mayor Precio' },
                  ].map((option) => (
                    <label key={option.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-4 h-4 rounded-full border border-stone-300 flex items-center justify-center transition-colors ${currentSort === option.id ? 'border-black' : 'group-hover:border-stone-500'}`}>
                        {currentSort === option.id && <div className="w-2 h-2 bg-black rounded-full" />}
                      </div>
                      <input 
                        type="radio" 
                        name="sort" 
                        value={option.id} 
                        checked={currentSort === option.id}
                        onChange={(e) => handleFilterChange('orden', e.target.value)}
                        className="hidden" 
                      />
                      <span className={`text-sm ${currentSort === option.id ? 'font-medium text-black' : 'text-stone-500 group-hover:text-stone-800'}`}>
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sección Marca */}
              {availableBrands.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-stone-900 uppercase tracking-[0.2em] mb-4 border-t lg:border-none pt-8 lg:pt-0">
                    Marca
                  </h3>
                  <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Opción Todas */}
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-4 h-4 rounded border border-stone-300 flex items-center justify-center transition-colors ${!currentBrand ? 'bg-black border-black text-white' : 'group-hover:border-stone-500'}`}>
                        {!currentBrand && <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <input 
                        type="radio" 
                        name="brand" 
                        value="" 
                        checked={!currentBrand}
                        onChange={() => handleFilterChange('marca', '')}
                        className="hidden" 
                      />
                      <span className={`text-sm ${!currentBrand ? 'font-medium text-black' : 'text-stone-500 group-hover:text-stone-800'}`}>
                        Todas las Marcas
                      </span>
                    </label>

                    {/* Lista de Marcas */}
                    {availableBrands.map((brand) => (
                      <label key={brand} className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-4 h-4 rounded border border-stone-300 flex items-center justify-center transition-colors ${currentBrand === brand ? 'bg-black border-black text-white' : 'group-hover:border-stone-500'}`}>
                          {currentBrand === brand && <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <input 
                          type="radio" 
                          name="brand" 
                          value={brand} 
                          checked={currentBrand === brand}
                          onChange={(e) => handleFilterChange('marca', e.target.value)}
                          className="hidden" 
                        />
                        <span className={`text-sm ${currentBrand === brand ? 'font-medium text-black' : 'text-stone-500 group-hover:text-stone-800'}`}>
                          {brand}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón Limpiar Filtros */}
              {(currentBrand || currentSort !== 'recientes') && (
                <button 
                  onClick={clearFilters}
                  className="mt-4 text-xs font-bold text-stone-400 hover:text-black uppercase tracking-[0.1em] transition-colors self-start"
                >
                  Limpiar Filtros
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
