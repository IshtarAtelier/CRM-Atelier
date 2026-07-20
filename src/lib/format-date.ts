import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Formato de fecha canónico del sistema: SIEMPRE día/mes/año (dd/MM/yyyy).
 *
 * Usar esto en todo lo que ve una persona (emails, comprobantes, notificaciones,
 * texto de auditoría, etc.). No usar para claves internas / query params / nombres
 * de archivo: ahí el formato ISO (yyyy-MM-dd) es intencional y no debe tocarse.
 */

/** Formatea una fecha en dd/MM/yyyy. Acepta Date, string ISO o timestamp. */
export function formatDate(input: Date | string | number | null | undefined): string {
    if (input === null || input === undefined || input === '') return '';
    // String solo-fecha "yyyy-MM-dd": reordenar sin construir Date, para evitar
    // el corrimiento de un día por zona horaria (UTC medianoche → día anterior en UTC-3).
    if (typeof input === 'string') {
        const m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    }
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return '';
    return format(d, 'dd/MM/yyyy');
}

/** Igual que formatDate pero con hora: dd/MM/yyyy HH:mm. */
export function formatDateTime(input: Date | string | number | null | undefined): string {
    if (input === null || input === undefined || input === '') return '';
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return '';
    return format(d, 'dd/MM/yyyy HH:mm');
}

/** Fecha larga en español, siempre día primero: "26 de julio de 2017". */
export function formatDateLong(input: Date | string | number | null | undefined): string {
    if (input === null || input === undefined || input === '') return '';
    if (typeof input === 'string') {
        const m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) input = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return '';
    return format(d, "d 'de' MMMM 'de' yyyy", { locale: es });
}
