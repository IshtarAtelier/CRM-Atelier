import { framesDeLaOrden, cantidadDeArmazones, cristalesPorArmazon } from './order-frames';
import { isTeñidoAddon } from './promo-utils';
import { tintItemLabel } from './crystal-color';

/** ¿Este cristal es fotocromático? Mismo criterio en todo el sistema. */
function esFotocromatico(product: any): boolean {
    const t = `${product?.name || ''} ${product?.type || ''} ${product?.category || ''}`
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return t.includes('fotocromatic') || t.includes('transitions')
        || t.includes('acclimates') || t.includes('xtractive');
}
// ────────────────────────────────────────────────────────────────────────────
// Resumen de lo que el vendedor cargó en el Repaso Final (armazón, medidas,
// forma, teñido) para mostrarlo IGUAL en los tres lugares donde alguien lo
// necesita: la ficha del pedido, la lista de ventas y el PDF que recibe el
// cliente. Antes cada lugar mostraba un subconjunto distinto — el origen del
// armazón no aparecía en ventas, el segundo par de un 2x1 era invisible en
// todos lados, y el teñido no salía en el PDF.
//
// IMPORTANTE: módulo PURO (sin prisma/fs) para poder usarlo tanto en
// componentes de cliente como en el generador de PDF (servidor).
// ────────────────────────────────────────────────────────────────────────────

export interface LabFrameOrderItem {
    eye?: string | null;
    framePosition?: number | null;
    crystalColor?: string | null;
    crystalColorType?: string | null;
    crystalColorNote?: string | null;
    product?: { name?: string | null; category?: string | null; type?: string | null } | null;
    productNameSnapshot?: string | null;
    productCategorySnapshot?: string | null;
    productTypeSnapshot?: string | null;
}

export interface LabFrameOrder {
    appliedPromoName?: string | null;
    items?: LabFrameOrderItem[] | null;
    frameSource?: string | null;
    userFrameBrand?: string | null;
    userFrameModel?: string | null;
    labFrameShape?: string | null;
    labFrameDetails?: string | null;
    frameA?: string | null;
    frameB?: string | null;
    frameDbl?: string | null;
    frameEdc?: string | null;
    labFrameShape2?: string | null;
    labFrameDetails2?: string | null;
    frameA2?: string | null;
    frameB2?: string | null;
    frameDbl2?: string | null;
    frameEdc2?: string | null;
    labColor?: string | null;
    labTreatment?: string | null;
    labNotes?: string | null;
    labHeightOD?: number | null;
    labHeightOI?: number | null;
    labPdOd?: number | null;
    labPdOi?: number | null;
    labHeightOD2?: number | null;
    labHeightOI2?: number | null;
}

/** La redacción del teñido vive en `crystal-color`; se re-exporta para
 *  no obligar a cambiar el import en todos lados. */
export { tintItemLabel };

/** ¿Es un pedido "2x1" (dos pares de armazón/cristal)? Mismo criterio en toda la app. */
export { cantidadDeArmazones };

export function isTwoPairOrder(order: LabFrameOrder): boolean {
    // Se mide por los CRISTALES, no por la promo: dos pares son dos anteojos
    // lleve o no lleve 2x1 en el nombre. Se conserva la señal de la promo como
    // respaldo para pedidos viejos cargados sin ojo en los items.
    if (cantidadDeArmazones(order as any) > 1) return true;
    if ((order.appliedPromoName || '').toLowerCase().includes('2x1')) return true;
    return !!order.items?.some(it => {
        const name = (it.product?.name || it.productNameSnapshot || '').toLowerCase();
        return name.includes('2x1') || name.includes('2 x 1');
    });
}

/** Cuántas líneas de teñido/tratamiento de color tiene el pedido (0, 1 o 2+). */
export function tintServiceCount(order: LabFrameOrder): number {
    return (order.items || []).filter(it => {
        const str = `${it.product?.type || it.productTypeSnapshot || ''} ${it.product?.category || it.productCategorySnapshot || ''} ${it.product?.name || it.productNameSnapshot || ''}`.toLowerCase();
        return str.includes('teñido') || str.includes('tenido') || str.includes('coloracion') || str.includes('coloración');
    }).length;
}

