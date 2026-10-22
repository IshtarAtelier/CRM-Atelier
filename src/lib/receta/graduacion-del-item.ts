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
 *  · El uso lo elige quien vende, por cristal MONOFOCAL: LEJOS o CERCA. Por
 *    defecto LEJOS, salvo que la receta sea SOLO de cerca (por los números).
 *    Un multifocal, bifocal u ocupacional es siempre LEJOS (receta completa).
 *  · CERCA = la graduación de cerca escrita en la receta; si no está escrita,
 *    lejos + adición (cilindro y eje de lejos). La DNP, la de cerca si está.
 *  · Sin cerca ni adición en la receta no hay CERCA que elegir.
 *  · Un cristal de CERCA no lleva adición: es una sola graduación.
 *
 * Los tres robots de laboratorio y el PDF leen la graduación del ítem, así que
 * con esto salen bien solos. Puro: sin base ni red.
 */
import { esAdicionPlausible } from './tipo-de-lente';

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
    /** DNP de cerca SOLO si la receta la trae; null = no se toca la DNP del ítem. */
    dnpCerca: number | null;
}

const num = (v: unknown): number | null => { if (v === null || v === undefined || v === '') return null; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const redondear = (n: number) => Math.round(n * 100) / 100;

/** La adición del ojo: la suya, la general, o la diferencia cerca − lejos (positiva) si la receta está escrita en dos secciones. Puro. */
export function adicionDelOjo(rx: RecetaParaItem, ojo: 'OD' | 'OI'): number | null {
    const propia = num(ojo === 'OD' ? rx.additionOD : rx.additionOI) ?? num(rx.addition);
    if (propia !== null && propia > 0 && esAdicionPlausible(propia)) return propia;
    const lejos = num(ojo === 'OD' ? rx.sphereOD : rx.sphereOI), cerca = num(ojo === 'OD' ? rx.nearSphereOD : rx.nearSphereOI);
    if (lejos !== null && cerca !== null && cerca - lejos > 0 && esAdicionPlausible(cerca - lejos)) return redondear(cerca - lejos);
    return null;
}

/** ¿Esta receta permite un cristal de CERCA? Tiene la graduación de cerca escrita, o una adición. Puro. */
export function recetaPermiteCerca(rx: RecetaParaItem | null | undefined): boolean {
    if (!rx) return false;
    if (num(rx.nearSphereOD) !== null || num(rx.nearSphereOI) !== null) return true;
    return adicionDelOjo(rx, 'OD') !== null || adicionDelOjo(rx, 'OI') !== null;
}

/**
 * ¿La receta es SOLO de cerca? Por los NÚMEROS: sin esfera de lejos en ningún
 * ojo y con la de cerca escrita. Nunca por `prescriptionType`: la ficha guarda
 * 'NEAR' en cualquier receta que tenga la sección Cerca llena, también en las
 * multifocales escritas en dos secciones (auditoría del 22/10/2026), y tomarlo
 * al pie de la letra mandaba progresivos a fábrica con la graduación de cerca.
 */
export function recetaSoloDeCerca(rx: RecetaParaItem | null | undefined): boolean {
    if (!rx) return false;
    const sinLejos = num(rx.sphereOD) === null && num(rx.sphereOI) === null;
    return sinLejos && (num(rx.nearSphereOD) !== null || num(rx.nearSphereOI) !== null);
}

/** Lo que el selector muestra marcado cuando la línea no eligió: CERCA solo si la receta es solo de cerca. Puro. */
export function usoPorDefecto(rx: RecetaParaItem | null | undefined): UsoDelCristal {
    return recetaSoloDeCerca(rx) ? 'CERCA' : 'LEJOS';
}

/**
 * El uso que se APLICA al cristal. CERCA únicamente si: el cristal es
 * MONOFOCAL, la receta permite cerca, y quien vende eligió CERCA (o no eligió
 * y la receta es solo de cerca). Cualquier otro caso —multifocal, bifocal,
 * receta sin cerca, sin elección— es LEJOS, es decir, lo de siempre. Puro.
 */
export function usoEfectivo(guardado: string | null | undefined, rx: RecetaParaItem | null | undefined, esMono: boolean): UsoDelCristal {
    if (!esMono || !rx || !recetaPermiteCerca(rx)) return 'LEJOS';
    const u = String(guardado || '').toUpperCase();
    if (u === 'CERCA') return 'CERCA';
    if (u === 'LEJOS') return 'LEJOS';
    return usoPorDefecto(rx);
}

/**
 * La graduación que va al cristal de un ojo según su uso.
 *  · LEJOS: EXACTAMENTE lo que se copiaba antes del 21/10/2026 (columna de lejos y la adición tal cual), para no cambiar ninguna venta de siempre.
 *  · CERCA: la sección Cerca si está escrita; si no, lejos + adición (cilindro y eje de lejos). Sin adición en el ítem.
 * `dnpCerca`: la DNP de cerca SOLO si la receta la trae (nearDistance / nearPd); null si no — la DNP medida no se pisa.
 */
export function graduacionDelItem(rx: RecetaParaItem | null | undefined, ojo: 'OD' | 'OI', uso: UsoDelCristal): GraduacionDelItem {
    if (!rx) return { sphereVal: null, cylinderVal: null, axisVal: null, additionVal: null, dnpCerca: null };
    const od = ojo === 'OD';
    const lejos = { sphereVal: (od ? rx.sphereOD : rx.sphereOI) ?? null, cylinderVal: (od ? rx.cylinderOD : rx.cylinderOI) ?? null, axisVal: (od ? rx.axisOD : rx.axisOI) ?? null };
    if (uso === 'LEJOS') return { ...lejos, additionVal: (od ? (rx.additionOD ?? rx.addition) : (rx.additionOI ?? rx.addition)) ?? null, dnpCerca: null };
    const cercaEscrita = num(od ? rx.nearSphereOD : rx.nearSphereOI);
    const adic = adicionDelOjo(rx, ojo);
    const esfLejos = num(lejos.sphereVal);
    const sphereVal = cercaEscrita !== null ? cercaEscrita : esfLejos !== null && adic !== null ? redondear(esfLejos + adic) : esfLejos;
    const cilCerca = num(od ? rx.nearCylinderOD : rx.nearCylinderOI), ejeCerca = num(od ? rx.nearAxisOD : rx.nearAxisOI);
    const cylinderVal = cercaEscrita !== null && cilCerca !== null ? cilCerca : num(lejos.cylinderVal);
    const axisVal = cercaEscrita !== null && ejeCerca !== null ? ejeCerca : num(lejos.axisVal);
    const dnpCerca = num(od ? rx.nearDistanceOD : rx.nearDistanceOI) ?? (num(rx.nearPd) !== null ? redondear(num(rx.nearPd)! / 2) : null);
    return { sphereVal, cylinderVal, axisVal, additionVal: null, dnpCerca };
}

/** ¿El producto es un monofocal (el único cristal al que le cabe elegir lejos/cerca)? Puro. */
export function esMonofocal(producto: { type?: string | null; category?: string | null } | null | undefined, typeSnapshot?: string | null): boolean {
    const t = String(producto?.type ?? typeSnapshot ?? '').toLowerCase();
    return t.includes('monofocal');
}
