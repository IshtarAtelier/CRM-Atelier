import { prisma } from '../../../lib/db';
import { framesDeLaOrden } from '../../../lib/order-frames';
import { cristalVitolenPorNombre, type CristalVitolen } from './catalogo';
import { disenoDelPortal, materialDelPortal } from './materiales';

/**
 * ARMADO DEL PEDIDO DE VITOLEN A PARTIR DE LA VENTA (la parte pura de la carga
 * asistida). Devuelve exactamente lo que el robot va a escribir en el portal
 * —campo por campo, como la pantalla "Pedido de Laboratorio" del video de
 * Vitolen (docs/vitolen-pedidos-y-promos.md)— o la lista de lo que falta.
 *
 * Nada se inventa: si un dato obligatorio no está en la venta, el pedido no se
 * prepara y se dice qué falta. Lo que la persona aprueba después es este
 * payload tal cual, más la captura del portal.
 */

export type OjoPortal = 'AMBOS' | 'OD' | 'OI';
export type TipoRecetaPortal = 'Monofocal' | 'Bifocal' | 'Ocupacional' | 'Progresivo';

export interface GraduacionOjo {
    esferico: number;
    cilindrico: number | null;
    eje: number | null;
    adicion: number | null;
    dnp: number | null;        // DNP-L (20 a 80)
    altura: number | null;     // altura pupilar de lejos (14 a 50)
    codigo: string;            // código del producto en la lista L96
    material: string;          // texto del CRM, para que la persona lo lea
    color: string | null;      // color del cristal en la venta (Sensity / Polarized)
    /** La opción exacta del select del portal (materiales.ts): id y texto, para marcarla y verificarla. */
    portalMaterial: { id: string; texto: string } | null;
}

export interface PayloadVitolen {
    lista: string;
    /** Qué par de la venta es (1 o 2): el 2º lleva la promo del segundo par. */
    par: number;
    nroCasoInterno: string;    // código corto de la venta: #A1B2
    paciente: string;
    ojos: OjoPortal;
    tipoReceta: TipoRecetaPortal;
    diseno: string;
    /** El logo del portal que corresponde al diseño (data-id y nombre). */
    portalDiseno: { dataId: string; nombre: string } | null;
    variante: string | null;   // Urban/Indoor/Outdoor, 40/60, 5/9/13, DP40/SP60
    od: GraduacionOjo | null;
    oi: GraduacionOjo | null;
    distanciaVertice: number;  // 10 a 20
    anguloPantoscopico: number; // 0 a 30
    armazon: {
        forma: string | null;      // "Forma 1".."Forma 12" del portal
        largo: number | null;      // A
        alto: number | null;       // B
        diagonalMayor: number | null; // ED
        /** Ángulo de la diagonal mayor (0 a 180). El portal lo exige y el CRM no lo guarda: lo pone quien prepara. */
        ejeDiagonal: number | null;
        puente: number | null;     // DBL
        tipo: string | null;       // Metálico, Acetato…
        caracteristicas: string;   // marca, modelo, color
        funcionalidad: 'Aro Convencional'; // lo que el robot marca en el portal
    };
    tratamientos: { antirreflejo: boolean };
    montajes: { calibrado: boolean };
    observaciones: string;
    /** Segundo par de la promo: nº del pedido del primer par en el portal. */
    pedidoOrigen: string | null;
}

export interface ResultadoArmado {
    ok: boolean;
    payload: PayloadVitolen | null;
    faltantes: string[];
    avisos: string[];
}

