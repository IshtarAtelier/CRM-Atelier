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
 * ¿Esta receta tiene adición? Se mira el valor ABSOLUTO: una adición se escribe
 * en positivo, pero de una foto puede salir con signo y "-2.00" es igual de
 * multifocal que "+2.00" — lo que importa es que exista.
 */
export function tieneAdicion(data: AdicionDeReceta): boolean {
    return [data.addition, data.additionOD, data.additionOI, data.add]
        .some(v => Math.abs(aNumero(v)) > 0);
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
