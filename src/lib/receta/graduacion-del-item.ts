/**
 * LA GRADUACIÓN QUE LLEVA CADA CRISTAL DE LA VENTA, según para qué se usa.
 *
 * Un monofocal puede ser de LEJOS o de CERCA, y la receta tiene las dos: la de
 * cerca escrita aparte (`nearSphere…`) o como lejos + adición. Hasta el
 * 21/10/2026 la venta copiaba SIEMPRE la columna de lejos al cristal
 * (order.service, dos lugares), así que un monofocal de cerca salía a fábrica
 * con la graduación de lejos (Ishtar: "siempre me toma la de lejos").
 *
 * Regla (Ishtar, 21/10/2026):
 *  · El uso lo elige quien vende, por cristal: LEJOS o CERCA. Por defecto
 *    LEJOS, salvo que la receta sea SOLO de cerca (tipo NEAR).
 *  · CERCA = la graduación de cerca escrita en la receta; si no está escrita,
 *    lejos + adición (cilindro y eje de lejos). La DNP, la de cerca si está.
 *  · Sin cerca ni adición en la receta no hay CERCA que elegir.
 *  · Un cristal de CERCA no lleva adición: es una sola graduación.
 *
 * Los tres robots de laboratorio y el PDF leen la graduación del ítem, así que
 * con esto salen bien solos. Puro: sin base ni red.
 */
import { tipoDeRecetaConDefault, esAdicionPlausible } from './tipo-de-lente';

export type UsoDelCristal = 'LEJOS' | 'CERCA';
export const USOS_DEL_CRISTAL: UsoDelCristal[] = ['LEJOS', 'CERCA'];
export const ETIQUETA_USO: Record<UsoDelCristal, string> = { LEJOS: 'Lejos', CERCA: 'Cerca' };

/** Lo que el cálculo necesita de la receta (la fila de Prisma lo cumple). */
export interface RecetaParaItem {
    sphereOD?: number | null; cylinderOD?: number | null; axisOD?: number | null;
    sphereOI?: number | null; cylinderOI?: number | null; axisOI?: number | null;
    addition?: number | null; additionOD?: number | null; additionOI?: number | null;
    nearSphereOD?: number | null; nearCylinderOD?: number | null; nearAxisOD?: number | null;
    nearSphereOI?: number | null; nearCylinderOI?: number | null; nearAxisOI?: number | null;
    distanceOD?: number | null; distanceOI?: number | null; pd?: number | null;
    nearDistanceOD?: number | null; nearDistanceOI?: number | null; nearPd?: number | null;
    prescriptionType?: string | null;
}

export interface GraduacionDelItem {
    sphereVal: number | null; cylinderVal: number | null; axisVal: number | null; additionVal: number | null;
    /** DNP del ojo para este uso; null si la receta no la trae (se deja lo que tenga el ítem). */
    pdVal: number | null;
}