/** Lo que el armado necesita de la venta: un recorte plano, sin Prisma. */
export interface VentaParaCarga {
    id: string;
    clienteNombre: string;
    /** labStatus de la venta: solo se carga en el portal una venta ENVIADA a fábrica. */
    labStatus?: string | null;
    labNotes?: string | null;
    labFrameShape?: string | null;
    labFrameType?: string | null;
    labFrameDetails?: string | null;
    userFrameBrand?: string | null;
    userFrameModel?: string | null;
    labPdOd?: number | null;
    labPdOi?: number | null;
    labHeightOD?: number | null;
    labHeightOI?: number | null;
    frameA?: string | null; frameB?: string | null; frameDbl?: string | null; frameEdc?: string | null;
    frames?: { position: number; shape: string | null; a: string | null; b: string | null; dbl: string | null; edc: string | null; details: string | null; heightOD: number | null; heightOI: number | null }[];
    prescription?: {
        sphereOD: number | null; cylinderOD: number | null; axisOD: number | null;
        sphereOI: number | null; cylinderOI: number | null; axisOI: number | null;
        addition: number | null; additionOD: number | null; additionOI: number | null;
        pd: number | null; distanceOD: number | null; distanceOI: number | null;
        heightOD: number | null; heightOI: number | null;
    } | null;
    items: {
        eye: string | null;
        productNameSnapshot: string | null;
        productTypeSnapshot: string | null;
        laboratorySnapshot: string | null;
        productCategorySnapshot: string | null;
        sphereVal: number | null; cylinderVal: number | null; axisVal: number | null; additionVal: number | null;
        pdVal: number | null; heightVal: number | null;
        crystalColor: string | null;
        framePosition: number | null;
        price: number;
    }[];
}

/** Valores del portal cuando la venta no dice otra cosa (los del video). */
export const VERTICE_POR_DEFECTO = 14;
export const PANTOSCOPICO_POR_DEFECTO = 6;

/** "Cristal Multifocal" → Progresivo, etc. Puro. */
export function tipoRecetaDe(productType: string | null | undefined): TipoRecetaPortal | null {
    const t = String(productType || '').toLowerCase();
    if (t.includes('multifocal') || t.includes('progresiv')) return 'Progresivo';
    if (t.includes('ocupacional')) return 'Ocupacional';
    if (t.includes('bifocal')) return 'Bifocal';
    if (t.includes('monofocal')) return 'Monofocal';
    return null;
}

const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};

/**
 * Qué código del catálogo corresponde: si el cristal tiene variantes
 * (Urban/Indoor/Outdoor, Tact 40/60, Sync 5/9/13, Office DP40/SP60) hace falta
 * elegir una; se busca en `variante` (lo que cargó el vendedor). Puro.
 */
export function codigoDeCristal(cristal: CristalVitolen, variante: string | null | undefined): { codigo: string | null; variante: string | null; motivo?: string } {
    if (cristal.codigos.length === 0) return { codigo: null, variante: null, motivo: `${cristal.nombre} no tiene código en la lista ${cristal.linea}` };
    if (cristal.variantes.length <= 1 || cristal.codigos.length === 1) return { codigo: cristal.codigos[0], variante: cristal.variantes[0] ?? null };
    const v = String(variante || '').trim().toLowerCase();
    const idx = cristal.variantes.findIndex(x => x.toLowerCase() === v || (v && x.toLowerCase().includes(v)));
    if (idx < 0) return { codigo: null, variante: null, motivo: `${cristal.diseno} viene en ${cristal.variantes.join(' / ')}: hay que elegir una variante` };
    return { codigo: cristal.codigos[idx] ?? cristal.codigos[0], variante: cristal.variantes[idx] };
}

/**
 * Arma el payload del portal. `pair` es el armazón/par de la venta (1 o 2, como
 * `framePosition`); `variante` es la elegida por el vendedor cuando el diseño
 * la exige; `pedidoOrigen` es el nº del primer par para la promo del 2º.
 */
