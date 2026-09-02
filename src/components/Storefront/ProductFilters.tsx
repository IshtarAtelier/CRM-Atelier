"use client";

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { track } from '@/lib/client-analytics';

interface ProductFiltersProps {
  availableBrands: string[];
  availableShapes?: string[];
  availableMaterials?: string[];
  /**
   * Cuántos modelos quedan con los filtros puestos. A-04 (auditoría 2/9/26):
   * se filtraba a ciegas — femme + aviador llevaba de 24 a 3 resultados sin
   * ningún aviso en pantalla. El número va en el botón que cierra el panel
   * ("Ver 3 modelos"), que es el momento exacto en que la persona decide si
   * lo que eligió le sirve.
   */
  resultCount?: number;
  /**
   * F1-02: cuántos modelos hay detrás de cada opción, por faceta. Los calcula
   * el endpoint contra los OTROS filtros activos — ver el comentario largo en
   * api/store/products. `null` mientras no llegó la primera respuesta: en ese
   * caso no se muestra ningún número, que es mejor que mostrar uno inventado.
   */
  conteos?: { marca: Record<string, number>; forma: Record<string, number>; material: Record<string, number> } | null;
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
    // A-24 (auditoría 2/9/26): acá se dibujaba la palabra "XL" adentro del
    // ícono, y justo abajo el chip repite la etiqueta — se leía "XL XL". Todas
    // las demás formas muestran un glifo + su nombre; esta era la única que
    // escribía el nombre dos veces. Ahora lleva glifo como el resto: el mismo
    // armazón redondo pero ancho, que es lo que XL quiere decir.
    return (
      <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-3.5 transition-transform group-hover:scale-110 duration-300">
        <rect x="3" y="4.5" width="17" height="15" rx="5" />
        <rect x="28" y="4.5" width="17" height="15" rx="5" />
        <path d="M20 12 C22 10.5, 26 10.5, 28 12" />
      </svg>
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
  availableMaterials = [],
  resultCount,
  conteos = null,
}: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  // R6 del plan: la URL es la fuente de verdad de los filtros, pero el cambio
  // se hace con `replace` dentro de `useTransition`, no con `push`.
  //
  // Con `push`, cada toque a un filtro dejaba una entrada en el historial: si
  // alguien probaba cuatro combinaciones, el botón "atrás" del celular la hacía
  // recorrer las cuatro de vuelta en lugar de volver de donde vino. El filtro
  // no es navegación, es refinar la misma vista.
  //
  // `useTransition` evita el otro síntoma: sin él, React trata el cambio como
  // urgente y la grilla parpadea en blanco mientras llega la respuesta. Con la
  // transición, lo viejo se queda en pantalla (atenuado) hasta que lo nuevo
  // está listo.
  const [isPending, startTransition] = useTransition();
  const navegarAFiltro = (url: string) => {
    startTransition(() => router.replace(url, { scroll: false }));
  };

  const currentBrand = searchParams.get('marca') || '';
  const currentSort = searchParams.get('orden') || 'recientes';
  const currentShape = searchParams.get('forma') || '';
  const currentMaterial = searchParams.get('material') || '';
  const currentGender = searchParams.get('genero') || '';
  const currentPrecioMin = searchParams.get('precioMin') || '';
  const currentPrecioMax = searchParams.get('precioMax') || '';

