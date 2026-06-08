"use client";

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { ChevronDown, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductFiltersProps {
  availableBrands: string[];
  availableShapes?: string[];
  availableMaterials?: string[];
}

function getShapeIcon(shape: string) {
  const s = shape.toLowerCase();
  if (s.includes('redondo')) {
    return (
      <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-6 transition-transform group-hover:scale-110 duration-300">
        <circle cx="14" cy="12" r="7.5" />
        <circle cx="34" cy="12" r="7.5" />
        <path d="M21.5 12 C24 10.5, 24 10.5, 26.5 12" />
        <path d="M4 12 C4 11, 2 11, 2 11" />
        <path d="M44 12 C44 11, 46 11, 46 11" />
      </svg>
    );
  }
  if (s.includes('cuadrado')) {
    return (
      <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-6 transition-transform group-hover:scale-110 duration-300">
        <rect x="5" y="5" width="14" height="14" rx="2" />
        <rect x="29" y="5" width="14" height="14" rx="2" />
        <path d="M19 12 C22 10.5, 26 10.5, 29 12" />
        <path d="M2 11 L5 11" />
        <path d="M43 11 L46 11" />
      </svg>
    );
  }
  if (s.includes('aviador')) {
    return (
      <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-6 transition-transform group-hover:scale-110 duration-300">
        <path d="M6 8 C6 5.5, 19 4.5, 19 11 C19 16.5, 13.5 19, 10.5 19 C7.5 19, 6 15.5, 6 8 Z" />
        <path d="M42 8 C42 5.5, 29 4.5, 29 11 C29 16.5, 34.5 19, 37.5 19 C40.5 19, 42 15.5, 42 8 Z" />
        <path d="M19 9 L29 9" />
        <path d="M18 12 L30 12" />
      </svg>
    );
  }
  if (s.includes('hexagonal')) {
    return (
      <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-6 transition-transform group-hover:scale-110 duration-300">
        <polygon points="12,5 18,8.5 18,15.5 12,19 6,15.5 6,8.5" />
        <polygon points="36,5 42,8.5 42,15.5 36,19 30,15.5 30,8.5" />
        <path d="M18 12 C22 10.5, 26 10.5, 30 12" />
      </svg>
    );
  }
  if (s.includes('cat-eye') || s.includes('gato')) {
    return (
      <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-6 transition-transform group-hover:scale-110 duration-300">
        <path d="M5 6.5 C9.5 6.5, 19 8, 19 13.5 C19 18.5, 11.5 18.5, 8 16.5 C5 14.5, 4.5 10.5, 5 6.5 Z" />
        <path d="M43 6.5 C38.5 6.5, 29 8, 29 13.5 C29 18.5, 36.5 18.5, 40 16.5 C43 14.5, 43.5 10.5, 43 6.5 Z" />
        <path d="M19 12 C22 10.5, 26 10.5, 29 12" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-6">
      <circle cx="13" cy="12" r="7.5" />
      <circle cx="35" cy="12" r="7.5" />
      <path d="M20.5 12 L27.5 12" />
    </svg>
  );
}

export function ProductFilters({ 
  availableBrands, 
  availableShapes = [], 
  availableMaterials = [] 
}: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  // Get current state from URL
  const currentBrand = searchParams.get('marca') || '';
  const currentSort = searchParams.get('orden') || 'recientes';
  const currentShape = searchParams.get('forma') || '';
  const currentMaterial = searchParams.get('material') || '';

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
                <h3 className="text-xs font-bold text-stone-900 dark:text-stone-200 uppercase tracking-[0.2em] mb-4">
                  Ordenar por
                </h3>
                <div className="flex flex-col gap-3">
                  {[
                    { id: 'recientes', label: 'Más Recientes' },
                    { id: 'menor_precio', label: 'Menor Precio' },
                    { id: 'mayor_precio', label: 'Mayor Precio' },
                  ].map((option) => (
                    <label key={option.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-4 h-4 rounded-full border border-stone-300 dark:border-stone-700 flex items-center justify-center transition-colors ${currentSort === option.id ? 'border-black dark:border-white' : 'group-hover:border-stone-500'}`}>
                        {currentSort === option.id && <div className="w-2 h-2 bg-black dark:bg-white rounded-full" />}
                      </div>
                      <input 
                        type="radio" 
                        name="sort" 
                        value={option.id} 
                        checked={currentSort === option.id}
                        onChange={(e) => handleFilterChange('orden', e.target.value)}
                        className="hidden" 
                      />
                      <span className={`text-sm ${currentSort === option.id ? 'font-medium text-black dark:text-white' : 'text-stone-500 dark:text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-200'}`}>
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sección Forma */}
              {availableShapes.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-stone-900 dark:text-stone-200 uppercase tracking-[0.2em] mb-4 border-t lg:border-none pt-8 lg:pt-0">
                    Forma
                  </h3>
                  <div className="grid grid-cols-2 gap-2 pr-1">
                    {/* Opción Todas */}
                    <button
                      onClick={() => handleFilterChange('forma', '')}
                      className={`group flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-300 ${
                        !currentShape
                          ? 'border-stone-950 bg-stone-900 text-white dark:bg-stone-50 dark:text-stone-950 dark:border-stone-50 shadow-md scale-[1.02]'
                          : 'border-stone-200 hover:border-stone-400 bg-white text-stone-700 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-300 hover:bg-stone-50/50 dark:hover:bg-stone-800/30'
                      }`}
                    >
                      <div className="w-12 h-6 flex items-center justify-center opacity-70 group-hover:opacity-100 mb-2">
                        <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-6 transition-transform group-hover:scale-110 duration-300">
                          <circle cx="13" cy="12" r="7.5" />
                          <circle cx="35" cy="12" r="7.5" />
                          <path d="M20.5 12 L27.5 12" />
                        </svg>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider">Todas</span>
                    </button>

                    {/* Lista de Formas */}
                    {availableShapes.map((shape) => {
                      const isSelected = currentShape.toLowerCase() === shape.toLowerCase();
                      return (
                        <button
                          key={shape}
                          onClick={() => handleFilterChange('forma', isSelected ? '' : shape)}
                          className={`group flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-300 ${
                            isSelected
                              ? 'border-stone-950 bg-stone-900 text-white dark:bg-stone-50 dark:text-stone-950 dark:border-stone-50 shadow-md scale-[1.02]'
                              : 'border-stone-200 hover:border-stone-400 bg-white text-stone-700 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-300 hover:bg-stone-50/50 dark:hover:bg-stone-800/30'
                          }`}
                        >
                          <div className="w-12 h-6 flex items-center justify-center mb-2">
                            {getShapeIcon(shape)}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-wider">{shape}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sección Material */}
              {availableMaterials.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-stone-900 dark:text-stone-200 uppercase tracking-[0.2em] mb-4 border-t lg:border-none pt-8 lg:pt-0">
                    Material
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleFilterChange('material', '')}
                      className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full border transition-all duration-300 ${
                        !currentMaterial
                          ? 'border-stone-950 bg-stone-900 text-white dark:bg-stone-50 dark:text-stone-950 shadow-md scale-[1.02]'
                          : 'border-stone-200 hover:border-stone-400 bg-white text-stone-600 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-400 hover:bg-stone-50/50 dark:hover:bg-stone-800/30'
                      }`}
                    >
                      Todos
                    </button>
                    {availableMaterials.map((material) => {
                      const isSelected = currentMaterial.toLowerCase() === material.toLowerCase();
                      return (
                        <button
                          key={material}
                          onClick={() => handleFilterChange('material', isSelected ? '' : material)}
                          className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full border transition-all duration-300 ${
                            isSelected
                              ? 'border-stone-950 bg-stone-900 text-white dark:bg-stone-50 dark:text-stone-950 shadow-md scale-[1.02]'
                              : 'border-stone-200 hover:border-stone-400 bg-white text-stone-600 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-400 hover:bg-stone-50/50 dark:hover:bg-stone-800/30'
                          }`}
                        >
                          {material}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sección Marca */}
              {availableBrands.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-stone-900 dark:text-stone-200 uppercase tracking-[0.2em] mb-4 border-t lg:border-none pt-8 lg:pt-0">
                    Marca
                  </h3>
                  <div className="flex flex-col gap-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Opción Todas */}
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-4 h-4 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center transition-colors ${!currentBrand ? 'bg-black border-black text-white dark:bg-white dark:border-white dark:text-stone-950' : 'group-hover:border-stone-500'}`}>
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
                      <span className={`text-sm ${!currentBrand ? 'font-medium text-black dark:text-white' : 'text-stone-500 dark:text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-200'}`}>
                        Todas las Marcas
                      </span>
                    </label>

                    {/* Lista de Marcas */}
                    {availableBrands.map((brand) => (
                      <label key={brand} className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-4 h-4 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center transition-colors ${currentBrand === brand ? 'bg-black border-black text-white dark:bg-white dark:border-white dark:text-stone-950' : 'group-hover:border-stone-500'}`}>
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
                        <span className={`text-sm ${currentBrand === brand ? 'font-medium text-black dark:text-white' : 'text-stone-500 dark:text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-200'}`}>
                          {brand}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón Limpiar Filtros */}
              {(currentBrand || currentShape || currentMaterial || currentSort !== 'recientes') && (
                <button 
                  onClick={clearFilters}
                  className="mt-4 text-xs font-bold text-stone-400 hover:text-black dark:hover:text-white uppercase tracking-[0.1em] transition-colors self-start"
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
