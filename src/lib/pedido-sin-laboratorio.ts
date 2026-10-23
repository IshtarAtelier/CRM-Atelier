// ────────────────────────────────────────────────────────────────────────────
// ¿La venta pasa por el laboratorio?
//
// Regla de Ishtar (22/10/2026): un anteojo de sol (o cualquier venta) que no
// lleva cristales no tiene proceso de producción, así que al cliente NO le
// llega ni la confirmación de compra ni ningún aviso de estado (procesado,
// listo para retirar, recordatorio de retiro). Se lo lleva en el momento.
//
// Pasa por laboratorio si al menos un ítem es un cristal (`esCristal`, que
// incluye el teñido: un sol con cristales teñidos sí se fabrica). Sin ítems
// cargados no se puede saber, y en la duda se avisa: callar un pedido de
// receta es peor que mandarle un mensaje de más a un anteojo de sol.
// ────────────────────────────────────────────────────────────────────────────

import { esCristal, type ConCategoria } from '@/lib/laboratorios/identidad';

export const MOTIVO_SIN_LABORATORIO = 'la venta no lleva cristales (no pasa por laboratorio): no se le avisan estados al cliente';

/** true si la venta tiene algo que fabricar. Puro. */
export function pasaPorLaboratorio(items: ConCategoria[] | null | undefined): boolean {
    if (!Array.isArray(items) || items.length === 0) return true;
    return items.some(it => esCristal(it));
}
