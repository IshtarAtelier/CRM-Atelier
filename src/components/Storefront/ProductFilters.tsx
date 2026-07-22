"use client";

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Filter, X } from 'lucide-react';

interface ProductFiltersProps {
  availableBrands: string[];
  availableShapes?: string[];
  availableMaterials?: string[];
}

function getShapeIcon(shape: string) {
  const s = shape.toLowerCase();
  if (s.includes('redondo')) {
    return (
      <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-3 transition-transform group-hover:scale-110 duration-300">
        <circle cx="14.5" cy="12" r="6.5" />
        <circle cx="33.5" cy="12" r="6.5" />
        <path d="M21 12 C22.5 10.5, 25.5 10.5, 27 12" />
      </svg>
    );
  }
  if (s.includes('cuadrado')) {
    return (
      <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-3 transition-transform group-hover:scale-110 duration-300">
        <rect x="8" y="5.5" width="13" height="13" rx="2.5" />
        <rect x="27" y="5.5" width="13" height="13" rx="2.5" />
        <path d="M21 12 C22.5 10.5, 25.5 10.5, 27 12" />
      </svg>
    );
  }
  if (s.includes('aviador')) {
    return (
      <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-3 transition-transform group-hover:scale-110 duration-300">
        <path d="M20.5 8 C20.5 5.5, 8.5 5.5, 8.5 11 C8.5 16, 13 18.5, 17 18.5 C19.5 18.5, 20.5 15, 20.5 8 Z" />
        <path d="M27.5 8 C27.5 5.5, 39.5 5.5, 39.5 11 C39.5 16, 35 18.5, 31 18.5 C28.5 18.5, 27.5 15, 27.5 8 Z" />
        <path d="M20.5 8.5 H27.5" />
        <path d="M21 11.5 Q24 10 27 11.5" />
      </svg>
    );
  }
  if (s.includes('hexagonal')) {
    return (
      <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-3 transition-transform group-hover:scale-110 duration-300">
        <polygon points="11.5,5.5 17.5,5.5 21,12 17.5,18.5 11.5,18.5 8,12" />
        <polygon points="30.5,5.5 36.5,5.5 40,12 36.5,18.5 30.5,18.5 27,12" />
        <path d="M21 12 C22.5 10.5, 25.5 10.5, 27 12" />
      </svg>
    );
  }
  if (s.includes('cat-eye') || s.includes('gato')) {
    return (
      <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-3 transition-transform group-hover:scale-110 duration-300">
        <path d="M7.5 7 C11.5 6.5, 20.5 8, 20.5 13 C20.5 17, 13.5 18.5, 10 16.5 C7.5 14.5, 7 10.5, 7.5 7 Z" />
        <path d="M40.5 7 C36.5 6.5, 27.5 8, 27.5 13 C27.5 17, 34.5 18.5, 38 16.5 C40.5 14.5, 41 10.5, 40.5 7 Z" />
        <path d="M20.5 12 C22 10.5, 26 10.5, 27.5 12" />
      </svg>
    );
  }
  if (s.includes('xl')) {
    return (
      <div className="w-8 h-4 flex items-center justify-center font-black text-[8px] tracking-widest border border-current/30 rounded-sm transition-transform group-hover:scale-110 duration-300">
        XL
      </div>
    );
  }
  return (
    <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-3">
      <circle cx="14.5" cy="12" r="6.5" />
      <circle cx="33.5" cy="12" r="6.5" />
      <path d="M21 12 C22.5 10.5, 25.5 10.5, 27 12" />
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

  const currentBrand = searchParams.get('marca') || '';
  const currentSort = searchParams.get('orden') || 'recientes';
  const currentShape = searchParams.get('forma') || '';
  const currentMaterial = searchParams.get('material') || '';
  const currentGender = searchParams.get('genero') || '';

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

      {/* Contenedor de Filtros (Sidebar en Desktop, Modal en Mobile).
          Backdrop con fade CSS puro — se sacó framer-motion para que la librería
          no viaje en el bundle inicial de /tienda (eran ~40 KiB, casi todo sin usar
          hasta que el visitante abre los filtros). */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm animate-[backdropFade_0.2s_ease-out]"
        />
      )}

      <div 
        className={`
          fixed lg:relative inset-y-0 left-0 z-50 lg:z-0 w-4/5 max-w-sm lg:w-full lg:max-w-none
          bg-white lg:bg-transparent shadow-2xl lg:shadow-none p-8 lg:px-2 lg:py-0
          overflow-y-auto lg:overflow-visible flex-col gap-10
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0 flex' : '-translate-x-full lg:translate-x-0 hidden lg:flex'}
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
                    { id: 'forma', label: 'Forma del Armazón' },
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

              {/* Sección Género */}
              <div>
                <h3 className="text-xs font-bold text-stone-900 dark:text-stone-200 uppercase tracking-[0.2em] mb-4 border-t lg:border-none pt-8 lg:pt-0">
                  Género
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleFilterChange('genero', '')}
                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full border transition-all duration-300 ${
                      !currentGender
                        ? 'border-stone-950 bg-stone-900 text-white dark:bg-stone-50 dark:text-stone-950 shadow-md scale-[1.02]'
                        : 'border-stone-200 hover:border-stone-400 bg-white text-stone-600 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-400 hover:bg-stone-50/50 dark:hover:bg-stone-800/30'
                    }`}
                  >
                    Todos
                  </button>
                  {[
                    { id: 'femme', label: 'Femme' },
                    { id: 'homme', label: 'Homme' },
                    { id: 'no_gender', label: 'No Gender' }
                  ].map((genderOption) => {
                    const isSelected = currentGender === genderOption.id;
                    return (
                      <button
                        key={genderOption.id}
                        onClick={() => handleFilterChange('genero', isSelected ? '' : genderOption.id)}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full border transition-all duration-300 ${
                          isSelected
                            ? 'border-stone-950 bg-stone-900 text-white dark:bg-stone-50 dark:text-stone-950 shadow-md scale-[1.02]'
                            : 'border-stone-200 hover:border-stone-400 bg-white text-stone-600 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-400 hover:bg-stone-50/50 dark:hover:bg-stone-800/30'
                        }`}
                      >
                        {genderOption.label}
                      </button>
                    );
                  })}
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
                      className={`group flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-center transition-all duration-300 ${
                        !currentShape
                          ? 'border-stone-950 bg-stone-900 text-white dark:bg-stone-50 dark:text-stone-950 dark:border-stone-50 shadow-md scale-[1.02]'
                          : 'border-stone-200 hover:border-stone-400 bg-white text-stone-700 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-300 hover:bg-stone-50/50 dark:hover:bg-stone-800/30'
                      }`}
                    >
                      <div className="w-8 h-4 flex items-center justify-center opacity-70 group-hover:opacity-100 mb-1">
                        <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-3 transition-transform group-hover:scale-110 duration-300">
                          <circle cx="14.5" cy="12" r="6.5" />
                          <circle cx="33.5" cy="12" r="6.5" />
                          <path d="M21 12 C22.5 10.5, 25.5 10.5, 27 12" />
                        </svg>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-wider">Todas</span>
                    </button>
 
                    {/* Lista de Formas */}
                    {availableShapes.map((shape) => {
                      const isSelected = currentShape.toLowerCase() === shape.toLowerCase();
                      return (
                        <button
                          key={shape}
                          onClick={() => handleFilterChange('forma', isSelected ? '' : shape)}
                          className={`group flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-center transition-all duration-300 ${
                            isSelected
                              ? 'border-stone-950 bg-stone-900 text-white dark:bg-stone-50 dark:text-stone-950 dark:border-stone-50 shadow-md scale-[1.02]'
                              : 'border-stone-200 hover:border-stone-400 bg-white text-stone-700 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-300 hover:bg-stone-50/50 dark:hover:bg-stone-800/30'
                          }`}
                        >
                          <div className="w-8 h-4 flex items-center justify-center mb-1">
                            {getShapeIcon(shape)}
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-wider">{shape}</span>
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
              {availableBrands.length > 1 && (
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
                      <span className={`text-base tracking-wide ${!currentBrand ? 'font-bold text-black dark:text-white' : 'text-stone-500 dark:text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-200'}`}>
                        Todas las Marcas
                      </span>
                    </label>

                    {/* Lista de Marcas */}
                    {availableBrands.map((brand) => (
                      <label key={brand} className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center transition-colors ${currentBrand === brand ? 'bg-black border-black text-white dark:bg-white dark:border-white dark:text-stone-950' : 'group-hover:border-stone-500'}`}>
                          {currentBrand === brand && <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <input 
                          type="radio" 
                          name="brand" 
                          value={brand} 
                          checked={currentBrand === brand}
                          onChange={() => handleFilterChange('marca', brand)}
                          className="hidden" 
                        />
                        <span className={`text-base tracking-wide ${currentBrand === brand ? 'font-bold text-black dark:text-white' : 'text-stone-500 dark:text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-200'}`}>
                          {brand}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón Limpiar Filtros */}
              {(currentBrand || currentShape || currentMaterial || currentGender || currentSort !== 'recientes') && (
                <button 
                  onClick={clearFilters}
                  className="mt-4 text-xs font-bold text-stone-400 hover:text-black dark:hover:text-white uppercase tracking-[0.1em] transition-colors self-start"
                >
                  Limpiar Filtros
                </button>
              )}
            </div>
    </>
  );
}
