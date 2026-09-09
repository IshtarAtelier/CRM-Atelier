/**
 * De qué tipo es una receta — decidido por los NÚMEROS, nunca por una etiqueta.
 *
 * La regla óptica es simple y no admite interpretación: una receta lleva
 * multifocal (o bifocal) si y solo si tiene **adición**. Sin adición hay una
 * sola graduación y el lente es monofocal.
 *
 * Existe porque el tipo venía de tres lugares que podían mentir, y mintieron:
 *
 *  1. La etiqueta 'Multifocal' que el bot le ponía a TODO lead entrado por un
 *     anuncio de Meta (era la campaña del momento). El bot lee las etiquetas de
 *     la ficha en su contexto, así que le cotizaba multifocales a gente con
 *     receta monofocal. Reportado por Ishtar el 8/9/2026 con un caso concreto.
 *  2. El campo `tipoDeLente` que manda el modelo al guardar una receta leída
 *     por foto: es texto libre generado por una IA, sin ninguna validación
 *     contra los números que ella misma acababa de leer.
 *  3. El default de `addPrescription`: `data.prescriptionType || 'ADDITION'`.
 *     Es decir, ante la duda el sistema asumía MULTIFOCAL — el error más caro
 *     de los dos posibles, porque es el lente más caro.
 *
 * Ante la duda ahora se asume monofocal: si la receta trae adición, el número
 * está ahí y se ve; si no la trae, no hay nada que "inferir".
 */

/** Los tres tipos que guarda `Prescription.prescriptionType`. */
export type TipoDeReceta = 'FAR' | 'ADDITION' | 'NEAR';

/** Campos de adición que puede traer una receta (general o por ojo). */
export interface AdicionDeReceta {
    addition?: number | string | null;
    additionOD?: number | string | null;
    additionOI?: number | string | null;
    /** Alias del bot (agent-tools manda `add`). */
    add?: number | string | null;
}

function aNumero(v: unknown): number {
    if (v === null || v === undefined || v === '') return 0;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}

/**
 * Rango clínico de una adición real. Fuera de esto, el número NO es una
 * adición: es otra cosa que se leyó mal de la foto.
 *
 * La adición corrige presbicia y en la práctica va de +0,75 a +3,50 (se deja
 * hasta 4,50 por margen). Nunca es 20, ni 0,8, ni 15.
 *
 * Por qué existe: el 9/9/2026 el bot cotizó multifocales de $735.000 a un
 * cliente con miopía de -8,00 y NINGUNA adición. Su receta tenía una columna
 * "A.V." (agudeza visual) con "20/25" — un `parseFloat("20/25")` da 20, y sin
 * este rango ese 20 entraba como adición y convertía una receta monofocal en
 * multifocal. La regla "hay adición → multifocal" solo es segura si antes se
 * verifica que el número PUEDA ser una adición.
 */
const ADICION_MINIMA = 0.5;
const ADICION_MAXIMA = 4.5;

/** ¿Este número puede ser una adición de verdad? */
export function esAdicionPlausible(v: unknown): boolean {
    const n = Math.abs(aNumero(v));
    return n >= ADICION_MINIMA && n <= ADICION_MAXIMA;
}

/**
 * ¿Esta receta tiene adición? Se mira el valor ABSOLUTO (de una foto puede
 * salir con signo, y "-2.00" es igual de multifocal que "+2.00") y que caiga
 * en el rango clínico: un "20" leído de la columna de agudeza visual no es
 * una adición, es basura de OCR.
 */
export function tieneAdicion(data: AdicionDeReceta): boolean {
    return [data.addition, data.additionOD, data.additionOI, data.add]
        .some(esAdicionPlausible);
}

/**
 * El tipo que corresponde según los números.
 *
 * `explicito` es lo que pidió quien carga la receta (o lo que dijo el modelo).
 * Solo se respeta para 'NEAR' (receta de cerca), que es una decisión humana que
 * los números no distinguen. Entre monofocal y multifocal mandan los números.
 */
export function tipoDeRecetaSegunNumeros(
    data: AdicionDeReceta,
    explicito?: string | null,
): TipoDeReceta {
    if (explicito === 'NEAR') return 'NEAR';
    return tieneAdicion(data) ? 'ADDITION' : 'FAR';
}

/**
 * Para los caminos donde el tipo lo elige una PERSONA (la ficha del CRM): se
 * respeta lo que eligió, y solo se deriva de los números cuando no eligió nada.
 *
 * La diferencia con `tipoDeRecetaSegunNumeros` es a propósito: ahí el "tipo
 * explícito" lo escribió una IA leyendo una foto y no es una autoridad; acá lo
 * escribió un óptico mirando la receta y sí lo es. Lo que se arregla en los dos
 * casos es el DEFAULT: antes, sin dato, se asumía multifocal.
 */
export function tipoDeRecetaConDefault(
    data: AdicionDeReceta,
    explicito?: string | null,
): TipoDeReceta {
    if (explicito === 'FAR' || explicito === 'ADDITION' || explicito === 'NEAR') return explicito;
    return tipoDeRecetaSegunNumeros(data);
}

/**
 * Devuelve un aviso cuando la etiqueta contradice a los números, para dejarlo
 * anotado en la ficha en vez de que la contradicción se pierda en silencio.
 * `null` si no hay contradicción.
 */
export function contradiccionDeTipo(
    data: AdicionDeReceta,
    explicito?: string | null,
): string | null {
    if (!explicito || explicito === 'NEAR') return null;
    const porNumeros = tieneAdicion(data);
    const decia = explicito === 'ADDITION' || /multi|bifocal|progres/i.test(explicito);
    if (decia && !porNumeros) {
        return 'La receta se cargó como MULTIFOCAL pero no trae adición: se guardó como monofocal. Conviene revisar la foto.';
    }
    if (!decia && porNumeros) {
        return 'La receta se cargó como MONOFOCAL pero trae adición: se guardó como multifocal. Conviene revisar la foto.';
    }
    return null;
}
