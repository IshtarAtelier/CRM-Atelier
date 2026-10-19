/**
 * LAS PROMOS DE OPTOVISIÓN (Doble Disfrute Varilux / 2x1 Kodak / Mi Primer
 * Varilux / Mi Primer Kodak): el procedimiento oficial que pasó Noelia Vivas
 * (Optovisión Essilor) por WhatsApp el 23/9/2026. Son CUATRO pasos y si falta
 * uno el laboratorio cobra los dos pares:
 *
 *   1. Generar el CUPÓN en la web de la promo.
 *   2. Mandar un mail a promociones@ y cordoba@ con asunto
 *      "<código del vendedor> <nº trabajo 1>-<nº trabajo 2>".
 *   3. Cargar el 1º par en OVES con la observación "Primer par de Promo num
 *      cupón XXXXXX"; OVES devuelve el nº del pedido.
 *   4. Cargar el 2º par con "Segundo par promo compañero/asociado al num <nº
 *      del 1º par>".
 *
 * Acá vive lo PURO de eso (textos, destinatarios, qué pasos faltan). Nada de
 * red, base ni portal: lo fija `npm run check:carga-optovision`. El módulo de
 * carga arma el plan con esto y, si un paso no se puede hacer solo (el cupón
 * lo genera una web externa), FRENA y lo dice en la ficha.
 */

export type MarcaDePromo = 'VARILUX' | 'KODAK';

/** Dónde se genera el cupón de cada promo. */
export const WEB_DE_PROMO: Record<MarcaDePromo, string> = {
    VARILUX: 'https://www.variluxdobledisfrute.com.ar/',
    KODAK: 'https://promos.lenteskodak.com.ar/',
};

/** A quién se le avisa la promo por mail (los dos, siempre). */
export const DESTINATARIOS_PROMO = ['promociones@optovisionsa.com.ar', 'cordoba@optovisionsa.com.ar'] as const;

/** La marca de promo que nombra un texto ("Mi primer Varilux", "Kodak Precise"); null si ninguna. */
export function marcaDePromo(texto: string | null | undefined): MarcaDePromo | null {
    const t = String(texto || '');
    if (/varilux/i.test(t)) return 'VARILUX';
    if (/kodak/i.test(t)) return 'KODAK';
    return null;
}

const soloDigitos = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '');

/** Un cupón es lo que muestra la web de la promo: solo dígitos y letras, sin espacios. Vacío = no hay. */
export function cuponLimpio(cupon: string | null | undefined): string {
    return String(cupon ?? '').trim().replace(/\s+/g, '');
}

/** Observación del 1º par (el que se cobra). Exige cupón: sin él no hay texto. */
export function observacionPrimerPar(cupon: string | null | undefined): string | null {
    const c = cuponLimpio(cupon);
    return c ? `Primer par de Promo num cupón ${c}` : null;
}

/** Observación del 2º par: lleva el nº de pedido que OVES le dio al 1º. Sin ese nº no hay texto. */
export function observacionSegundoPar(numeroPrimerPar: string | null | undefined): string | null {
    const n = soloDigitos(numeroPrimerPar);
    return n ? `Segundo par promo compañero/asociado al num ${n}` : null;
}

/** Asunto del mail: "<código del vendedor> <nº 1>-<nº 2>" (ej. "VERO02 613534-613524"). Null si falta algo. */
export function asuntoDelMail(codigoVendedor: string | null | undefined, numeroPrimerPar: string | null | undefined, numeroSegundoPar: string | null | undefined): string | null {
    const v = String(codigoVendedor ?? '').trim();
    const a = soloDigitos(numeroPrimerPar);
    const b = soloDigitos(numeroSegundoPar);
    return v && a && b ? `${v} ${a}-${b}` : null;
}

export type PasoDePromo = 'CUPON' | 'OBSERVACION_PRIMER_PAR' | 'OBSERVACION_SEGUNDO_PAR' | 'MAIL';

export const ETIQUETA_DE_PASO: Record<PasoDePromo, string> = {
    CUPON: 'Generar el cupón en la web de la promo',
    OBSERVACION_PRIMER_PAR: 'Cargar el 1º par con el cupón en la observación',
    OBSERVACION_SEGUNDO_PAR: 'Cargar el 2º par con el nº del 1º en la observación',
    MAIL: 'Mandar el mail a promociones@ y cordoba@',
};

export interface EstadoDePromo {
    cupon?: string | null;
    numeroPrimerPar?: string | null;
    numeroSegundoPar?: string | null;
    codigoVendedor?: string | null;
    /** El mail ya salió (lo marca quien lo manda). */
    mailEnviado?: boolean;
}

/**
 * Qué pasos de la promo siguen sin hacerse, en el orden en que se hacen. Con
 * la lista vacía la promo está completa. Es lo que la ficha muestra y lo que
 * frena la aprobación: "si falta un paso, cobran los dos pares".
 */
export function pasosPendientes(e: EstadoDePromo): PasoDePromo[] {
    const faltan: PasoDePromo[] = [];
    if (!cuponLimpio(e.cupon)) faltan.push('CUPON');
    if (!soloDigitos(e.numeroPrimerPar)) faltan.push('OBSERVACION_PRIMER_PAR');
    if (!soloDigitos(e.numeroSegundoPar)) faltan.push('OBSERVACION_SEGUNDO_PAR');
    if (!e.mailEnviado) faltan.push('MAIL');
    return faltan;
}
