/**
 * Gift cards (tarjetas de regalo): estados, límites y cómo se ven en
 * /admin/gift-cards. Es la ÚNICA lista — el service, la API y la pantalla
 * leen de acá.
 *
 * Quién puede qué (lo hace cumplir `gift-card.service.ts`):
 *  - Emitir y marcar como USADA: cualquiera del equipo. La emite quien cobró.
 *  - Volver a ACTIVA o ANULAR: solo un ADMIN. Una tarjeta usada que vuelve a
 *    estar activa es plata, y una anulada no se puede canjear.
 *
 * "Vencida" no es un estado guardado: es una ACTIVA cuya `validaHasta` ya pasó.
 * Se calcula al mostrarla, así no hace falta un cron que la cambie.
 */

export const ESTADOS_GIFT_CARD = ['ACTIVA', 'USADA', 'ANULADA'] as const;
export type EstadoGiftCard = (typeof ESTADOS_GIFT_CARD)[number];

/** Lo que se muestra: los estados guardados más VENCIDA (calculada). */
export type EstadoVisibleGiftCard = EstadoGiftCard | 'VENCIDA';

/** Los cambios de estado que solo puede hacer un ADMIN. */
export const ESTADOS_SOLO_ADMIN: readonly EstadoGiftCard[] = ['ACTIVA', 'ANULADA'];

/**
 * Vigencia que se propone al emitir, en meses. Es solo el valor inicial del
 * formulario: el equipo lo cambia en cada tarjeta. Valor elegido al armar el
 * módulo (9/10/2026), a confirmar por Ishtar.
 */
export const VIGENCIA_SUGERIDA_MESES = 6;

/** Prefijo del código: AO-AAMM-NNNN. */
export const PREFIJO_CODIGO_GIFT_CARD = 'AO';

/** Tope de monto por tarjeta, para frenar un cero de más tipeado. */
export const MONTO_MAXIMO_GIFT_CARD = 5_000_000;

export const ESTADO_GIFT_CARD_INFO: Record<EstadoVisibleGiftCard, { etiqueta: string; clase: string }> = {
    ACTIVA: { etiqueta: 'Activa', clase: 'border-amber-400 text-amber-800 dark:text-amber-200 dark:border-amber-600' },
    USADA: { etiqueta: 'Usada', clase: 'border-stone-300 text-stone-600 dark:text-stone-300 dark:border-stone-600' },
    ANULADA: { etiqueta: 'Anulada', clase: 'border-stone-300 text-stone-500 line-through dark:text-stone-400 dark:border-stone-600' },
    VENCIDA: { etiqueta: 'Vencida', clase: 'border-red-300 text-red-700 dark:text-red-300 dark:border-red-700' },
};

/** "2026-10-09" de hoy en Córdoba, para comparar con `validaHasta`. */
export function hoyCordoba(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Cordoba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** "2026-10-09" (día de Córdoba) de una fecha guardada a medianoche de Córdoba. */
export function diaCordoba(fecha: Date | string): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Cordoba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(fecha));
}

export function estadoVisible(card: { estado: string; validaHasta: Date | string | null }): EstadoVisibleGiftCard {
    if (card.estado === 'ACTIVA' && card.validaHasta && diaCordoba(card.validaHasta) < hoyCordoba()) return 'VENCIDA';
    return card.estado as EstadoGiftCard;
}
