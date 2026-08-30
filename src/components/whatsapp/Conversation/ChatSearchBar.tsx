'use client';

/**
 * La lupa dentro de una conversación. Busca sobre los mensajes que ya están en
 * memoria (el endpoint no pagina), así que encuentra en toda la charla y no solo
 * en lo que se ve.
 */

import { forwardRef } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';

export interface ChatSearchBarProps {
    valor: string;
    onValor: (v: string) => void;
    /** Índice del resultado activo (base 0) y cuántos hay. */
    indice: number;
    total: number;
    onMover: (delta: number) => void;
    onCerrar: () => void;
}

export const ChatSearchBar = forwardRef<HTMLInputElement, ChatSearchBarProps>(function ChatSearchBar(
    { valor, onValor, indice, total, onMover, onCerrar },
    ref,
) {
    const hayTexto = valor.trim().length > 0;

    return (
        <div className="flex-shrink-0 px-6 py-3 border-b border-stone-200 dark:border-stone-800 bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl">
            <div className="flex items-center gap-3">
                <Search className="w-4 h-4 text-stone-600 dark:text-stone-400 shrink-0" aria-hidden />
                <input
                    ref={ref}
                    type="text"
                    aria-label="Buscar en esta conversación"
                    value={valor}
                    onChange={e => onValor(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); onMover(e.shiftKey ? -1 : 1); }
                        if (e.key === 'Escape') { e.preventDefault(); onCerrar(); }
                    }}
                    placeholder="Buscar en esta conversación..."
                    className="flex-1 min-h-10 bg-transparent outline-none text-sm font-medium text-stone-900 dark:text-white placeholder:text-stone-500"
                />
                {hayTexto && (
                    <span
                        role="status"
                        className={`text-xs font-black tabular-nums whitespace-nowrap ${total ? 'text-stone-700 dark:text-stone-300' : 'text-red-700 dark:text-red-400'}`}
                    >
                        {total ? `${indice + 1} de ${total}` : 'sin resultados'}
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => onMover(-1)}
                    disabled={total === 0}
                    aria-label="Resultado anterior"
                    title="Anterior (Shift+Enter)"
                    className="min-w-10 min-h-10 inline-flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                    <ChevronUp className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                </button>
                <button
                    type="button"
                    onClick={() => onMover(1)}
                    disabled={total === 0}
                    aria-label="Resultado siguiente"
                    title="Siguiente (Enter)"
                    className="min-w-10 min-h-10 inline-flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                    <ChevronDown className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                </button>
                <button
                    type="button"
                    onClick={onCerrar}
                    aria-label="Cerrar el buscador"
                    title="Cerrar (Esc)"
                    className="min-w-10 min-h-10 inline-flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                    <X className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                </button>
            </div>
        </div>
    );
});
