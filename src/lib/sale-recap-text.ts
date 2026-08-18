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
    distanceOD?: number | string | null; distanceOI?: number | string | null;
    heightOD?: number | string | null; heightOI?: number | string | null;
    prismOD?: string | null; prismOI?: string | null;
    // Visión de cerca: el sistema la muestra en su propia tabla, así que el
    // repaso al cliente también.
    nearSphereOD?: number | string | null; nearSphereOI?: number | string | null;
    nearCylinderOD?: number | string | null; nearCylinderOI?: number | string | null;
    nearAxisOD?: number | string | null; nearAxisOI?: number | string | null;
    nearDistanceOD?: number | string | null; nearDistanceOI?: number | string | null;
    prescriptionType?: string | null;
    notes?: string | null;
    imageUrl?: string | null;
}

/** Una tabla de la receta (lejos o cerca), como la muestra el sistema. */
export interface RecapRxTabla {
    titulo: string;
    columnas: string[];
    filas: Array<{ ojo: string; valores: string[] }>;
}

/**
 * La receta en ESTRUCTURA, no en texto.
 *
 * Existe para que WhatsApp y mail salgan del MISMO lugar sin obligar a los dos
 * a verse igual: el WhatsApp la dibuja en texto plano (no soporta tablas) y el
 * mail la dibuja con el mismo cuadro de columnas que se ve en el sistema.
 * Antes el mail rearmaba la receta a mano y se le escapaban campos (el prisma
 * no salía nunca, la visión de cerca tampoco) — auditoría 18/8/2026.
 */
export interface RecapRxEstructura {
    tipo: string | null;
    tablas: RecapRxTabla[];
    /** Lo que no entra en la grilla: prisma, observaciones. */
    extras: Array<{ label: string; valor: string }>;
    vacia: boolean;
}

const dato = (v: unknown): string => (v === null || v === undefined || v === '' ? '—' : String(v));

/**
 * Un renglón por campo, siempre.
 *
 * Los campos de texto libre (notas de laboratorio, detalles del armazón,
 * observaciones de la receta) los escribe una persona y pueden traer saltos de
 * línea. Si se cuelan, el renglón se parte y deja de haber una correspondencia
 * "una línea = un campo": el mail lo renderiza como si la continuación fuera
 * un campo nuevo e inventa etiquetas que nadie escribió. Se aplana acá, en la
 * fuente, para que WhatsApp y mail muestren exactamente lo mismo.
 */
const unaLinea = (v: string): string => v.replace(/\s*\n+\s*/g, ' · ').trim();

/** ¿Alguno de los items es fotocromático? Hay que aclarárselo al cliente. */
export function tienePhotocromatico(order: LabFrameOrder & { labTreatment?: string | null }): boolean {
    const enItems = (order.items || []).some(it => {
        const txt = `${it.product?.name || it.productNameSnapshot || ''} ${it.product?.type || it.productTypeSnapshot || ''} ${it.product?.category || it.productCategorySnapshot || ''}`.toLowerCase();
        return txt.includes('fotocrom') || txt.includes('transitions');
    });
    const enTratamiento = `${order.labTreatment || ''}`.toLowerCase();
    return enItems || enTratamiento.includes('fotocrom') || enTratamiento.includes('transitions');
}

/**
 * El repaso del armazón (los dos pares si es 2x1) y el teñido, en texto.
 *
 * `interno: true` agrega las Observaciones del pedido (`labNotes`), que van al
 * laboratorio y no son para el cliente.
 *
 * Por defecto NO se incluyen, para que un lugar nuevo que muestre esto al
 * cliente sea seguro sin que nadie se acuerde de pasar el flag. Iban en el
 * mail y el WhatsApp de la confirmación hasta el 18/8/2026: el campo se llama
 * "Observaciones" en una pantalla y "notas para el laboratorio" en la otra, así
 * que quien lo escribe no tiene forma de saber que el cliente lo va a leer. El
 * PDF ya las excluía — el sistema se contradecía a sí mismo.
 */
export function frameRecapText(order: LabFrameOrder, { interno = false } = {}): string {
    const r = describeLabFrameDetails(order);
    const lineas: string[] = [];

    if (r.origin) lineas.push(`Armazón: ${unaLinea(r.origin)}`);

    for (const par of r.pairs) {
        if (par.isEmpty) {
            lineas.push(`${par.label}: sin medidas cargadas`);
            continue;
        }
        const partes = [par.shape, par.measurements, par.details].filter(Boolean);
        lineas.push(`${par.label}: ${unaLinea(partes.join(' · '))}`);
    }

    // El teñido se dice SIEMPRE, también cuando no lleva: el silencio es lo que
    // hace dudar a quien lee (y lo que genera el reclamo después).
    lineas.push(`Teñido: ${r.tint ? unaLinea(r.tint.text) : 'NO lleva teñido'}`);
    // El aviso de teñido ambiguo SÍ va al cliente: el mensaje entero existe
    // para que revise antes de fabricar, y ya le pide que confirme color y
    // grado. (El PDF lo excluye — esa es la que habría que alinear.)
    if (r.tint?.ambiguousPair) {
        lineas.push('⚠️ Hay dos pares y una sola línea de teñido: confirmar a cuál corresponde.');
    }
    if (tienePhotocromatico(order)) {
        lineas.push('Fotocromático: SÍ — los cristales se oscurecen solos con el sol.');
    }

    if (interno && r.notes) lineas.push(`Notas para el laboratorio: ${unaLinea(r.notes)}`);

    return lineas.join('\n');
}

