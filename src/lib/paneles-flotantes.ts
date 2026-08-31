'use client';

import { useEffect } from 'react';

/**
 * Exclusión mutua entre los paneles flotantes del admin (Copilot y WhatsApp).
 *
 * Los dos se dibujan en el MISMO rectángulo (`fixed bottom-6 right-6 z-[95]
 * w-[420px]`), así que con los dos abiertos uno tapa al otro y encima ambos
 * cubren los botones redondos y la barra de accesos — quedaba todo amontonado.
 * En vez de moverlos a esquinas distintas (el ancho de 420px no entra dos
 * veces en una pantalla chica), se garantiza que solo haya UNO abierto.
 *
 * Se resuelve con un evento del navegador en lugar de estado compartido
 * porque los dos paneles son componentes independientes montados en el
 * layout, sin ancestro común más que el layout mismo: así ninguno tiene que
 * saber de la existencia del otro, y sumar un tercer panel mañana es una
 * línea.
 */

const EVENTO = 'panel-flotante-abierto';
const EVENTO_ABRIR = 'panel-flotante-abrir';

/**
 * Pide abrir un panel desde afuera (hoy: los botones del cajón de Accesos).
 * Los disparadores viven en la barra de Accesos y los paneles en el layout:
 * este evento es el cable entre los dos sin que ninguno importe al otro.
 */
export function pedirAbrirPanel(nombre: string) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(EVENTO_ABRIR, { detail: nombre }));
}

/** Del lado del panel: abrirse cuando alguien lo pide por nombre. */
export function useAbrirPanelRemoto(nombre: string, abrir: () => void) {
    useEffect(() => {
        const alPedir = (e: Event) => {
            if ((e as CustomEvent<string>).detail === nombre) {
                avisarPanelAbierto(nombre); // cierra al otro
                abrir();
            }
        };
        window.addEventListener(EVENTO_ABRIR, alPedir);
        return () => window.removeEventListener(EVENTO_ABRIR, alPedir);
    }, [nombre, abrir]);
}

/** Avisa que este panel se abrió: los demás se cierran solos. */
export function avisarPanelAbierto(nombre: string) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: nombre }));
}

/**
 * Cierra este panel cuando otro se abre.
 * @param nombre   identificador propio (el que se pasa a `avisarPanelAbierto`)
 * @param abierto  si este panel está abierto ahora
 * @param cerrar   cómo cerrarlo
 */
export function usePanelExclusivo(nombre: string, abierto: boolean, cerrar: () => void) {
    useEffect(() => {
        if (!abierto) return;
        const alAbrirOtro = (e: Event) => {
            const quien = (e as CustomEvent<string>).detail;
            if (quien !== nombre) cerrar();
        };
        window.addEventListener(EVENTO, alAbrirOtro);
        return () => window.removeEventListener(EVENTO, alAbrirOtro);
    }, [nombre, abierto, cerrar]);
}
