'use client';

/**
 * Cabecera del listado: título, archivados, buscador y chips de filtro.
 *
 * Accesibilidad: los chips estaban en `text-[11px]` sobre blanco y el activo se
 * distinguía SOLO por el color de fondo. Ahora el activo lleva `aria-pressed`
 * y un ✓ visible, y los targets llegan a 40 px de alto.
 */

import { Archive, ArchiveRestore, Search } from 'lucide-react';
import { getLabelStyle } from '../format';
import type { ReadFilter } from '../types';

export interface ChatFiltersProps {
    cantidad: number;
    verArchivados: boolean;
    onVerArchivados: (valor: boolean) => void;
    busqueda: string;
    onBusqueda: (valor: string) => void;
    filtroEtiqueta: string | null;
    onFiltroEtiqueta: (valor: string | null) => void;
    filtroLectura: ReadFilter;
    onFiltroLectura: (valor: ReadFilter) => void;
    etiquetasUsadas: string[];
}

const chipBase =
    'px-3.5 min-h-10 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 border inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600';

export function ChatFilters({
    cantidad,
    verArchivados,
    onVerArchivados,
    busqueda,
    onBusqueda,
    filtroEtiqueta,
    onFiltroEtiqueta,
    filtroLectura,
    onFiltroLectura,
    etiquetasUsadas,
}: ChatFiltersProps) {
    const todos = !filtroEtiqueta && filtroLectura === 'ALL';

    return (
        <div className="p-5 border-b border-stone-200/60 dark:border-white/10">
            <div className="flex items-center justify-between mb-4 gap-2">
                <h2 className="text-sm font-black text-stone-900 dark:text-white tracking-tight">
                    {verArchivados ? 'Buzón archivado' : 'Buzón activo'}
                    <span className="ml-2 text-stone-600 dark:text-stone-400 font-medium">({cantidad})</span>
                </h2>
                <button
                    type="button"
                    onClick={() => { onVerArchivados(!verArchivados); onFiltroEtiqueta(null); }}
                    aria-pressed={verArchivados}
                    title={verArchivados ? 'Volver al buzón activo' : 'Ver conversaciones archivadas'}
                    className={`min-w-10 min-h-10 px-2.5 rounded-xl inline-flex items-center justify-center gap-1.5 text-[11px] font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                        verArchivados
                            ? 'bg-stone-900 text-white shadow-md dark:bg-white dark:text-stone-900'
                            : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-stone-700 hover:bg-stone-50'
                    }`}
                >
                    {verArchivados ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    <span className="sr-only sm:not-sr-only">{verArchivados ? 'Activos' : 'Archivados'}</span>
                </button>
            </div>

            <div className="mb-4 relative">
                <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
                <input
                    type="search"
                    aria-label="Buscar cliente o número"
                    placeholder="Buscar cliente o número..."
                    value={busqueda}
                    onChange={e => onBusqueda(e.target.value)}
                    className="w-full min-h-10 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 transition-all text-stone-900 dark:text-white placeholder:text-stone-500"
                />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 mb-1 pb-hide-scroll">
                <button
                    type="button"
                    aria-pressed={todos}
                    onClick={() => { onFiltroEtiqueta(null); onFiltroLectura('ALL'); }}
                    className={`${chipBase} ${todos ? 'bg-stone-900 text-white border-stone-900 dark:bg-white dark:text-stone-900' : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-300 dark:border-stone-700 hover:bg-stone-50'}`}
                >
                    {todos && <span aria-hidden>✓</span>} Todos
                </button>
                <button
                    type="button"
                    aria-pressed={filtroLectura === 'UNREAD'}
                    onClick={() => { onFiltroLectura(filtroLectura === 'UNREAD' ? 'ALL' : 'UNREAD'); onFiltroEtiqueta(null); }}
                    className={`${chipBase} ${filtroLectura === 'UNREAD' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-300 dark:border-stone-700 hover:bg-stone-50'}`}
                >
                    {filtroLectura === 'UNREAD' && <span aria-hidden>✓</span>} No leídos
                </button>
                <button
                    type="button"
                    aria-pressed={filtroLectura === 'READ'}
                    onClick={() => { onFiltroLectura(filtroLectura === 'READ' ? 'ALL' : 'READ'); onFiltroEtiqueta(null); }}
                    className={`${chipBase} ${filtroLectura === 'READ' ? 'bg-stone-700 text-white border-stone-700' : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-300 dark:border-stone-700 hover:bg-stone-50'}`}
                >
                    {filtroLectura === 'READ' && <span aria-hidden>✓</span>} Leídos
                </button>
                {etiquetasUsadas.map(lbl => {
                    const activo = filtroEtiqueta === lbl;
                    return (
                        <button
                            key={lbl}
                            type="button"
                            aria-pressed={activo}
                            onClick={() => { onFiltroEtiqueta(activo ? null : lbl); onFiltroLectura('ALL'); }}
                            className={`${chipBase} ${activo ? `${getLabelStyle(lbl)} ring-2 ring-emerald-600` : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-300 dark:border-stone-700 hover:bg-stone-50'}`}
                        >
                            {activo && <span aria-hidden>✓</span>} {lbl}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
