// ────────────────────────────────────────────────────────────────────────────
// El repaso de la venta en texto plano: lo que se envió a fábrica, legible de
// arriba a abajo.
//
// Lo usan la nota del historial de la ficha (para que "ante cualquier
// eventualidad" el paso a paso esté escrito) y el mensaje de WhatsApp de la
// confirmación de compra. El mail y el PDF arman su propio HTML pero con los
// MISMOS datos: `describeLabFrameDetails()` es la única fuente del armazón.
//
// Módulo PURO (sin prisma) para poder usarlo desde cualquier lado.
// ────────────────────────────────────────────────────────────────────────────

import { describeLabFrameDetails, type LabFrameOrder } from './lab-frame-summary';

export interface RecapPrescription {
    sphereOD?: number | string | null; sphereOI?: number | string | null;
    cylinderOD?: number | string | null; cylinderOI?: number | string | null;
    axisOD?: number | string | null; axisOI?: number | string | null;
    additionOD?: number | string | null; additionOI?: number | string | null;
    addition?: number | string | null;
    pd?: number | string | null;
    heightOD?: number | string | null; heightOI?: number | string | null;
    prismOD?: string | null; prismOI?: string | null;
    prescriptionType?: string | null;
    notes?: string | null;
    imageUrl?: string | null;
}

const dato = (v: unknown): string => (v === null || v === undefined || v === '' ? '—' : String(v));

/** ¿Alguno de los items es fotocromático? Hay que aclarárselo al cliente. */
export function tienePhotocromatico(order: LabFrameOrder & { labTreatment?: string | null }): boolean {
    const enItems = (order.items || []).some(it => {
        const txt = `${it.product?.name || it.productNameSnapshot || ''} ${it.product?.type || it.productTypeSnapshot || ''} ${it.product?.category || it.productCategorySnapshot || ''}`.toLowerCase();
        return txt.includes('fotocrom') || txt.includes('transitions');
    });
    const enTratamiento = `${order.labTreatment || ''}`.toLowerCase();
    return enItems || enTratamiento.includes('fotocrom') || enTratamiento.includes('transitions');
}

/** El repaso del armazón (los dos pares si es 2x1), teñido y notas, en texto. */
export function frameRecapText(order: LabFrameOrder): string {
    const r = describeLabFrameDetails(order);
    const lineas: string[] = [];

    if (r.origin) lineas.push(`Armazón: ${r.origin}`);

    for (const par of r.pairs) {
        if (par.isEmpty) {
            lineas.push(`${par.label}: sin medidas cargadas`);
            continue;
        }
        const partes = [par.shape, par.measurements, par.details].filter(Boolean);
        lineas.push(`${par.label}: ${partes.join(' · ')}`);
    }

    // El teñido se dice SIEMPRE, también cuando no lleva: el silencio es lo que
    // hace dudar a quien lee (y lo que genera el reclamo después).
    lineas.push(`Teñido: ${r.tint ? r.tint.text : 'NO lleva teñido'}`);
    if (r.tint?.ambiguousPair) {
        lineas.push('⚠️ Hay dos pares y una sola línea de teñido: confirmar a cuál corresponde.');
    }
    if (tienePhotocromatico(order)) {
        lineas.push('Fotocromático: SÍ — los cristales se oscurecen solos con el sol.');
    }

    if (r.notes) lineas.push(`Notas para el laboratorio: ${r.notes}`);

    return lineas.join('\n');
}

/** La receta tal cual está cargada, en dos filas OD/OI. */
export function prescriptionRecapText(rx: RecapPrescription | null | undefined): string {
    if (!rx) return 'Receta: no hay una receta cargada en este pedido.';

    const ojo = (lado: 'OD' | 'OI') => {
        const esf = lado === 'OD' ? rx.sphereOD : rx.sphereOI;
        const cil = lado === 'OD' ? rx.cylinderOD : rx.cylinderOI;
        const eje = lado === 'OD' ? rx.axisOD : rx.axisOI;
        const add = lado === 'OD' ? (rx.additionOD ?? rx.addition) : (rx.additionOI ?? rx.addition);
        const alt = lado === 'OD' ? rx.heightOD : rx.heightOI;
        const prisma = lado === 'OD' ? rx.prismOD : rx.prismOI;
        const partes = [
            `Esf ${dato(esf)}`, `Cil ${dato(cil)}`, `Eje ${dato(eje)}`,
            `Add ${dato(add)}`, `Altura ${dato(alt)}`,
        ];
        if (prisma) partes.push(`Prisma ${prisma}`);
        return `${lado}: ${partes.join('  ')}`;
    };

    const lineas = [
        rx.prescriptionType ? `Tipo de lente: ${rx.prescriptionType}` : null,
        ojo('OD'),
        ojo('OI'),
        `Distancia interpupilar (DNP): ${dato(rx.pd)}`,
        rx.notes ? `Observaciones de la receta: ${rx.notes}` : null,
    ].filter(Boolean) as string[];

    return lineas.join('\n');
}
