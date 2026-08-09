/**
 * Cómo se MUESTRA el origen de un contacto: el canal (`Client.contactSource`)
 * y el apodo del anuncio de Meta que lo trajo (`Client.adTag`).
 *
 * POR QUÉ existe: el canal ya se veía en la ficha con un mapeo propio
 * ("WEB_STOREFRONT" → "Tienda Online") que no coincidía con el vocabulario
 * único de `contact-source.ts`, y el `adTag` —el dato que hace posible el ROAS
 * por anuncio del cron de ads— no se veía en NINGUNA pantalla. Acá se arma una
 * sola vez el texto y el tono de cada uno, y la ficha y la lista leen de acá.
 *
 * El texto del canal NO se decide en este archivo: sale de
 * `displayContactSource()`. Esto es solo presentación (qué mostrar y con qué
 * color); agregar o renombrar un canal sigue siendo tocar `contact-source.ts`.
 */

import { displayContactSource, SIN_ORIGEN } from '@/lib/contact-source';

/**
 * Tono del chip por canal canónico. Texto `-800` sobre fondo `-50` (y `-200`
 * sobre `-900/20` en oscuro): el patrón `-600 sobre -50` que usa el resto de la
 * app da ~3,4:1 y no llega al piso de 4,5:1 con letra de 10px. Cada
 * combinación de acá está medida por encima de 6,8:1.
 */
const TONO_POR_CANAL: Record<string, string> = {
    'Google Ads': 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-200 dark:border-orange-800/40',
    'Google Maps': 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-900/20 dark:text-teal-200 dark:border-teal-800/40',
    'Google orgánico': 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:border-sky-800/40',
    'Meta': 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-200 dark:border-indigo-800/40',
    'Calle': 'bg-stone-100 text-stone-800 border-stone-300 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-600',
    'Ya es Cliente': 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800/40',
    'Tienda online': 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-200 dark:border-violet-800/40',
    'Referido': 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-800/40',
    'Otros': 'bg-stone-100 text-stone-800 border-stone-300 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-600',
};

/** Canal histórico que ya no está en el vocabulario: se muestra tal cual, en neutro. */
const TONO_DESCONOCIDO = TONO_POR_CANAL['Otros'];

/**
 * Ficha sin canal cargado. Advertencia sutil: borde punteado + ámbar oscuro.
 * No es un error (media base vieja no lo tiene), es una invitación a completarlo.
 */
export const TONO_SIN_ORIGEN =
    'bg-amber-50 text-amber-900 border-amber-400 border-dashed dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-600';

/**
 * El anuncio que trajo al cliente. Va en el tono fuerte de la app (fondo
 * invertido, el mismo de la solapa activa) porque es el dato que se quiere ver
 * de lejos: es lo que conecta esta ficha con el gasto de pauta.
 */
export const TONO_ANUNCIO =
    'bg-stone-900 text-white border-stone-900 dark:bg-primary dark:text-primary-foreground dark:border-primary';

export interface ContactOrigin {
    /** Canal listo para mostrar. Si no hay nada cargado: `SIN_ORIGEN`. */
    canal: string;
    /** false cuando la ficha no tiene canal cargado. */
    tieneCanal: boolean;
    /** Apodo del anuncio de Meta (ej. "ishvarilux"), o null. */
    anuncio: string | null;
    /** Ni canal ni anuncio: la ficha no dice de dónde vino este contacto. */
    sinOrigen: boolean;
    /** Clases del chip del canal (incluye el caso "Sin origen"). */
    tonoCanal: string;
}

/** Fuente mínima de datos: sirve tanto para el `Contact` de la lista como para la ficha. */
interface ConOrigen {
    contactSource?: string | null;
    adTag?: string | null;
}

/**
 * Arma canal + anuncio + tono a partir de un contacto. Es puro y barato
 * (sin fetch ni fecha): se puede llamar una vez por fila de la lista.
 */
export function getContactOrigin(contact: ConOrigen | null | undefined): ContactOrigin {
    const canal = displayContactSource(contact?.contactSource);
    const tieneCanal = canal !== SIN_ORIGEN;
    const anuncio = contact?.adTag?.trim() || null;

    return {
        canal,
        tieneCanal,
        anuncio,
        sinOrigen: !tieneCanal && !anuncio,
        tonoCanal: tieneCanal
            ? (TONO_POR_CANAL[canal] ?? TONO_DESCONOCIDO)
            : TONO_SIN_ORIGEN,
    };
}
