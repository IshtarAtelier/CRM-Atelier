/**
 * Resumen en una línea de qué se vendió: "Estelar Negro + Cristales Monofocal
 * AR (par)". Lo lee el listado de ventas del dashboard; si otra pantalla
 * necesita el mismo renglón, se lee de acá (regla de CLAUDE.md: un dato que se
 * muestra en dos lugares se arma en UN helper).
 */
export interface ItemDeVenta {
    quantity?: number | null;
    eye?: string | null;
    productNameSnapshot?: string | null;
    productCategorySnapshot?: string | null;
    productTypeSnapshot?: string | null;
    product?: { name?: string | null; category?: string | null; type?: string | null } | null;
}

function esCristal(it: ItemDeVenta): boolean {
    const t = `${it.product?.type || it.productTypeSnapshot || ''} ${it.product?.category || it.productCategorySnapshot || ''}`.toLowerCase();
    return t.includes('cristal') || t.includes('lente') || !!it.eye;
}

function nombre(it: ItemDeVenta): string {
    return (it.productNameSnapshot || it.product?.name || 'Producto').trim();
}

export function resumenDeProductos(items: ItemDeVenta[] | null | undefined): string {
    if (!items || items.length === 0) return 'Sin productos';
    const armazones: string[] = [];
    const cristales = new Map<string, number>(); // nombre → ojos/unidades
    for (const it of items) {
        if (esCristal(it)) {
            cristales.set(nombre(it), (cristales.get(nombre(it)) || 0) + (it.quantity || 1));
        } else {
            const q = it.quantity || 1;
            armazones.push(q > 1 ? `${nombre(it)} ×${q}` : nombre(it));
        }
    }
    const partes: string[] = [];
    if (armazones.length) partes.push(armazones.join(', '));
    for (const [n, q] of cristales) {
        // Dos líneas OD/OI del mismo cristal son UN par.
        partes.push(q >= 2 ? `Cristales ${n} (par)` : `Cristal ${n}`);
    }
    return partes.join(' + ');
}