/** La receta tal cual está cargada, en dos filas OD/OI. */
export function prescriptionRecapStructure(rx: RecapPrescription | null | undefined): RecapRxEstructura {
    if (!rx) return { tipo: null, tablas: [], extras: [], vacia: true };

    // Mismas columnas y mismo orden que el cuadro del sistema
    // (components/prescriptions/PrescriptionDetails.tsx).
    const COLUMNAS = ['Esfera', 'Cilindro', 'Eje', 'Add', 'DNP', 'Altura'];

    const lejos: RecapRxTabla = {
        titulo: 'Visión de lejos',
        columnas: COLUMNAS,
        filas: [
            {
                ojo: 'OD', valores: [
                    dato(rx.sphereOD), dato(rx.cylinderOD), dato(rx.axisOD),
                    dato(rx.additionOD ?? rx.addition), dato(rx.distanceOD ?? rx.pd), dato(rx.heightOD),
                ],
            },
            {
                ojo: 'OI', valores: [
                    dato(rx.sphereOI), dato(rx.cylinderOI), dato(rx.axisOI),
                    dato(rx.additionOI ?? rx.addition), dato(rx.distanceOI ?? rx.pd), dato(rx.heightOI),
                ],
            },
        ],
    };

    const tablas = [lejos];

    // La tabla de cerca solo si hay algún valor cargado: una tabla de guiones
    // le hace dudar al cliente de que la receta esté completa.
    const hayCerca = [
        rx.nearSphereOD, rx.nearSphereOI, rx.nearCylinderOD, rx.nearCylinderOI,
        rx.nearAxisOD, rx.nearAxisOI, rx.nearDistanceOD, rx.nearDistanceOI,
    ].some(v => v !== null && v !== undefined && v !== '');
    if (hayCerca) {
        tablas.push({
            titulo: 'Visión de cerca',
            columnas: COLUMNAS,
            filas: [
                {
                    ojo: 'OD', valores: [
                        dato(rx.nearSphereOD), dato(rx.nearCylinderOD), dato(rx.nearAxisOD),
                        dato(rx.additionOD ?? rx.addition), dato(rx.nearDistanceOD), dato(rx.heightOD),
                    ],
                },
                {
                    ojo: 'OI', valores: [
                        dato(rx.nearSphereOI), dato(rx.nearCylinderOI), dato(rx.nearAxisOI),
                        dato(rx.additionOI ?? rx.addition), dato(rx.nearDistanceOI), dato(rx.heightOI),
                    ],
                },
            ],
        });
    }

    const extras: Array<{ label: string; valor: string }> = [];
    if (rx.prismOD) extras.push({ label: 'Prisma OD', valor: unaLinea(String(rx.prismOD)) });
    if (rx.prismOI) extras.push({ label: 'Prisma OI', valor: unaLinea(String(rx.prismOI)) });
    if (rx.notes) extras.push({ label: 'Observaciones de la receta', valor: unaLinea(String(rx.notes)) });

    return {
        tipo: rx.prescriptionType ? unaLinea(String(rx.prescriptionType)) : null,
        tablas,
        extras,
        vacia: false,
    };
}

/**
 * La receta en texto plano, para WhatsApp y para la nota de la ficha.
 * Se dibuja desde `prescriptionRecapStructure`: mismos datos que el cuadro del
 * mail, imposible que uno muestre un campo que el otro no.
 */
export function prescriptionRecapText(rx: RecapPrescription | null | undefined): string {
    const e = prescriptionRecapStructure(rx);
    if (e.vacia) return 'Receta: no hay una receta cargada en este pedido.';

    const lineas: string[] = [];
    if (e.tipo) lineas.push(`Tipo de lente: ${e.tipo}`);

    for (const tabla of e.tablas) {
        // El título solo cuando hay más de una tabla: con una sola, decir
        // "Visión de lejos" sin que exista "de cerca" confunde.
        if (e.tablas.length > 1) lineas.push(tabla.titulo);
        for (const fila of tabla.filas) {
            const partes = tabla.columnas.map((c, i) => `${c} ${fila.valores[i]}`);
            lineas.push(`${fila.ojo}: ${partes.join('  ')}`);
        }
    }

    for (const x of e.extras) lineas.push(`${x.label}: ${x.valor}`);

    return lineas.join('\n');
}
