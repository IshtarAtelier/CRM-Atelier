"use client";

import { usePulso } from '@/components/mensajes/PulsoProvider';

/**
 * El número en rojo de "Mensajes del Equipo" en la barra lateral.
 *
 * No consulta nada: lee del `PulsoProvider`, que ya late una vez cada 20 s para
 * todo el panel. Antes tenía su propio `setInterval` — con el pop-up de
 * urgentes y los puntitos de presencia habrían sido tres consultas por pestaña
 * cada 20 segundos para pintar una sola barra lateral.
 */
export function MensajesBadge() {
    const { noLeidos } = usePulso();

    if (noLeidos === 0) return null;

    return (
        <span
            className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-black text-white bg-red-500 rounded-full shadow-sm animate-pulse"
            title={noLeidos === 1 ? '1 mensaje sin leer' : `${noLeidos} mensajes sin leer`}
        >
            {noLeidos > 99 ? '99+' : noLeidos}
        </span>
    );
}
