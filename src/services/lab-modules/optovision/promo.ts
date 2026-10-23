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
 * "Mi Primer Varilux / Kodak" lleva LA MISMA modalidad (recordatorio de
 * Optovisión del 20/10/2026): cupón, mail (con el único nº de trabajo en el
 * asunto) y la observación del par. Lo que no tiene es 2º par.
 *
 * Acá vive lo PURO de eso (textos, destinatarios, qué pasos faltan). Nada de
 * red, base ni portal: lo fija `npm run check:carga-optovision`. El módulo de
 * carga arma el plan con esto y, si un paso no se puede hacer solo (el cupón
 * lo genera una web externa), FRENA y lo dice en la ficha.
 */

import { CASILLA_DEL_LOCAL } from '../../../lib/constants';

export type MarcaDePromo = 'VARILUX' | 'KODAK';
export type TipoDePromo = 'DOBLE' | 'MI_PRIMER';

/** Dónde se genera el cupón de cada promo. */
export const WEB_DE_PROMO: Record<MarcaDePromo, string> = {
    VARILUX: 'https://www.variluxdobledisfrute.com.ar/',
    KODAK: 'https://promos.lenteskodak.com.ar/',
};

/**
 * A quién va el mail de la promo (instructivo de Optovisión, 20/10/2026):
 * PARA promociones@, CON COPIA a cordoba@. Y copia a la casilla del local
 * (Ishtar, 20/10/2026: "que llegue en copia al Atelier así nos quedamos
 * tranquilos que salió"): es un aviso operativo, sin costos.
 */
export const MAIL_PROMO_PARA = 'promociones@optovisionsa.com.ar';
export const MAIL_PROMO_COPIA = ['cordoba@optovisionsa.com.ar', CASILLA_DEL_LOCAL] as const;
/** Todos los que reciben el mail (para los textos y la ficha). */
export const DESTINATARIOS_PROMO = [MAIL_PROMO_PARA, ...MAIL_PROMO_COPIA] as const;

/** Cada promo tiene su `provider` en la web de promo (docs/promos-optovision-web.md). */
export function providerDePromo(marca: MarcaDePromo | null | undefined, tipo: TipoDePromo | null | undefined): 'varilux' | 'mi-primer-varilux' | 'kodak' | 'kodak-progresivos' | null {
    if (marca === 'VARILUX') return tipo === 'MI_PRIMER' ? 'mi-primer-varilux' : 'varilux';
    if (marca === 'KODAK') return tipo === 'MI_PRIMER' ? 'kodak-progresivos' : 'kodak';
    return null;
}

/** Nombre de la promo como la escribe Optovisión, para mails y observaciones. Puro. */
export function nombreDePromo(marca: MarcaDePromo | null | undefined, tipo: TipoDePromo | null | undefined): string {
    const m = marca === 'KODAK' ? 'Kodak' : 'Varilux';
    if (tipo === 'MI_PRIMER') return `Mi Primer ${m}`;
    return marca === 'KODAK' ? '2x1 Kodak' : 'Doble Disfrute Varilux';
}

/** La marca de promo que nombra un texto ("Mi primer Varilux", "Kodak Precise"); null si ninguna. */
export function marcaDePromo(texto: string | null | undefined): MarcaDePromo | null {
    const t = String(texto || '');
    if (/varilux/i.test(t)) return 'VARILUX';
    if (/kodak/i.test(t)) return 'KODAK';
    return null;
}

const soloDigitos = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '');

/** Un cupón de la web de la promo: 6 a 10 letras o números (VA7AGQWN, KOEUXPQC). */
export const PATRON_CUPON = /^[A-Za-z0-9]{6,10}$/;
export const PATRON_CUPON_HTML = '^[A-Za-z0-9]{6,10}$';

/** Un cupón es lo que muestra la web de la promo: solo dígitos y letras, sin espacios. Vacío = no hay. */
export function cuponLimpio(cupon: string | null | undefined): string {
    return String(cupon ?? '').trim().replace(/\s+/g, '');
}

/** Observación del 1º par (el que se cobra). Exige cupón: sin él no hay texto. */
export function observacionPrimerPar(cupon: string | null | undefined): string | null {
    const c = cuponLimpio(cupon);
    return c ? `Primer par de Promo num cupón ${c}` : null;
}

/**
 * Cuando el cupón lo genera el ROBOT al aprobar (web de la promo), la
 * observación que se muestra en la revisión lleva esta marca en vez del
 * cupón; al confirmar se reemplaza por el real (`conCuponReal`). La marca no
 * puede confundirse con un cupón: lleva espacios y paréntesis.
 */
export const MARCA_CUPON_PENDIENTE = '(lo genera el robot al aprobar)';
export function observacionPrimerParPendiente(): string {
    return `Primer par de Promo num cupón ${MARCA_CUPON_PENDIENTE}`;
}
/** El texto aprobado con la marca, ya con el cupón real. Si no tiene la marca, vuelve igual. Puro. */
export function conCuponReal(texto: string, cupon: string): string {
    const c = cuponLimpio(cupon);
    return c ? texto.split(MARCA_CUPON_PENDIENTE).join(c) : texto;
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
    if (!v || !a) return null;
    // Mi Primer (un solo par): el asunto lleva un solo nº de trabajo.
    return b ? `${v} ${a}-${b}` : `${v} ${a}`;
}

export type PasoDePromo = 'CUPON' | 'OBSERVACION_PRIMER_PAR' | 'OBSERVACION_SEGUNDO_PAR' | 'MAIL';

export const ETIQUETA_DE_PASO: Record<PasoDePromo, string> = {
    CUPON: 'Generar el cupón en la web de la promo',
    OBSERVACION_PRIMER_PAR: 'Cargar el 1º par con el cupón en la observación',
    OBSERVACION_SEGUNDO_PAR: 'Cargar el 2º par con el nº del 1º en la observación',
    MAIL: 'Mandar el mail a promociones@ (copia a cordoba@ y al local)',
};

export interface EstadoDePromo {
    /** Doble (dos pares) o Mi Primer (un solo par: cupón, observación del 1º y el mail con un solo nº). */
    tipo?: TipoDePromo;
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
    if (e.tipo !== 'MI_PRIMER' && !soloDigitos(e.numeroSegundoPar)) faltan.push('OBSERVACION_SEGUNDO_PAR');
    if (!e.mailEnviado) faltan.push('MAIL');
    return faltan;
}
