/**
 * El rango de graduación que cubre un cristal, leído de su propio nombre.
 *
 * El catálogo lo declara al final del nombre, con formato constante:
 *   "Monofocal TALLADO (CNC) · Orgánico Blanco hasta Diám. 70 1.49 · Esf -10/+8 Cil -6/6"
 *   "Stock · Mineral Blanco 1.523 · Esf -4/+4 Cil -2/2"
 *   "Stock · Policarbonato c/AR 1.59 · Esf -6/+6 Cil -2/2"
 *
 * Para qué sirve: que no se cotice un cristal que NO SE PUEDE FABRICAR para esa
 * receta. Un stock "Esf -4/+4" a un cliente de -8 no existe — el laboratorio lo
 * rechaza y el presupuesto que se le mandó no vale nada. Antes nada cruzaba una
 * cosa con la otra: se ofrecía por precio y por categoría (pedido de Ishtar,
 * 9/9/2026: "podés cruzarlo bien siempre con los rangos").
 *
 * Ojo con el signo: los rangos son ASIMÉTRICOS. "Esf +8/+22" cubre un +8 pero
 * no un -8; por eso no alcanza con mirar el valor absoluto de la graduación.
 *
 * Un cristal que no declara rango se deja pasar: la mayoría del catálogo no lo
 * dice, y descartar por falta de dato sería dejar al bot sin nada que ofrecer.
 * Este filtro solo saca lo que se sabe con certeza que NO entra.
 */

export interface RangoDeCristal {
    esfMin: number;
    esfMax: number;
    /** null cuando el nombre no declara rango de cilindro. */
    cilMin: number | null;
    cilMax: number | null;
}

/** "-10/+8" → [-10, 8] · "-6/6" → [-6, 6] */
function parsearPar(texto: string): [number, number] | null {
    const m = texto.match(/([+-]?\d+(?:[.,]\d+)?)\s*\/\s*([+-]?\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    const a = parseFloat(m[1].replace(',', '.'));
    const b = parseFloat(m[2].replace(',', '.'));
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return [Math.min(a, b), Math.max(a, b)];
}

/** Lee el rango declarado en el nombre. null si el producto no declara ninguno. */
export function parsearRango(nombre: string | null | undefined): RangoDeCristal | null {
    if (!nombre) return null;
    const esf = nombre.match(/Esf\.?\s*([+-]?\d+(?:[.,]\d+)?\s*\/\s*[+-]?\d+(?:[.,]\d+)?)/i);
    if (!esf) return null;
    const parEsf = parsearPar(esf[1]);
    if (!parEsf) return null;

    const cil = nombre.match(/Cil\.?\s*([+-]?\d+(?:[.,]\d+)?\s*\/\s*[+-]?\d+(?:[.,]\d+)?)/i);
    const parCil = cil ? parsearPar(cil[1]) : null;

    return {
        esfMin: parEsf[0], esfMax: parEsf[1],
        cilMin: parCil ? parCil[0] : null,
        cilMax: parCil ? parCil[1] : null,
    };
}

export interface GraduacionDeReceta {
    odEsf?: number | null;
    oiEsf?: number | null;
    odCil?: number | null;
    oiCil?: number | null;
}

const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};

/** ¿Hay al menos un dato de graduación con el que cruzar? */
export function tieneGraduacion(r: GraduacionDeReceta | null | undefined): boolean {
    if (!r) return false;
    return [r.odEsf, r.oiEsf, r.odCil, r.oiCil].some(v => num(v) !== null);
}

/**
 * ¿Este cristal se puede fabricar para esta receta?
 *
 * true también cuando el producto no declara rango (no se sabe → no se
 * descarta) o cuando no hay datos de la receta con los que cruzar.
 * Se exige que entren AMBOS ojos: un cristal se pide para el par.
 */
export function cubreLaReceta(nombre: string | null | undefined, receta: GraduacionDeReceta | null | undefined): boolean {
    const rango = parsearRango(nombre);
    if (!rango) return true;
    if (!tieneGraduacion(receta)) return true;

    for (const esf of [num(receta!.odEsf), num(receta!.oiEsf)]) {
        if (esf === null) continue;
        if (esf < rango.esfMin || esf > rango.esfMax) return false;
    }
    if (rango.cilMin !== null && rango.cilMax !== null) {
        for (const cil of [num(receta!.odCil), num(receta!.oiCil)]) {
            if (cil === null) continue;
            if (cil < rango.cilMin || cil > rango.cilMax) return false;
        }
    }
    return true;
}

/** Explicación corta de por qué se descartó, para el log. */
export function motivoDeDescarte(nombre: string, receta: GraduacionDeReceta): string | null {
    const r = parsearRango(nombre);
    if (!r || cubreLaReceta(nombre, receta)) return null;
    const esferas = [num(receta.odEsf), num(receta.oiEsf)].filter(v => v !== null);
    return `cubre Esf ${r.esfMin}/${r.esfMax} y la receta tiene ${esferas.join(' / ')}`;
}
