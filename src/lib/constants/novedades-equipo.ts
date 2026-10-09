/**
 * Novedades del equipo: tipos, estados y cómo se ven en el calendario
 * compartido (/admin/equipo/calendario). Es la ÚNICA lista — el service, la
 * API y la pantalla leen de acá.
 *
 * Los colores son clases de Tailwind sobre los tokens del CRM. No se comunica
 * nada SOLO con color: cada evento lleva siempre la etiqueta escrita.
 */

export const TIPOS_NOVEDAD = [
    'FALTA',
    'LLEGADA_TARDE',
    'FRANCO',
    'FRANCO_COMPENSATORIO',
    'HORAS_EXTRA',
    'VACACIONES',
    'CAMBIO_TURNO',
    'PEDIDO_ESPECIAL',
    'OTRO',
] as const;
export type TipoNovedad = (typeof TIPOS_NOVEDAD)[number];

export const ESTADOS_NOVEDAD = ['REGISTRADO', 'PENDIENTE', 'APROBADO', 'RECHAZADO'] as const;
export type EstadoNovedad = (typeof ESTADOS_NOVEDAD)[number];

/** Los tipos que son un PEDIDO (esperan un OK del admin) y no un hecho. */
export const TIPOS_QUE_SE_PIDEN: readonly TipoNovedad[] = ['FRANCO', 'FRANCO_COMPENSATORIO', 'HORAS_EXTRA', 'VACACIONES', 'CAMBIO_TURNO', 'PEDIDO_ESPECIAL'];

/** El franco compensatorio DESCUENTA de los feriados trabajados (saldo adeudado). */
export const TIPO_QUE_DESCUENTA_FERIADO: TipoNovedad = 'FRANCO_COMPENSATORIO';

/** Los tipos que solo un ADMIN puede anotar (son observaciones sobre el vendedor). */
export const TIPOS_SOLO_ADMIN: readonly TipoNovedad[] = ['FALTA', 'LLEGADA_TARDE'];

/** Las horas extra SUMAN al saldo a favor, igual que un feriado cubierto. Las carga el vendedor y las aprueba un admin. */
export const TIPO_QUE_SUMA_HORAS: TipoNovedad = 'HORAS_EXTRA';

/** Tipos que llevan rango horario obligatorio (HH:MM-HH:MM) porque se cuentan en horas. */
export const TIPOS_CON_HORAS: readonly TipoNovedad[] = ['FRANCO_COMPENSATORIO', 'HORAS_EXTRA'];

export const NOVEDAD_INFO: Record<TipoNovedad, { etiqueta: string; corta: string; clase: string; punto: string }> = {
    FALTA:           { etiqueta: 'Falta',            corta: 'Falta',    clase: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/60 dark:text-red-100 dark:border-red-800',             punto: 'bg-red-600' },
    LLEGADA_TARDE:   { etiqueta: 'Llegada tarde',    corta: 'Tarde',    clase: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/60 dark:text-orange-100 dark:border-orange-800', punto: 'bg-orange-500' },
    FRANCO_COMPENSATORIO: { etiqueta: 'Franco compensatorio', corta: 'Compens.', clase: 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/60 dark:text-teal-100 dark:border-teal-800', punto: 'bg-teal-600' },
    HORAS_EXTRA:     { etiqueta: 'Horas extra',      corta: 'Extra',    clase: 'bg-lime-100 text-lime-900 border-lime-300 dark:bg-lime-950/60 dark:text-lime-100 dark:border-lime-800',           punto: 'bg-lime-600' },
    FRANCO:          { etiqueta: 'Franco',           corta: 'Franco',   clase: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/60 dark:text-sky-100 dark:border-sky-800',             punto: 'bg-sky-600' },
    VACACIONES:      { etiqueta: 'Vacaciones',       corta: 'Vacac.',   clase: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-100 dark:border-emerald-800', punto: 'bg-emerald-600' },
    CAMBIO_TURNO:    { etiqueta: 'Cambio de turno',  corta: 'Cambio',   clase: 'bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950/60 dark:text-violet-100 dark:border-violet-800', punto: 'bg-violet-600' },
    PEDIDO_ESPECIAL: { etiqueta: 'Pedido especial',  corta: 'Pedido',   clase: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-100 dark:border-amber-800',   punto: 'bg-amber-500' },
    OTRO:            { etiqueta: 'Otro',             corta: 'Otro',     clase: 'bg-stone-100 text-stone-900 border-stone-300 dark:bg-stone-800 dark:text-stone-100 dark:border-stone-600',       punto: 'bg-stone-500' },
};

export const ESTADO_INFO: Record<EstadoNovedad, { etiqueta: string; clase: string }> = {
    REGISTRADO: { etiqueta: 'Registrado', clase: 'text-stone-600 dark:text-stone-300' },
    PENDIENTE:  { etiqueta: 'Pendiente de OK', clase: 'text-amber-700 dark:text-amber-300 font-bold' },
    APROBADO:   { etiqueta: 'Aprobado', clase: 'text-emerald-700 dark:text-emerald-300 font-bold' },
    RECHAZADO:  { etiqueta: 'Rechazado', clase: 'text-red-700 dark:text-red-300 line-through' },
};

/** "09:00-13:00" → 4 horas. null si no es un rango válido. La usan el service y la pantalla. */
export function horasDeRango(texto: string | null | undefined): number | null {
    const m = (texto || '').replace(/\s+/g, '').match(/^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/);
    if (!m) return null;
    const min = (Number(m[3]) * 60 + Number(m[4])) - (Number(m[1]) * 60 + Number(m[2]));
    return min > 0 ? Math.round(min / 6) / 10 : null;
}