export function armarFormulario(
    venta: VentaParaCarga,
    opts: { pair?: number; variante?: string | null; pedidoOrigen?: string | null; forma?: string | null; ejeDiagonal?: number | null } = {},
): ResultadoArmado {
    const faltantes: string[] = [];
    const avisos: string[] = [];
    const pair = opts.pair ?? 1;

    // Un ítem sin posición de armazón es del par 1: no puede "prestarse" al par 2.
    const cristales = venta.items.filter(i =>
        /cristal/i.test(i.productCategorySnapshot || '') && /vitolen/i.test(i.laboratorySnapshot || '')
        && (i.framePosition ?? 1) === pair);
    if (cristales.length === 0) {
        return { ok: false, payload: null, faltantes: [`la venta no tiene cristales de Vitolen para el par ${pair}`], avisos };
    }

    const nombres = [...new Set(cristales.map(c => c.productNameSnapshot || ''))];
    if (nombres.length > 1) avisos.push(`el par ${pair} mezcla dos cristales distintos (${nombres.join(' y ')}): se carga cada ojo con el suyo`);

    const tipoReceta = tipoRecetaDe(cristales[0].productTypeSnapshot);
    if (!tipoReceta) faltantes.push(`no se reconoce el tipo de cristal "${cristales[0].productTypeSnapshot}"`);

    const rx = venta.prescription;
    const ojo = (lado: 'OD' | 'OI'): GraduacionOjo | null => {
        const item = cristales.find(c => (c.eye || '').toUpperCase() === lado) ?? (cristales.length === 1 && !cristales[0].eye ? cristales[0] : null);
        if (!item) return null;
        const cristal = cristalVitolenPorNombre(item.productNameSnapshot);
        if (!cristal) { faltantes.push(`"${item.productNameSnapshot}" no está en el catálogo de Vitolen (regenerar catalogo.ts si es un cristal nuevo)`); return null; }
        const { codigo, motivo } = codigoDeCristal(cristal, opts.variante);
        if (!codigo) { faltantes.push(motivo!); return null; }
        const enPortal = materialDelPortal(cristal, { variante: opts.variante, color: item.crystalColor });
        if (!enPortal.opcion) faltantes.push(`material ${lado} en el portal: ${enPortal.motivo}`);

        const esferico = num(item.sphereVal) ?? num(lado === 'OD' ? rx?.sphereOD : rx?.sphereOI);
        if (esferico === null) faltantes.push(`esférico ${lado}`);
        const cilindrico = num(item.cylinderVal) ?? num(lado === 'OD' ? rx?.cylinderOD : rx?.cylinderOI);
        const eje = num(item.axisVal) ?? num(lado === 'OD' ? rx?.axisOD : rx?.axisOI);
        if (cilindrico && eje === null) faltantes.push(`eje ${lado} (hay cilindro sin eje)`);
        const adicion = num(item.additionVal) ?? num(lado === 'OD' ? rx?.additionOD : rx?.additionOI) ?? num(rx?.addition);
        if ((tipoReceta === 'Progresivo' || tipoReceta === 'Ocupacional' || tipoReceta === 'Bifocal') && adicion === null) faltantes.push(`adición ${lado}`);
        const dnp = num(item.pdVal) ?? num(lado === 'OD' ? venta.labPdOd : venta.labPdOi) ?? num(lado === 'OD' ? rx?.distanceOD : rx?.distanceOI) ?? (num(rx?.pd) != null ? Math.round((num(rx?.pd)! / 2) * 2) / 2 : null);
        if (dnp === null) faltantes.push(`DNP ${lado}`);
        const frame = venta.frames?.find(f => f.position === pair);
        const altura = num(item.heightVal) ?? num(lado === 'OD' ? frame?.heightOD : frame?.heightOI) ?? num(lado === 'OD' ? venta.labHeightOD : venta.labHeightOI) ?? num(lado === 'OD' ? rx?.heightOD : rx?.heightOI);
        if (altura === null && tipoReceta !== 'Monofocal') faltantes.push(`altura pupilar ${lado}`);

        return { esferico: esferico ?? 0, cilindrico, eje, adicion, dnp, altura, codigo, material: cristal.material, color: item.crystalColor || null, portalMaterial: enPortal.opcion };
    };
    const od = ojo('OD');
    const oi = ojo('OI');
    if (!od && !oi) faltantes.push('ningún ojo con cristal');

    const cristalBase = cristalVitolenPorNombre(cristales[0].productNameSnapshot);
    const eleccion = cristalBase ? codigoDeCristal(cristalBase, opts.variante) : { variante: null };

    // Primero la fila del par en OrderFrame; si no está, las columnas viejas
    // de la venta (framesDeLaOrden sabe cuáles corresponden a cada posición).
    const frame = venta.frames?.find(f => f.position === pair)
        ?? framesDeLaOrden(venta as any).find((f: any) => f.position === pair)
        ?? null;
    const largo = num(frame?.a), alto = num(frame?.b), puente = num(frame?.dbl), diagonal = num(frame?.edc);
    for (const [nombre, valor] of [['largo (A)', largo], ['alto (B)', alto], ['puente (DBL)', puente]] as const) {
        if (valor === null) faltantes.push(`medida del armazón: ${nombre}`);
    }
    const forma = opts.forma ?? null;
    if (!forma) faltantes.push('forma del armazón en el portal (Forma 1 a 12): se elige al preparar');
    // El portal rechaza el pedido sin este ángulo ("Armazón: Eje no puede estar en blanco", visto el 3/10/2026).
    const ejeDiagonal = num(opts.ejeDiagonal);
    if (ejeDiagonal === null || ejeDiagonal < 0 || ejeDiagonal > 180) faltantes.push('eje de la diagonal mayor del armazón (0 a 180): se carga al preparar');

    const caracteristicas = [venta.userFrameBrand, venta.userFrameModel, frame?.details || venta.labFrameDetails].filter(Boolean).join(' ').trim();

    const payload: PayloadVitolen = {
        lista: 'L96',
        par: pair,
        nroCasoInterno: `#${venta.id.slice(-4).toUpperCase()}`,
        paciente: venta.clienteNombre,
        ojos: od && oi ? 'AMBOS' : od ? 'OD' : 'OI',
        tipoReceta: tipoReceta ?? 'Monofocal',
        diseno: cristalBase?.diseno ?? '',
        portalDiseno: (() => { const d = cristalBase ? disenoDelPortal(cristalBase) : null; return d ? { dataId: d.dataId, nombre: d.nombre } : null; })(),
        variante: eleccion.variante ?? null,
        od, oi,
        distanciaVertice: VERTICE_POR_DEFECTO,
        anguloPantoscopico: PANTOSCOPICO_POR_DEFECTO,
        armazon: {
            forma, largo, alto, diagonalMayor: diagonal, ejeDiagonal, puente,
            tipo: venta.labFrameType || null,
            caracteristicas,
            funcionalidad: 'Aro Convencional',
        },
        tratamientos: { antirreflejo: !(cristalBase?.sinAntirreflejo) },
        montajes: { calibrado: true },
        observaciones: [venta.labNotes].filter(Boolean).join(' ').trim(),
        pedidoOrigen: opts.pedidoOrigen ?? null,
    };

    return { ok: faltantes.length === 0, payload: faltantes.length === 0 ? payload : payload, faltantes, avisos };
}

