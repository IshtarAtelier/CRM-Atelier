'use client';

import { useEffect, useRef } from 'react';
import { MapPin, X } from 'lucide-react';
import { CONTACT_SOURCES_SELECCIONABLES } from '@/lib/contact-source';

/**
 * La pregunta tal como se le hace al cliente. Es el nombre del campo en todo el
 * CRM: no es "origen" ni "canal", es lo que hay que preguntarle en el mostrador.
 */
export const ORIGEN_LABEL = '¿Dónde nos conocieron?';

/**
 * Popup para elegir el origen SIN salir de lo que estabas haciendo.
 *
 * Por qué existe (Ishtar, 16/9/2026): el origen ya era obligatorio, pero cuando
 * faltaba había que cerrar el aviso, buscar el desplegable, abrirlo, elegir y
 * recién ahí volver a guardar. Pedido textual: "que te muestre ahí mismo el
 * pop-up para que no tengas que estar saliendo, cerrando, abriendo; que te dé
 * ahí para elegir, puedas tocar y que se guarde".
 *
 * Reglas que hacen que esto sirva y no sea un clic de más:
 * - NADA preseleccionado. Sin un valor por defecto no hay forma de que alguien
 *   guarde "Calle" sin querer por ser el primero de la lista.
 * - Un toque = elegir y seguir. Quien lo llama guarda en el mismo gesto.
 * - Botones grandes: se usa con el cliente enfrente, muchas veces en el celular.
 */
export function PreguntaDeOrigen({
    onElegir,
    onCerrar,
    nombre,
}: {
    onElegir: (origen: string) => void;
    onCerrar: () => void;
    /** Nombre del cliente, si se sabe: hace la pregunta menos genérica. */
    nombre?: string;
}) {
    const primero = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        primero.current?.focus();
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onCerrar]);

    return (
        <div
            className="fixed inset-0 z-[200] bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pregunta-origen-titulo"
        >
            <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-[2rem] shadow-2xl border-2 border-primary/30 overflow-hidden">
                <header className="px-6 py-5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/50 flex items-start justify-between gap-3">
                    <div>
                        <h2 id="pregunta-origen-titulo" className="text-xl font-black text-stone-900 dark:text-stone-50 tracking-tight">
                            {ORIGEN_LABEL}
                        </h2>
                        <p className="text-xs font-bold text-stone-600 dark:text-stone-300 mt-1">
                            Preguntale a {nombre?.trim() ? nombre.trim().split(' ')[0] : 'la persona'} y tocá la opción. Se guarda al toque.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCerrar}
                        aria-label="Cerrar sin elegir"
                        className="shrink-0 p-2 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                    >
                        <X className="w-5 h-5 text-stone-500" />
                    </button>
                </header>

                <div className="p-5 grid grid-cols-2 gap-3">
                    {CONTACT_SOURCES_SELECCIONABLES.map((s, i) => (
                        <button
                            key={s}
                            ref={i === 0 ? primero : undefined}
                            type="button"
                            onClick={() => onElegir(s)}
                            className="flex items-center gap-2 px-4 py-5 rounded-2xl border-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm font-black text-stone-800 dark:text-stone-100 text-left transition-all hover:border-primary hover:bg-primary/10 hover:scale-[1.02] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <MapPin className="w-4 h-4 shrink-0 text-primary" aria-hidden />
                            {s}
                        </button>
                    ))}
                </div>

                <p className="px-6 pb-5 text-[11px] font-bold text-stone-500 dark:text-stone-400">
                    Sin esto la venta no cuenta en ningún reporte: no se sabe qué la trajo.
                </p>
            </div>
        </div>
    );
}
