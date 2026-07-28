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

/**
 * Valida la fecha que se le pone a un pago. Devuelve `null` si es inverosímil,
 * para que el llamador use el default (el momento en que se carga el pago).
 *
 * Los comprobantes de Payway/Naranja imprimen la fecha como dd/mm/aa y el OCR la
 * devolvía con el día y el año dados vuelta: un ticket del 22/07/26 se guardaba
 * como "2022-07-26". El monto quedaba bien imputado, pero el pago desaparecía de
 * todo reporte por rango de fechas (caja, cierre de mes, conciliación). Acá no se
 * adivina la fecha correcta: se descarta la basura y se avisa.
 */
export function isPlausiblePaymentDate(input: Date | string | number, hoy = new Date()): boolean {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return false;
    // Un pago no puede ser de más de un año atrás ni del futuro (más allá del
    // margen de zona horaria de un día).
    const piso = new Date(hoy.getTime() - 366 * 24 * 60 * 60 * 1000);
    const techo = new Date(hoy.getTime() + 24 * 60 * 60 * 1000);
    return d >= piso && d <= techo;
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
