'use client';

import React from 'react';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { getCategoryKey } from '@/lib/promo-utils';

// ────────────────────────────────────────────────────────────────────────────
// Las píldoras de categoría de Stock, compartidas con el cotizador (Ishtar,
// 1/10/2026: "que el cotizador tenga los mismos filtros que Stock, con la
// misma visual"). Una sola lista (PRODUCT_CATEGORIES) y una sola visual: si
// se agrega una categoría o se cambia un color, cambia en las dos pantallas.
// ────────────────────────────────────────────────────────────────────────────

export const CATEGORIA_TODAS = 'ALL';

/** La etiqueta sin el emoji ("🔬 Cristales" → "Cristales"). */
export function etiquetaCategoria(id: string): string {
    if (id === CATEGORIA_TODAS) return 'Todos';
    const cat = PRODUCT_CATEGORIES.find(c => c.id === id);
    return cat ? cat.label.replace(/^\S+\s+/, '') : id;
}

// La clave del clasificador viejo, por si un producto viene sin `category`.
const CATEGORIA_POR_CLAVE: Record<string, string> = {
    'Cristal': 'Cristal',
    'Lente de sol': 'Lentes de Sol',
    'Armazón': 'Armazón de Receta',
    'Lente de contacto': 'Lentes de Contacto',
    'Tratamiento': 'Tratamiento',
};

/**
 * Si el producto entra en la categoría elegida. Manda `category` (es lo que
 * filtra Stock); el clasificador por `type` es solo el respaldo para fichas
 * viejas sin categoría. Antes el cotizador clasificaba por `type` primero y 24
 * lentes de sol con type "Armazón" caían bajo Armazones.
 */
export function coincideCategoria(p: { type?: string | null; category?: string | null }, id: string | null): boolean {
    if (!id || id === CATEGORIA_TODAS) return true;
    if (p.category) return p.category === id;
    return CATEGORIA_POR_CLAVE[getCategoryKey(p.type || null, p.category)] === id;
}

interface FiltrosDeCategoriaProps {
    seleccionada: string;
    onSeleccionar: (id: string) => void;
    soloWeb: boolean;
    onSoloWeb: (valor: boolean) => void;
    /** Cantidad por categoría (y `ALL` para el total); si falta, no se muestra. */
    contadores?: Record<string, number>;
    /** En Stock envuelven en varias filas; en la barra del cotizador van en una sola, con scroll. */
    envolver?: boolean;
    className?: string;
}

const pildora = 'h-8 px-3 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 border flex items-center justify-center gap-1.5';
const pildoraActiva = 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-md scale-105';
const pildoraInactiva = 'bg-transparent border border-stone-200 dark:border-stone-800 text-stone-500 hover:border-stone-300 dark:hover:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800/50';

export default function FiltrosDeCategoria({ seleccionada, onSeleccionar, soloWeb, onSoloWeb, contadores, envolver = true, className = '' }: FiltrosDeCategoriaProps) {
    const opciones = [{ id: CATEGORIA_TODAS, label: 'Todos' }, ...PRODUCT_CATEGORIES];
    return (
        <div className={`flex ${envolver ? 'flex-wrap pb-2' : 'flex-nowrap'} items-center gap-2 overflow-x-auto no-scrollbar ${className}`}>
            {opciones.map(cat => {
                const activa = seleccionada === cat.id;
                const n = contadores?.[cat.id];
                return (
                    <button
                        key={cat.id}
                        type="button"
                        onClick={() => onSeleccionar(cat.id)}
                        aria-pressed={activa}
                        className={`${pildora} ${activa ? pildoraActiva : pildoraInactiva}`}
                    >
                        {cat.label}
                        {typeof n === 'number' && (
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${activa ? 'bg-white/20 dark:bg-black/10' : 'bg-stone-100 dark:bg-stone-800'}`}>{n}</span>
                        )}
                    </button>
                );
            })}
            <button
                type="button"
                onClick={() => onSoloWeb(!soloWeb)}
                aria-pressed={soloWeb}
                className={`${pildora} ${soloWeb
                    ? 'bg-violet-600 text-white border-violet-600 shadow-md scale-105 hover:bg-violet-750'
                    : 'bg-transparent border border-violet-200 text-violet-600 hover:border-violet-350 hover:bg-violet-50/50 dark:border-violet-900/50 dark:text-violet-400'
                }`}
            >
                🌐 Solo Web
            </button>
        </div>
    );
}
