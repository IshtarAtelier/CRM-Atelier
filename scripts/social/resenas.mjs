/**
 * El número de reseñas como DATO, nunca como texto tipeado.
 *
 * EL PROBLEMA QUE RESUELVE: un anuncio quedó diciendo "675 reseñas" cuando ya
 * iban 701. Un número de reseñas escrito a mano en una pieza envejece igual que
 * un precio — y acá los precios ya tienen su regla (R6): no se tipean, se
 * generan. Este módulo le da a las reseñas el mismo tratamiento.
 *
 * CÓMO FUNCIONA:
 *   - El último dato REAL vive en `social/resenas.json` (total y rating). Lo
 *     refresca `actualizar-resenas.mjs` leyendo el endpoint público
 *     /api/reviews (Google via el sitio) — la corrida semanal de los viernes
 *     lo ejecuta junto con la regeneración de precios.
 *   - Una pieza que menciona el número NO lo escribe: declara el texto en un
 *     campo espejo con sufijo `_plantilla` (`caption_plantilla`,
 *     `title_plantilla`, …) usando los placeholders {{RESENAS}} y {{RATING}}.
 *   - `resolverPiezaResenas()` rellena el campo real desde la plantilla. Lo
 *     llaman el render y el publicador (en memoria, para que nada salga
 *     vencido) y `actualizar-resenas.mjs` (escribiendo el JSON, porque el cron
 *     de producción lee `caption` tal cual está commiteado y no sabe de
 *     plantillas — src/ no participa de este mecanismo a propósito).
 *
 * REDONDEO HONESTO: se publica "más de N" con N redondeado hacia ABAJO al
 * múltiplo de 25 (701 → "más de 700"). Con un múltiplo exacto se baja un
 * escalón (725 → "más de 700"), porque "más de 725" con exactamente 725
 * sería mentir para arriba, y el número jamás se infla.
 * El escalón de 25 no es casual: garantiza que lo publicado nunca quede a más
 * de UMBRAL_DESACTUALIZADO del dato real conocido, que es justo lo que
 * verifica `npm run check:social`.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './identidad.mjs';

export const ARCHIVO_RESENAS = path.join(RAIZ, 'social', 'resenas.json');
export const ENDPOINT_RESENAS = 'https://atelieroptica.com.ar/api/reviews';
export const SUFIJO_PLANTILLA = '_plantilla';

/**
 * Escalón del redondeo y, a la vez, tolerancia del check: una pieza que declara
 * un número a más de esto del real conocido está vencida. Si se cambia el
 * escalón hay que revisar el check — son la misma constante a propósito.
 */
export const UMBRAL_DESACTUALIZADO = 25;

/** El último dato real conocido, o null si todavía no se corrió el refresco. */
export async function leerResenasConocidas() {
    try {
        const datos = JSON.parse(await readFile(ARCHIVO_RESENAS, 'utf-8'));
        if (!Number.isInteger(datos.total) || datos.total <= 0) return null;
        if (typeof datos.rating !== 'number') return null;
        return datos;
    } catch {
        return null;
    }
}

/**
 * El número que se PUBLICA: piso al múltiplo de 25 estrictamente menor que el
 * total. "Más de 700" con 701 es verdad; "más de 725" con 725 no lo sería.
 */
export function redondearParaPublicar(total) {
    const piso = Math.floor(total / UMBRAL_DESACTUALIZADO) * UMBRAL_DESACTUALIZADO;
    return piso === total ? piso - UMBRAL_DESACTUALIZADO : piso;
}

/** "5" o 4.9 → "5,0" / "4,9" — coma, como se escribe acá. */
export function formatearRating(rating) {
    return Number(rating).toFixed(1).replace('.', ',');
}

/**
 * Reemplaza los placeholders de un texto. Falla fuerte si queda alguno sin
 * resolver: mejor no renderizar que publicar "{{RESEÑAS}}" en una placa.
 */
export function resolverTextoResenas(texto, datos) {
    const resuelto = String(texto)
        .replaceAll('{{RESENAS}}', String(redondearParaPublicar(datos.total)))
        .replaceAll('{{RATING}}', formatearRating(datos.rating));
    const sobrante = resuelto.match(/\{\{[A-ZÁÉÍÓÚÑ_]+\}\}/);
    if (sobrante) {
        throw new Error(
            `Placeholder desconocido ${sobrante[0]} en una plantilla de reseñas. ` +
            `Los que existen: {{RESENAS}} y {{RATING}}.`
        );
    }
    return resuelto;
}

/**
 * Recorre la pieza y rellena cada campo desde su espejo `_plantilla`
 * (`caption_plantilla` → `caption`). Muta la pieza en memoria.
 *
 * @returns {{ usa: boolean, cambios: string[] }} — `usa` dice si la pieza
 *   declara reseñas por plantilla; `cambios` lista los campos cuyo valor
 *   resuelto cambió respecto de lo que la pieza traía escrito.
 */
export function resolverPiezaResenas(pieza, datos) {
    const cambios = [];
    let usa = false;

    const recorrer = (nodo, rastro) => {
        if (Array.isArray(nodo)) {
            nodo.forEach((v, i) => recorrer(v, `${rastro}[${i}]`));
            return;
        }
        if (!nodo || typeof nodo !== 'object') return;
        for (const [clave, valor] of Object.entries(nodo)) {
            if (clave.endsWith(SUFIJO_PLANTILLA) && typeof valor === 'string') {
                usa = true;
                if (!datos) {
                    throw new Error(
                        `La pieza declara reseñas por plantilla pero no hay dato conocido. ` +
                        `Correr: node scripts/social/actualizar-resenas.mjs`
                    );
                }
                const campo = clave.slice(0, -SUFIJO_PLANTILLA.length);
                const resuelto = resolverTextoResenas(valor, datos);
                if (nodo[campo] !== resuelto) cambios.push(`${rastro}${rastro ? '.' : ''}${campo}`);
                nodo[campo] = resuelto;
            } else {
                recorrer(valor, `${rastro}${rastro ? '.' : ''}${clave}`);
            }
        }
    };

    recorrer(pieza, '');
    return { usa, cambios };
}