/** "De la óptica" o "Del cliente — Marca Modelo"; null si no hay nada cargado. */
export function frameOriginLabel(order: LabFrameOrder): string | null {
    if (order.frameSource === 'OPTICA') return 'De la óptica';
    if (order.frameSource === 'USUARIO') {
        const marcaModelo = `${order.userFrameBrand || ''} ${order.userFrameModel || ''}`.trim();
        return marcaModelo ? `Del cliente — ${marcaModelo}` : 'Del cliente';
    }
    return null;
}

/** "Altura OD 20 · OI 20" con lo que haya; null si no hay nada.
 *  Solo alturas: la DNP es del cliente y se muestra con la receta. */
export function fittingLabel(hOD?: number | null, hOI?: number | null): string | null {
    const partes: string[] = [];
    if (hOD != null) partes.push(`Altura OD ${hOD}`);
    if (hOI != null) partes.push(`OI ${hOI}`);
    return partes.length ? partes.join(' · ') : null;
}

/** "A: 52  B: 38  ED: 13  Pte: 18" con lo que haya cargado; null si no hay nada. */
export function measurementsLabel(a?: string | null, b?: string | null, dbl?: string | null, edc?: string | null): string | null {
    const partes: string[] = [];
    if (a) partes.push(`A: ${a}`);
    if (b) partes.push(`B: ${b}`);
    if (edc) partes.push(`ED: ${edc}`);
    if (dbl) partes.push(`Pte: ${dbl}`);
    return partes.length > 0 ? partes.join('  ') : null;
}

export interface LabFramePairSummary {
    /** Posición del armazón: 1..N (uno por par de cristales). */
    pair: number;
    /** "Armazón" si es uno solo; "Armazón — 2º" en adelante si son varios. */
    label: string;
    shape: string | null;
    measurements: string | null;
    /** "Altura OD 20 · OI 20" — la altura varía según el armazón elegido. */
    fitting: string | null;
    /** Alturas por ojo sueltas, para renderizarlas en cuadros OD/OI. */
    heightOD: number | null;
    heightOI: number | null;
    details: string | null;
    /** Foto del armazón sacada por el vendedor. */
    imageUrl: string | null;
    /** El teñido de ESTE armazón, si lo lleva. null = no lleva. */
    tint: string | null;
    /** Los cristales de ESTE armazón son fotocromáticos. */
    photochromic: boolean;
    /**
     * De qué color se pone el fotocromático al sol ("Café / Marrón").
     *
     * El fotocromático se elige por color igual que el teñido, y decir solo
     * "fotocromático" deja afuera el único dato que el cliente puede
     * reconocer y confirmar. null = todavía no se eligió.
     */
    photochromicColor: string | null;
    /** Ninguno de los campos de este par tiene datos cargados todavía. */
    isEmpty: boolean;
}

export interface TintSummary {
    /** "Teñido" + "Gris Oscuro (Grado: 80%)" combinados, listos para mostrar. */
    text: string;
    /**
     * true si el pedido tiene 2 pares pero solo UNA línea de teñido cargada: el
     * dato no dice a cuál de los dos corresponde (labColor/labTreatment son
     * campos únicos del pedido, no hay un campo por par). Se avisa para que lo
     * resuelva una persona en vez de asumir — ver practica-auditar-y-avisar.
     */
    ambiguousPair: boolean;
}

export interface LabFrameSummary {
    origin: string | null;
    pairs: LabFramePairSummary[];
    tint: TintSummary | null;
    notes: string | null;
    /** true si no hay NADA para mostrar (ni origen, ni pares, ni teñido, ni notas). */
    isEmpty: boolean;
}

/**
 * Arma el resumen completo de armazón/medidas/teñido de un pedido, igual para
 * los tres lugares que lo muestran. Cada lugar decide cómo renderizarlo (React,
 * HTML del PDF, jsPDF) pero con los mismos datos y el mismo criterio de qué
 * corresponde mostrar.
 */
