/**
 * Sistema visual de POST-VENTA (Ishtar, 21/10/2026: "mejorá y modernizá el área
 * de post venta: botones, letra, color, todo").
 *
 * Una sola paleta de clases para las tres pantallas del área —el tablero de
 * Ventas (PostSaleCard), la tarjeta/formulario del caso (PostSaleServiceForm) y
 * la solapa de la ficha del cliente (PostSaleTab)— que hasta acá tenían cada una
 * su propia mezcla de letras de 7 a 10 px en mayúsculas, chips de tres tamaños,
 * botones con degradé y emojis. Reglas:
 *
 *  · Letra: nada por debajo de 11 px (hay una compañera con baja visión; piso
 *    de contraste 4,5:1). Las etiquetas van en 11-12 px semibold, el cuerpo en
 *    13 px, los títulos en 14-15 px. Mayúsculas solo en los "eyebrows" de sección.
 *  · Color: neutros stone + UN acento (ámbar) para la acción de post-venta, y
 *    semánticos fijos: esmeralda = resuelto/sin cargo, violeta = cliente,
 *    cielo = laboratorio, rosa = error/atención. Sin degradés ni hover:scale.
 *  · Botones: tres jerarquías (primario, secundario, fantasma) y una variante
 *    de acento para "mandar al laboratorio". Todos con foco visible.
 *
 * Importar `PV` y componer: `className={PV.btn.primary}`. No copiar clases
 * sueltas de acá a otro archivo: si hace falta otra variante, se agrega acá.
 */

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-stone-900';
const BTN_BASE = `inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`;

export const PV = {
    /** Título de sección en mayúsculas chicas ("Qué pasó", "Responsabilidad"). */
    eyebrow: 'text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500 dark:text-stone-400',
    /** Etiqueta de un campo. */
    label: 'block text-[12px] font-medium text-stone-600 dark:text-stone-300 mb-1.5',
    /** Texto corriente. */
    body: 'text-[13px] text-stone-800 dark:text-stone-200 leading-relaxed',
    /** Texto secundario. */
    muted: 'text-[12px] text-stone-500 dark:text-stone-400 leading-relaxed',
    /** Ayuda debajo de un campo. */
    help: 'mt-1.5 text-[12px] text-stone-500 dark:text-stone-400 leading-relaxed',
    /** Título de tarjeta (nombre del cliente, "Nuevo caso"). */
    title: 'text-[14px] font-semibold text-stone-900 dark:text-stone-50 tracking-tight',
    /** Números de plata. */
    money: 'font-semibold tabular-nums text-stone-900 dark:text-stone-50',

    /** Campo de formulario (input, select, textarea). */
    field: `w-full text-[13px] px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 ${FOCUS} focus:border-amber-500 transition-colors`,
    /** Campo chico (dentro de tarjetas del tablero). Sin ancho: lo pone quien lo usa (flex-1, w-28…). */
    fieldSm: `text-[12px] px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 ${FOCUS} focus:border-amber-500 transition-colors`,

    /** Chip: estado, tipo, importe. Combinar con una paleta de abajo. */
    chip: 'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5 whitespace-nowrap',
    chipSm: 'inline-flex items-center gap-1 rounded-full border px-2 py-0 text-[11px] font-semibold leading-5 whitespace-nowrap',
    tone: {
        neutral: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-700',
        outline: 'bg-transparent text-stone-700 border-stone-300 dark:text-stone-300 dark:border-stone-600',
        amber: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60',
        emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
        sky: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/60',
        violet: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/60',
        rose: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60',
    },

    btn: {
        /** La acción principal de la pantalla (una por bloque). */
        primary: `${BTN_BASE} h-9 px-4 text-[12px] bg-stone-900 text-white hover:bg-stone-800 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200`,
        /** Acción secundaria con borde. */
        secondary: `${BTN_BASE} h-9 px-3.5 text-[12px] bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 hover:border-stone-400 dark:bg-stone-900 dark:text-stone-100 dark:border-stone-700 dark:hover:bg-stone-800`,
        /** Mandar al laboratorio / reprocesar: el acento ámbar. */
        accent: `${BTN_BASE} h-9 px-4 text-[12px] bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-stone-950 dark:hover:bg-amber-400`,
        /** Cobro al cliente. */
        violet: `${BTN_BASE} h-9 px-4 text-[12px] bg-violet-700 text-white hover:bg-violet-800 dark:bg-violet-500 dark:text-white dark:hover:bg-violet-400`,
        /** Sin fondo: acciones de menor peso. */
        ghost: `${BTN_BASE} h-8 px-2.5 text-[12px] text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-50`,
        /** Solo ícono (32 px). */
        icon: `${BTN_BASE} h-8 w-8 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-50`,
        /** Destructivo o de deshacer, en texto. */
        danger: `${BTN_BASE} h-8 px-2.5 text-[12px] text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40`,
        /** Variante chica de cualquiera de arriba (tablero). */
        sm: 'h-8 px-3 text-[12px]',
        /** Botón-pastilla de filtro (activo / inactivo). */
        pillOn: `${BTN_BASE} h-8 px-3 rounded-full text-[12px] bg-stone-900 text-white dark:bg-white dark:text-stone-900`,
        pillOff: `${BTN_BASE} h-8 px-3 rounded-full text-[12px] bg-white text-stone-600 border border-stone-200 hover:border-stone-400 hover:text-stone-900 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700 dark:hover:border-stone-500`,
    },

    /** Tarjeta principal (caso, tarjeta del tablero). */
    card: 'rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm',
    /** Bloque interno gris suave. */
    panel: 'rounded-xl border border-stone-200/80 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50',
    /** Bloque de atención (ámbar). */
    panelAmber: 'rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30',
    /** Bloque de error (rosa). */
    panelRose: 'rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30',
    /** Bloque de cobro al cliente (violeta). */
    panelViolet: 'rounded-xl border border-violet-200 dark:border-violet-900/60 bg-violet-50/60 dark:bg-violet-950/30',
    /** Línea de separación. */
    divider: 'border-t border-stone-200 dark:border-stone-800',
} as const;

/** Chip de tipo de caso: color por tipo, tamaño único. */
export const CASE_TYPE_TONE: Record<string, string> = {
    'Cambio de receta': PV.tone.amber,
    'Error de medición y centrado': PV.tone.rose,
    'Garantía': PV.tone.rose,
    'Falla de laboratorio': PV.tone.sky,
    'Error de armado / montaje': PV.tone.violet,
    'Rayado / tratamiento': PV.tone.sky,
    'Error administrativo / carga': PV.tone.neutral,
    'Reclamo / insatisfacción': PV.tone.rose,
    'Otro': PV.tone.neutral,
};

export function caseTypeTone(type?: string | null): string {
    return (type && CASE_TYPE_TONE[type]) || PV.tone.neutral;
}
