import type { LabCostEntryResumen } from '@/types/orders';

/**
 * Los COSTOS los ve solo Ishtar (Ishtar, 22/10/2026: "si hay plata a favor y
 * todo lo que es costos SOLO yo puedo verlos"). En producción ella es la única
 * ADMIN, así que la regla es por rol.
 *
 * Se corta en el SERVIDOR, no solo en la pantalla: lo que llega al navegador se
 * puede leer aunque no se dibuje. Del comprobante del laboratorio el vendedor
 * conserva el número (sirve para saber que el lab facturó); pierde el importe,
 * el link al PDF (trae los precios) y el resultado del cruce (a favor / sobrecosto).
 */
export function comprobantesSinCostos(entries: LabCostEntryResumen[] | null | undefined): LabCostEntryResumen[] {
    return (entries || []).map(e => ({
        ...e,
        status: 'OCULTO',
        difference: null,
        billedNet: null,
        billedTotal: null,
        invoiceRefs: Array.isArray(e.invoiceRefs)
            ? e.invoiceRefs.map(r => ({ comprobante: r.comprobante, importe: null, url: null, tipo: r.tipo }))
            : null,
    }));
}

/** La venta tal como la puede ver alguien que no es admin. */
export function ventaParaElRol<T extends { labCostEntries?: LabCostEntryResumen[] | null }>(venta: T, esAdmin: boolean): T {
    if (esAdmin || !venta) return venta;
    return { ...venta, labCostEntries: comprobantesSinCostos(venta.labCostEntries) };
}
