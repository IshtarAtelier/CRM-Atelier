'use client';

/**
 * El armazón de los modales del buzón.
 *
 * Existe por accesibilidad: el fondo oscuro cerraba el modal con un `onClick`
 * sobre un `<div>`, algo que con teclado no se puede activar y que un lector de
 * pantalla no anuncia. Acá el fondo es un `<button>` real con rótulo, y Escape
 * cierra desde cualquier lado.
 */

import { useEffect, type ReactNode } from 'react';

export interface ModalShellProps {
    etiqueta: string;
    onCerrar: () => void;
    children: ReactNode;
    /** Ancho máximo del panel (clase de Tailwind). */
    ancho?: string;
}

export function ModalShell({ etiqueta, onCerrar, children, ancho = 'max-w-lg' }: ModalShellProps) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCerrar]);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={etiqueta}>
            <button
                type="button"
                onClick={onCerrar}
                aria-label={`Cerrar ${etiqueta}`}
                tabIndex={-1}
                className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-default"
            />
            <div className={`relative w-full ${ancho} bg-white dark:bg-stone-900 rounded-3xl overflow-hidden shadow-2xl border border-stone-300 dark:border-white/10 flex flex-col max-h-[90vh]`}>
                {children}
            </div>
        </div>
    );
}
