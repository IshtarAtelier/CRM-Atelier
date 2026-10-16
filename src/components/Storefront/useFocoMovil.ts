'use client';

import { useEffect } from 'react';

/**
 * En el celular, la tarjeta que pasa por el CENTRO de la pantalla muestra su
 * segunda foto (la del rostro), igual que en la compu al pasar el mouse.
 *
 * Por qué (Ishtar, 16/10/2026): la segunda foto de cada ficha es una persona con
 * el anteojo puesto, y en el celular no se veía nunca: el cambio era solo
 * `md:group-hover`, y en una pantalla táctil no hay hover. Ahí está la mayoría
 * de las visitas.
 *
 * Cómo: un ÚNICO IntersectionObserver para todo el sitio, compartido por las
 * grillas que llaman al hook, observa cada elemento con `data-foco-movil` (la
 * tarjeta que hace de `group`). Mientras la tarjeta cruza la franja central de
 * la pantalla le pone `data-en-foco`, y las clases `group-data-[en-foco]:` de
 * las dos fotos hacen el fundido. Un MutationObserver suma las tarjetas que
 * aparecen después (Cargar más, filtros, cambio de categoría).
 *
 * Solo en pantallas sin hover (`(hover: none)`): en la compu no cambia nada.
 */
const FRANJA_CENTRAL = '-38% 0px -38% 0px'; // la tarjeta "está en foco" cuando toca el 24 % central de la pantalla

let usuarios = 0;
let intersecciones: IntersectionObserver | null = null;
let mutaciones: MutationObserver | null = null;

function observarTodas() {
    document.querySelectorAll<HTMLElement>('[data-foco-movil]').forEach((el) => {
        if (el.dataset.focoObservado) return;
        el.dataset.focoObservado = '1';
        intersecciones?.observe(el);
    });
}

function arrancar() {
    intersecciones = new IntersectionObserver((entradas) => {
        for (const e of entradas) {
            const el = e.target as HTMLElement;
            if (e.isIntersecting) el.dataset.enFoco = '';
            else delete el.dataset.enFoco;
        }
    }, { rootMargin: FRANJA_CENTRAL, threshold: 0 });
    mutaciones = new MutationObserver(observarTodas);
    mutaciones.observe(document.body, { childList: true, subtree: true });
    observarTodas();
}

function parar() {
    intersecciones?.disconnect();
    mutaciones?.disconnect();
    intersecciones = mutaciones = null;
    document.querySelectorAll<HTMLElement>('[data-foco-observado]').forEach((el) => {
        delete el.dataset.focoObservado;
        delete el.dataset.enFoco;
    });
}

export function useFocoMovil() {
    useEffect(() => {
        if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
        if (!window.matchMedia('(hover: none)').matches) return;
        if (usuarios++ === 0) arrancar();
        else observarTodas();
        return () => {
            if (--usuarios === 0) parar();
        };
    }, []);
}