  // Helper to update URL params cleanly
  // Un filtro puesto en su valor por defecto no cambia nada de lo que se ve, así
  // que no tiene por qué ocupar lugar en la URL: el link que se comparte queda
  // corto y legible. Sin esto, elegir "Más recientes" agregaba ?orden=recientes.
  const VALOR_POR_DEFECTO: Record<string, string> = { orden: 'recientes' };

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== VALOR_POR_DEFECTO[name]) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      return params.toString();
    },
    [searchParams]
  );

  const handleFilterChange = (name: string, value: string) => {
    // A-19: sin esto no había forma de saber si la gente filtra. Es la métrica
    // que la auditoría pide para validar el rediseño del panel (A-03/A-04):
    // "filtros aplicados por sesión en celular", hoy sin dato.
    track('filtro_aplicado', {
      meta: { filtro: name, valor: value || '(quitado)', resultados: resultCount ?? null },
    });
    const qs = createQueryString(name, value);
    navegarAFiltro(qs ? `${pathname}?${qs}` : pathname);
  };

  const clearFilters = () => {
    navegarAFiltro(pathname);
  };

  /**
   * F1-02: el conteo de una opción, sin depender de cómo esté escrita.
   * `undefined` = todavía no llegó la respuesta (no se muestra número).
   */
  const conteoDe = (faceta: 'marca' | 'forma' | 'material', valor: string): number | undefined => {
    const tabla = conteos?.[faceta];
    if (!tabla) return undefined;
    const clave = Object.keys(tabla).find(k => k.toLowerCase() === valor.toLowerCase());
    return clave ? tabla[clave] : 0;
  };

  /**
   * Las opciones con cero van al FINAL, nunca ocultas (lo pide el plan): que
   * desaparezcan hace pensar que el catálogo se achicó. La opción elegida se
   * queda donde está aunque su conteo sea 0, o saltaría de lugar al tocarla.
   */
  const ordenarPorConteo = (faceta: 'marca' | 'forma' | 'material', lista: string[], seleccionada: string) =>
    [...lista].sort((a, b) => {
      if (a.toLowerCase() === seleccionada.toLowerCase()) return -1;
      if (b.toLowerCase() === seleccionada.toLowerCase()) return 1;
      const ca = conteoDe(faceta, a) ?? 1;
      const cb = conteoDe(faceta, b) ?? 1;
      if ((ca === 0) !== (cb === 0)) return ca === 0 ? 1 : -1;
      return 0;
    });

  /** Cuántos filtros hay puestos. El orden no cuenta: no achica el resultado. */
  const filtrosPuestos = [currentBrand, currentShape, currentMaterial, currentGender, currentPrecioMin || currentPrecioMax].filter(Boolean).length;

  /**
   * El rango de precio son DOS parámetros que se mueven juntos (A-08), así que
   * no puede pasar por `handleFilterChange`, que escribe de a uno: elegir un
   * rango tiene que borrar el anterior completo, no dejar el `precioMax` viejo
   * conviviendo con el `precioMin` nuevo.
   */
  const cambiarRangoDePrecio = (min: string, max: string) => {
    track('filtro_aplicado', {
      meta: { filtro: 'precio', valor: min || max ? `${min || '0'}-${max || '∞'}` : '(quitado)', resultados: resultCount ?? null },
    });
    const params = new URLSearchParams(searchParams.toString());
    if (min) params.set('precioMin', min); else params.delete('precioMin');
    if (max) params.set('precioMax', max); else params.delete('precioMax');
    const qs = params.toString();
    navegarAFiltro(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <>
      {/* Botón flotante para móviles. A-04: lleva la cuenta de filtros puestos,
          que antes no se veía en ningún lado — se podía volver de una ficha sin
          saber que la grilla seguía filtrada. */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-4 font-bold tracking-widest text-xs uppercase mb-5 rounded-full hover:bg-[#c8a55c] transition-colors duration-300"
      >
        <Filter className="w-4 h-4" />
        Filtrar y Ordenar
        {filtrosPuestos > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-white text-stone-900 text-[10px] font-black">
            {filtrosPuestos}
          </span>
        )}
      </button>

      {/* Contenedor de Filtros (Sidebar en Desktop, Modal en Mobile) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <div 
        className={`
          fixed lg:relative inset-y-0 left-0 z-50 lg:z-0 w-4/5 max-w-sm lg:w-full lg:max-w-none
          bg-white lg:bg-transparent shadow-2xl lg:shadow-none p-8 pb-28 lg:p-0 lg:px-2 lg:py-0
          overflow-y-auto lg:overflow-visible flex-col gap-10
          transition-[transform,opacity] duration-300 ease-in-out
          ${isOpen ? 'translate-x-0 flex' : '-translate-x-full lg:translate-x-0 hidden lg:flex'}
          ${isPending ? 'opacity-60' : 'opacity-100'}
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
                <h3 className="text-[10px] font-bold text-[#8a6d3b] dark:text-stone-200 uppercase tracking-[0.25em] mb-4">
                  Ordenar por
                </h3>
                <div className="flex flex-col gap-3">
                  {/* A-23 (auditoría 2/9/26): acá figuraba "Forma del Armazón"
                      como criterio de ORDEN, y la forma también existe abajo
                      como FILTRO. El mismo campo cumplía dos roles
                      contradictorios: ordenar por forma no ordena nada que la
                      persona pueda comparar (¿aviador va antes que redondo?).
                      El orden queda solo con cosas comparables. Una URL vieja
                      con ?orden=forma sigue funcionando: el backend la ignora
                      y cae en el orden por defecto. */}
                  {[
                    { id: 'recientes', label: 'Más Recientes' },
                    { id: 'menor_precio', label: 'Menor Precio' },
                    { id: 'mayor_precio', label: 'Mayor Precio' },
                  ].map((option) => (
                    <label key={option.id} className="flex items-center gap-3 cursor-pointer group min-h-11">
                      <div className={`w-4 h-4 rounded-full border border-stone-300 dark:border-stone-700 flex items-center justify-center transition-colors ${currentSort === option.id ? 'border-[#c8a55c]' : 'group-hover:border-stone-500'}`}>
                        {currentSort === option.id && <div className="w-2 h-2 bg-[#c8a55c] rounded-full" />}
                      </div>
                      <input 
                        type="radio" 
                        name="sort" 
                        value={option.id} 
                        checked={currentSort === option.id}
                        onChange={(e) => {
                          // F1-08 / Anexo C: el orden es su propio evento, no un
                          // filtro. Sirve para otra pregunta: si mucha gente
                          // ordena por precio, el catálogo se está leyendo como
                          // caro y eso se responde con merchandising, no con
                          // filtros.
                          track('sort_changed', { meta: { sort_value: e.target.value } });
                          handleFilterChange('orden', e.target.value);
                        }}
                        className="hidden" 
                      />
                      <span className={`text-sm ${currentSort === option.id ? 'font-semibold text-[#8a6d3b] dark:text-white' : 'text-stone-500 dark:text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-200'}`}>
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sección Precio — A-08 (auditoría 2/9/26).
                  De los tres filtros que la auditoría marca como los que
                  realmente decide un comprador de anteojos (precio, color y
                  calce), este es el que no faltaba solo en la UI: faltaba
                  entero. Tres rangos fijos, no un slider: con 106 modelos un
                  slider pide precisión que nadie tiene ("¿mi tope son 180 o
                  190 mil?") y en celular es el control más difícil de acertar. */}
              <div>
                <h3 className="text-[10px] font-bold text-[#8a6d3b] dark:text-stone-200 uppercase tracking-[0.25em] mb-4 border-t border-stone-100 lg:border-none pt-8 lg:pt-0">
                  Precio
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: '', etiqueta: 'Todos', min: '', max: '' },
                    { id: 'hasta-150', etiqueta: 'Hasta $150.000', min: '', max: '150000' },
                    { id: '150-250', etiqueta: '$150.000 a $250.000', min: '150000', max: '250000' },
                    { id: 'desde-250', etiqueta: 'Más de $250.000', min: '250000', max: '' },
                  ].map(rango => {
                    const activo = currentPrecioMin === rango.min && currentPrecioMax === rango.max;
                    return (
                      <button
                        key={rango.id || 'todos'}
                        onClick={() => cambiarRangoDePrecio(rango.min, rango.max)}
                        className={`px-4 min-h-11 inline-flex items-center text-[10px] font-black uppercase tracking-widest rounded-full border transition-all duration-300 ${
                          activo
                            ? 'border-[#c8a55c] bg-[#c8a55c] text-white shadow-md shadow-[#c8a55c]/20 scale-[1.02]'
                            : 'border-stone-200 text-stone-600 hover:border-stone-900 hover:text-stone-900'
                        }`}
                      >
                        {rango.etiqueta}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sección Género */}
              <div>
                <h3 className="text-[10px] font-bold text-[#8a6d3b] dark:text-stone-200 uppercase tracking-[0.25em] mb-4 border-t border-stone-100 lg:border-none pt-8 lg:pt-0">
                  Género
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleFilterChange('genero', '')}
                    className={`px-4 min-h-11 inline-flex items-center text-[10px] font-black uppercase tracking-widest rounded-full border transition-all duration-300 ${
                      !currentGender
                        ? 'border-[#c8a55c] bg-[#c8a55c] text-white shadow-md shadow-[#c8a55c]/20 scale-[1.02]'
                        : 'border-stone-200 hover:border-[#c8a55c]/50 bg-white text-stone-600 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-400 hover:bg-stone-50/50 dark:hover:bg-stone-800/30'
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
                        className={`px-4 min-h-11 inline-flex items-center text-[10px] font-black uppercase tracking-widest rounded-full border transition-all duration-300 ${
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
                  <h3 className="text-[10px] font-bold text-[#8a6d3b] dark:text-stone-200 uppercase tracking-[0.25em] mb-4 border-t border-stone-100 lg:border-none pt-8 lg:pt-0">
                    Forma
                  </h3>
                  <div className="grid grid-cols-2 gap-2 pr-1">
                    {/* Opción Todas */}
                    <button
                      onClick={() => handleFilterChange('forma', '')}
                      className={`group flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-center transition-all duration-300 ${
                        !currentShape
                          ? 'border-[#c8a55c] bg-[#c8a55c] text-white shadow-md shadow-[#c8a55c]/20 scale-[1.02]'
                          : 'border-stone-200 hover:border-[#c8a55c]/50 bg-white text-stone-700 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-300 hover:bg-stone-50/50 dark:hover:bg-stone-800/30'
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
                    {ordenarPorConteo('forma', availableShapes, currentShape).map((shape) => {
                      const isSelected = currentShape.toLowerCase() === shape.toLowerCase();
                      const n = conteoDe('forma', shape);
                      const vacia = n === 0 && !isSelected;
                      return (
                        <button
                          key={shape}
                          disabled={vacia}
                          title={vacia ? 'No hay modelos con esta forma y los filtros puestos' : undefined}
                          onClick={() => handleFilterChange('forma', isSelected ? '' : shape)}
                          className={`group flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-center transition-all duration-300 ${
                            isSelected
                              ? 'border-stone-950 bg-stone-900 text-white dark:bg-stone-50 dark:text-stone-950 dark:border-stone-50 shadow-md scale-[1.02]'
                              : `border-stone-200 bg-white text-stone-700 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-300 ${vacia ? 'opacity-40 cursor-not-allowed' : 'hover:border-stone-400 hover:bg-stone-50/50 dark:hover:bg-stone-800/30'}`
                          }`}
                        >
                          <div className="w-8 h-4 flex items-center justify-center mb-1">
                            {getShapeIcon(shape)}
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-wider">
                            {shape}{typeof n === 'number' && <span className="ml-1 opacity-60">({n})</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sección Material */}
              {availableMaterials.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold text-[#8a6d3b] dark:text-stone-200 uppercase tracking-[0.25em] mb-4 border-t border-stone-100 lg:border-none pt-8 lg:pt-0">
                    Material
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleFilterChange('material', '')}
                      className={`px-4 min-h-11 inline-flex items-center text-[10px] font-black uppercase tracking-widest rounded-full border transition-all duration-300 ${
                        !currentMaterial
                          ? 'border-stone-950 bg-stone-900 text-white dark:bg-stone-50 dark:text-stone-950 shadow-md scale-[1.02]'
                          : 'border-stone-200 hover:border-stone-400 bg-white text-stone-600 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-400 hover:bg-stone-50/50 dark:hover:bg-stone-800/30'
                      }`}
                    >
                      Todos
                    </button>
                    {ordenarPorConteo('material', availableMaterials, currentMaterial).map((material) => {
                      const isSelected = currentMaterial.toLowerCase() === material.toLowerCase();
                      const n = conteoDe('material', material);
                      const vacia = n === 0 && !isSelected;
                      return (
                        <button
                          key={material}
                          disabled={vacia}
                          title={vacia ? 'No hay modelos de este material con los filtros puestos' : undefined}
                          onClick={() => handleFilterChange('material', isSelected ? '' : material)}
                          className={`px-4 min-h-11 inline-flex items-center text-[10px] font-black uppercase tracking-widest rounded-full border transition-all duration-300 ${
                            isSelected
                              ? 'border-stone-950 bg-stone-900 text-white dark:bg-stone-50 dark:text-stone-950 shadow-md scale-[1.02]'
                              : 'border-stone-200 hover:border-stone-400 bg-white text-stone-600 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-400 hover:bg-stone-50/50 dark:hover:bg-stone-800/30'
                          }`}
                        >
                          {material}{typeof n === 'number' && <span className="ml-1 opacity-60">({n})</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sección Marca */}
              {availableBrands.length > 1 && (
                <div>
                  <h3 className="text-[10px] font-bold text-[#8a6d3b] dark:text-stone-200 uppercase tracking-[0.25em] mb-4 border-t border-stone-100 lg:border-none pt-8 lg:pt-0">
                    Marca
                  </h3>
                  <div className="flex flex-col gap-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Opción Todas */}
                    <label className="flex items-center gap-3 cursor-pointer group min-h-11">
                      <div className={`w-4 h-4 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center transition-colors ${!currentBrand ? 'bg-[#c8a55c] border-[#c8a55c] text-white' : 'group-hover:border-stone-500'}`}>
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
                      <span className={`text-base tracking-wide ${!currentBrand ? 'font-bold text-[#8a6d3b] dark:text-white' : 'text-stone-500 dark:text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-200'}`}>
                        Todas las Marcas
                      </span>
                    </label>

                    {/* Lista de Marcas */}
                    {ordenarPorConteo('marca', availableBrands, currentBrand).map((brand) => (
                      <label key={brand} className="flex items-center gap-3 cursor-pointer group min-h-11">
                        <div className={`w-5 h-5 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center transition-colors ${currentBrand === brand ? 'bg-[#c8a55c] border-[#c8a55c] text-white' : 'group-hover:border-stone-500'}`}>
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
                        <span className={`text-base tracking-wide ${currentBrand === brand ? 'font-bold text-[#8a6d3b] dark:text-white' : 'text-stone-500 dark:text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-200'}`}>
                          {brand}{typeof conteoDe('marca', brand) === 'number' && (
                            <span className="ml-1.5 text-sm opacity-60">({conteoDe('marca', brand)})</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón Limpiar Filtros — en escritorio, donde no hay pie fijo. */}
              {(currentBrand || currentShape || currentMaterial || currentGender || currentSort !== 'recientes') && (
                <button
                  onClick={clearFilters}
                  className="hidden lg:block mt-4 text-xs font-bold text-stone-400 hover:text-[#8a6d3b] dark:hover:text-white uppercase tracking-[0.1em] transition-colors self-start"
                >
                  Limpiar Filtros
                </button>
              )}

              {/* A-03 y A-04: el pie fijo del panel en celular.
                  Antes había que cerrar el panel a mano (o con la X) para ver
                  cuántos modelos habían quedado, y "limpiar" era un texto gris
                  perdido al final de un panel que scrollea. Acá está el número
                  vivo —se actualiza con cada toque— y las dos salidas, siempre
                  a la vista y del tamaño de un pulgar. */}
              <div className="lg:hidden fixed bottom-0 left-0 w-4/5 max-w-sm bg-white border-t border-stone-200 px-6 py-4 flex items-center gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
                {filtrosPuestos > 0 && (
                  <button
                    onClick={clearFilters}
                    className="min-h-11 px-4 text-[11px] font-black uppercase tracking-widest text-stone-600 border border-stone-300 rounded-full hover:border-stone-900 hover:text-stone-900 transition-colors whitespace-nowrap"
                  >
                    Limpiar
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 min-h-11 bg-stone-900 text-white text-[11px] font-black uppercase tracking-widest rounded-full hover:bg-[#c8a55c] transition-colors"
                >
                  {typeof resultCount === 'number'
                    ? `Ver ${resultCount} ${resultCount === 1 ? 'modelo' : 'modelos'}`
                    : 'Ver resultados'}
                </button>
              </div>
            </div>
    </>
  );
}
