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

/** ¿Es un pedido "2x1" (dos pares de armazón/cristal)? Mismo criterio en toda la app. */
export function isTwoPairOrder(order: LabFrameOrder): boolean {
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
    pair: 1 | 2;
    /** Etiqueta del par: "Armazón" para pedidos de un solo par, "Par 1" / "Par 2" para 2x1. */
    label: string;
    shape: string | null;
    measurements: string | null;
    /** "Altura OD 20 · OI 20" — la altura varía según el armazón elegido. */
    fitting: string | null;
    details: string | null;
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
    const twoPairs = isTwoPairOrder(order);

    const pair1Measurements = measurementsLabel(order.frameA, order.frameB, order.frameDbl, order.frameEdc);
    const pair1Fitting = fittingLabel(order.labHeightOD, order.labHeightOI);
    const pair1: LabFramePairSummary = {
        pair: 1,
        label: twoPairs ? 'Armazón — Par 1' : 'Armazón',
        shape: order.labFrameShape || null,
        measurements: pair1Measurements,
        fitting: pair1Fitting,
        details: order.labFrameDetails || null,
        isEmpty: !order.labFrameShape && !pair1Measurements && !order.labFrameDetails
    };

    const pairs: LabFramePairSummary[] = [pair1];

    if (twoPairs) {
        const pair2Measurements = measurementsLabel(order.frameA2, order.frameB2, order.frameDbl2, order.frameEdc2);
        pairs.push({
            pair: 2,
            label: 'Armazón — Par 2 (bonificado)',
            shape: order.labFrameShape2 || null,
            measurements: pair2Measurements,
            fitting: fittingLabel(order.labHeightOD2, order.labHeightOI2),
            details: order.labFrameDetails2 || null,
            isEmpty: !order.labFrameShape2 && !pair2Measurements && !order.labFrameDetails2
        });
    }

    let tint: TintSummary | null = null;
    if (order.labTreatment || order.labColor) {
        const partes = [order.labTreatment, order.labColor].filter(Boolean);
        tint = {
            text: partes.join(' - '),
            ambiguousPair: twoPairs && tintServiceCount(order) < 2
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
