'use client';

/**
 * Los avisos que aparecen abajo a la derecha dentro del buzón (lead nuevo,
 * mensaje entrante, tarea agendada por la IA). Son los de la app: los del
 * sistema operativo los emite otro lado, para que no salgan dos por lo mismo.
 */

import { X } from 'lucide-react';

export interface AvisoEnApp {
    id: string;
    title: string;
    body: string;
    icon?: string;
    onClick?: () => void;
}

export interface InAppToastsProps {
    avisos: AvisoEnApp[];
    onCerrar: (id: string) => void;
}

export function InAppToasts({ avisos, onCerrar }: InAppToastsProps) {
    if (avisos.length === 0) return null;

    return (
        <div
            role="region"
            aria-live="polite"
            aria-label="Avisos del buzón"
            className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none"
        >
            {avisos.map(aviso => (
                <div
                    key={aviso.id}
                    className="pointer-events-auto bg-white dark:bg-stone-900 border border-emerald-600/40 shadow-2xl rounded-2xl p-4 flex items-start gap-4 w-80"
                >
                    {aviso.icon && (
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex-shrink-0 flex items-center justify-center p-2">
                            <img src={aviso.icon} alt="" className="w-full h-full object-contain" />
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => { aviso.onClick?.(); onCerrar(aviso.id); }}
                        className="flex-1 min-w-0 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                        <span className="block font-black text-stone-900 dark:text-white text-sm truncate">{aviso.title}</span>
                        <span className="block text-xs font-medium text-stone-700 dark:text-stone-300 mt-1 line-clamp-2 leading-relaxed">{aviso.body}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onCerrar(aviso.id)}
                        aria-label="Descartar el aviso"
                        className="min-w-10 min-h-10 -m-2 inline-flex items-center justify-center text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
