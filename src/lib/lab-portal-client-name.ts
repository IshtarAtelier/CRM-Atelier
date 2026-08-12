/**
 * El dato que la óptica escribe al cargar el pedido en el portal del
 * laboratorio (campo "CodigoOptica" de SmartLab). Puede ser el nombre del
 * paciente, un código interno, una inicial — cualquier cosa que hayan puesto.
 *
 * El scraper lo guarda dentro de `LabCostEntry.notes` con esta forma:
 *   con dato  → "Pedido visto en el portal del laboratorio (PEREZ JUAN, ingreso 2026-07-28 16:06)."
 *   sin dato  → "Pedido visto en el portal del laboratorio (ingreso 2026-07-28 16:06)."
 *
 * (ver `grupo-optico.provider.ts`: el `.filter(Boolean)` saca el string vacío,
 * así que cuando no cargaron nada el primer token pasa a ser "ingreso").
 *
 * Para un pedido que no matcheó con ninguna venta, este dato es la ÚNICA pista
 * para encontrarle el dueño — por eso se lee en tres lugares (el email de
 * alertas, el triage difuso contra postventa, y la pantalla de costos) y por
 * eso vive acá y no copiado en cada uno.
 *
 * Se devuelve cualquier dato, por corto que sea: una inicial o un código
 * también sirven para rastrear el pedido. Lo único que no es un dato es el
 * marcador "ingreso …", que aparece justamente cuando el campo vino vacío.
 */
export function labPortalClientName(notes?: string | null): string | null {
    const m = (notes || '').match(/portal del laboratorio \(([^,)]{1,60})[,)]/);
    const dato = m?.[1]?.trim();
    if (!dato) return null;
    if (/^ingreso\b/i.test(dato)) return null;
    return dato;
}