export function describeLabFrameDetails(order: LabFrameOrder): LabFrameSummary {
    // Cuántos armazones y cuáles: un armazón por PAR DE CRISTALES. La promo ya
    // no decide nada acá — un pedido de dos pares sin promo también son dos
    // anteojos, y antes el segundo quedaba invisible.
    const armazones = framesDeLaOrden(order as any);
    const total = armazones.length;

    // "(bonificado)" solo cuando hay una promo 2x1 de verdad: en un pedido de
    // cuatro pares sin promo, el segundo no es un regalo.
    const hayPromo2x1 = (order.appliedPromoName || '').toLowerCase().includes('2x1');

    const pairs: LabFramePairSummary[] = armazones.map(f => {
        const medidas = measurementsLabel(f.a, f.b, f.dbl, f.edc);
        return {
            pair: f.position,
            label: total <= 1
                ? 'Armazón'
                : `Armazón — ${f.position}º${f.position === 2 && hayPromo2x1 ? ' (bonificado)' : ''}`,
            shape: f.shape,
            measurements: medidas,
            fitting: fittingLabel(f.heightOD, f.heightOI),
            heightOD: f.heightOD ?? null,
            heightOI: f.heightOI ?? null,
            details: f.details,
            imageUrl: f.imageUrl,
            tint: null,
            photochromic: false,
            photochromicColor: null,
            isEmpty: !f.shape && !medidas && !f.details,
        };
    });

    // El teñido sale PRIMERO de los items del pedido, que es donde el vendedor
    // lo carga hoy: una línea "Teñido Compacto/Degradé" con su color y su grado.
    // Los campos labColor/labTreatment del pedido son el camino viejo y quedan
    // de respaldo — mirarlos solo a ellos hacía que la confirmación al cliente
    // dijera "NO lleva teñido" en un pedido que sí lo llevaba.
    let tint: TintSummary | null = null;

    const itemsTenido = (order.items || []).filter(it => isTeñidoAddon(it.product || {
        name: it.productNameSnapshot, category: it.productCategorySnapshot, type: it.productTypeSnapshot,
    }));

    const describirTenido = tintItemLabel;

    // El fotocromático es de LOS CRISTALES de cada anteojo, no del pedido: en un
    // 2x1 es normal que uno sea fotocromático y el otro no. Decirlo una sola vez
    // para todo el pedido hacía creer al cliente que los dos lo eran.
    const cristalesDe = cristalesPorArmazon(order as any);
    for (const par of pairs) {
        const suyos = cristalesDe.get(par.pair) || [];
        const fotocromaticos = suyos.filter((it: any) => esFotocromatico(it.product || {
            name: it.productNameSnapshot, type: it.productTypeSnapshot, category: it.productCategorySnapshot,
        }));
        par.photochromic = fotocromaticos.length > 0;
        // Los dos cristales de un anteojo llevan el mismo color; alcanza con el
        // primero que lo tenga cargado.
        par.photochromicColor = fotocromaticos.find((it: any) => it.crystalColor)?.crystalColor || null;
    }

    // A QUÉ armazón va cada teñido. Con un solo armazón no hay nada que atar.
    // Con varios, manda `framePosition` del item; si no está cargado (pedidos
    // anteriores) queda sin asignar y se avisa, en vez de adivinar y mandar
    // teñido el anteojo equivocado.
    if (total > 1) {
        for (const par of pairs) {
            const suyos = itemsTenido.filter((it: any) => it.framePosition === par.pair);
            par.tint = suyos.length > 0 ? [...new Set(suyos.map(describirTenido))].join(' · ') : null;
        }
    } else if (itemsTenido.length > 0 && pairs[0]) {
        pairs[0].tint = [...new Set(itemsTenido.map(describirTenido))].join(' · ');
    }

    if (itemsTenido.length > 0) {
        const descripciones = itemsTenido.map(describirTenido);
        const sinAsignar = total > 1 && itemsTenido.some((it: any) => !it.framePosition);
        tint = {
            text: [...new Set(descripciones)].join('  |  '),
            ambiguousPair: sinAsignar,
        };
    } else if (order.labTreatment || order.labColor) {
        const partes = [order.labTreatment, order.labColor].filter(Boolean);
        // Teñido por el camino viejo (campos del pedido, sin item): se le
        // atribuye al primer armazón. Sin esto, un pedido viejo con teñido
        // aparecía como "SIN teñido" en el mensaje al cliente.
        if (pairs[0]) pairs[0].tint = partes.join(' - ');
        tint = {
            text: partes.join(' - '),
            // Con más de un armazón y una sola línea de teñido no se sabe a cuál
            // corresponde: el dato es del pedido, no del par. Lo resuelve una persona.
            ambiguousPair: total > 1 && tintServiceCount(order) < total
        };
    }

    const origin = frameOriginLabel(order);
    const notes = order.labNotes || null;

    return {
        origin,
        pairs,
        tint,
        notes,
        isEmpty: !origin && pairs.every(p => p.isEmpty) && !tint && !notes
    };
}