const num = (v: unknown): number | null => { if (v === null || v === undefined || v === '') return null; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const redondear = (n: number) => Math.round(n * 100) / 100;

/** La adición del ojo: la suya, la general, o la diferencia cerca − lejos si la receta está escrita en dos secciones. Puro. */
export function adicionDelOjo(rx: RecetaParaItem, ojo: 'OD' | 'OI'): number | null {
    const propia = num(ojo === 'OD' ? rx.additionOD : rx.additionOI) ?? num(rx.addition);
    if (propia !== null && esAdicionPlausible(propia)) return propia;
    const lejos = num(ojo === 'OD' ? rx.sphereOD : rx.sphereOI), cerca = num(ojo === 'OD' ? rx.nearSphereOD : rx.nearSphereOI);
    if (lejos !== null && cerca !== null && esAdicionPlausible(cerca - lejos)) return redondear(cerca - lejos);
    return null;
}

/** ¿Esta receta permite un cristal de CERCA? Tiene la graduación de cerca escrita, o una adición. Puro. */
export function recetaPermiteCerca(rx: RecetaParaItem | null | undefined): boolean {
    if (!rx) return false;
    if (num(rx.nearSphereOD) !== null || num(rx.nearSphereOI) !== null) return true;
    return adicionDelOjo(rx, 'OD') !== null || adicionDelOjo(rx, 'OI') !== null;
}

/** El uso por defecto de un cristal: CERCA solo si la receta es SOLO de cerca; si no, LEJOS. Puro. */
export function usoPorDefecto(rx: RecetaParaItem | null | undefined): UsoDelCristal {
    if (!rx) return 'LEJOS';
    return tipoDeRecetaConDefault(rx, rx.prescriptionType) === 'NEAR' ? 'CERCA' : 'LEJOS';
}

/** Normaliza lo que venga guardado ('CERCA', 'cerca', null…) a un uso válido, con el default de la receta. Puro. */
export function usoDelCristal(guardado: string | null | undefined, rx: RecetaParaItem | null | undefined): UsoDelCristal {
    const u = String(guardado || '').toUpperCase();
    if (u === 'CERCA' || u === 'LEJOS') return u;
    return usoPorDefecto(rx);
}

/**
 * La graduación que va al cristal de un ojo según su uso. Para CERCA, si la
 * receta no tiene ni cerca escrita ni adición, devuelve la de lejos (no hay
 * otra) — por eso `recetaPermiteCerca` se controla antes de ofrecer CERCA.
 */
export function graduacionDelItem(rx: RecetaParaItem | null | undefined, ojo: 'OD' | 'OI', uso: UsoDelCristal): GraduacionDelItem {
    if (!rx) return { sphereVal: null, cylinderVal: null, axisVal: null, additionVal: null, pdVal: null };
    const od = ojo === 'OD';
    const lejos = { sphereVal: num(od ? rx.sphereOD : rx.sphereOI), cylinderVal: num(od ? rx.cylinderOD : rx.cylinderOI), axisVal: num(od ? rx.axisOD : rx.axisOI) };
    const pdLejos = num(od ? rx.distanceOD : rx.distanceOI) ?? (num(rx.pd) !== null ? redondear(num(rx.pd)! / 2) : null);
    if (uso === 'LEJOS') return { ...lejos, additionVal: adicionDelOjo(rx, ojo), pdVal: pdLejos };
    const cercaEscrita = num(od ? rx.nearSphereOD : rx.nearSphereOI);
    const adic = adicionDelOjo(rx, ojo);
    const sphereVal = cercaEscrita !== null ? cercaEscrita : lejos.sphereVal !== null && adic !== null ? redondear(lejos.sphereVal + adic) : lejos.sphereVal;
    const cylinderVal = cercaEscrita !== null && num(od ? rx.nearCylinderOD : rx.nearCylinderOI) !== null ? num(od ? rx.nearCylinderOD : rx.nearCylinderOI) : lejos.cylinderVal;
    const axisVal = cercaEscrita !== null && num(od ? rx.nearAxisOD : rx.nearAxisOI) !== null ? num(od ? rx.nearAxisOD : rx.nearAxisOI) : lejos.axisVal;
    const pdVal = num(od ? rx.nearDistanceOD : rx.nearDistanceOI) ?? (num(rx.nearPd) !== null ? redondear(num(rx.nearPd)! / 2) : null) ?? pdLejos;
    // Un cristal de cerca es una sola graduación: no lleva adición.
    return { sphereVal, cylinderVal, axisVal, additionVal: null, pdVal };
}

/** ¿El producto es un monofocal (el único cristal al que le cabe elegir lejos/cerca)? Puro. */
export function esMonofocal(producto: { type?: string | null; category?: string | null } | null | undefined, typeSnapshot?: string | null): boolean {
    const t = String(producto?.type ?? typeSnapshot ?? '').toLowerCase();
    return t.includes('monofocal');
}