/** Lee de la base lo que `armarFormulario` necesita. */
export async function leerVentaParaCarga(orderId: string): Promise<VentaParaCarga | null> {
    const o = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
            id: true, labStatus: true, labNotes: true, labFrameShape: true, labFrameType: true, labFrameDetails: true,
            userFrameBrand: true, userFrameModel: true, labPdOd: true, labPdOi: true, labHeightOD: true, labHeightOI: true,
            frameA: true, frameB: true, frameDbl: true, frameEdc: true,
            frames: { select: { position: true, shape: true, a: true, b: true, dbl: true, edc: true, details: true, heightOD: true, heightOI: true } },
            client: { select: { name: true } },
            prescription: {
                select: {
                    sphereOD: true, cylinderOD: true, axisOD: true, sphereOI: true, cylinderOI: true, axisOI: true,
                    addition: true, additionOD: true, additionOI: true, pd: true, distanceOD: true, distanceOI: true, heightOD: true, heightOI: true,
                },
            },
            items: {
                select: {
                    eye: true, productNameSnapshot: true, productTypeSnapshot: true, laboratorySnapshot: true, productCategorySnapshot: true,
                    sphereVal: true, cylinderVal: true, axisVal: true, additionVal: true, pdVal: true, heightVal: true,
                    crystalColor: true, framePosition: true, price: true,
                },
            },
        },
    });
    if (!o) return null;
    return { ...o, clienteNombre: o.client?.name || '' };
}
