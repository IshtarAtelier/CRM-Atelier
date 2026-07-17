// Origen de un cristal monofocal: se pide al laboratorio o sale de stock propio
// (rango extendido). Único lugar que conoce los valores válidos y sus etiquetas:
// todo el que muestre o compare orígenes debe pasar por acá, así agregar un origen
// nuevo (o renombrar una etiqueta) es un cambio de un solo archivo.

export const LENS_ORIGIN = {
    STOCK: 'STOCK',
    LABORATORIO: 'LABORATORIO',
} as const;

export type LensOrigin = (typeof LENS_ORIGIN)[keyof typeof LENS_ORIGIN];

const LABELS: Record<LensOrigin, string> = {
    STOCK: 'Stock',
    LABORATORIO: 'Laboratorio',
};

/** Lleva cualquier valor guardado a un origen canónico, o null si no es uno válido. */
export function normalizeLensOrigin(value?: string | null): LensOrigin | null {
    const v = (value || '').trim().toUpperCase();
    return v === LENS_ORIGIN.STOCK || v === LENS_ORIGIN.LABORATORIO ? (v as LensOrigin) : null;
}

/** Etiqueta humana ('Stock' / 'Laboratorio') o '' si el valor no es un origen válido. */
export function lensOriginLabel(value?: string | null): string {
    const origin = normalizeLensOrigin(value);
    return origin ? LABELS[origin] : '';
}

/** Sufijo para textos planos (WhatsApp, copiar): ' (Stock)' / ' (Laboratorio)' o ''. */
export function lensOriginSuffix(value?: string | null): string {
    const label = lensOriginLabel(value);
    return label ? ` (${label})` : '';
}

/**
 * Resuelve el origen de una línea de venta/presupuesto: usa el producto vivo y,
 * si fue borrado del catálogo, cae a la foto congelada en la línea (mismo patrón
 * que el resto de los snapshots de OrderItem).
 */
export function lensOriginFromItem(item?: {
    product?: { origin?: string | null } | null;
    productOriginSnapshot?: string | null;
} | null): LensOrigin | null {
    if (!item) return null;
    return normalizeLensOrigin(item.product?.origin ?? item.productOriginSnapshot);
}
