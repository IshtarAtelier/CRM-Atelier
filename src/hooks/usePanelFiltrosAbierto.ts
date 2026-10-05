"use client";

import { useSyncExternalStore } from "react";

/**
 * ¿Está abierto el panel de filtros de /tienda en el celular?
 *
 * Lo avisa `ProductFilters` y lo escucha `FloatingWhatsApp`, que vive en el
 * layout raíz y no comparte estado con la tienda. Existe porque la pastilla
 * "Presupuesto" del botón flotante tapaba el botón "Ver N modelos" del panel:
 * en 12 de 19 puntos de ese botón lo que se tocaba era WhatsApp (auditoría
 * del 25/9/2026, re-chequeo 28/9).
 */
let abierto = false;
const suscriptores = new Set<() => void>();

export function avisarPanelFiltros(estaAbierto: boolean) {
  if (abierto === estaAbierto) return;
  abierto = estaAbierto;
  suscriptores.forEach(avisar => avisar());
}

function suscribir(avisar: () => void) {
  suscriptores.add(avisar);
  return () => { suscriptores.delete(avisar); };
}

export function usePanelFiltrosAbierto(): boolean {
  return useSyncExternalStore(suscribir, () => abierto, () => false);
}
