/**
 * Búsqueda de pagos del área de administración (Caja y Finanzas).
 *
 * Matchea por nombre de cliente, notas/referencia (nº de operación),
 * monto, código de orden y teléfono. Las coincidencias numéricas se
 * normalizan a dígitos para tolerar formato: "$629.000", "629.000" y
 * "629000" encuentran el mismo pago, y una referencia guardada como
 * "123-456 789" se encuentra tecleando "123456789".
 *
 * Lógica pura y sin dependencias: usable desde componentes cliente,
 * rutas de API o tests por igual.
 */

/** Campos mínimos que necesita la búsqueda; cualquier registro que los tenga es buscable. */
export interface SearchablePayment {
    clientName: string;
    clientPhone?: string | null;
    notes?: string | null;
    amount?: number | null;
    orderId?: string | null;
}

/**
 * Dígitos mínimos del término para activar las coincidencias numéricas
 * (monto, teléfono, ref normalizada); con 1 solo dígito casi todo matchea.
 *
 * Exportado porque GET /api/payments espeja esta misma semántica en SQL
 * (parámetro `q`) para buscar sobre todo el período, no solo lo paginado.
 */
export const MIN_DIGITS_FOR_NUMERIC_MATCH = 2;

export const digitsOnly = (value: string) => value.replace(/\D/g, '');

function matches(payment: SearchablePayment, query: string, queryDigits: string): boolean {
    if (payment.clientName.toLowerCase().includes(query)) return true;

    const notes = (payment.notes ?? '').toLowerCase();
    if (notes.includes(query)) return true;

    // Código corto de orden, tal como se muestra en la tabla (#XXXXXX)
    if (payment.orderId && payment.orderId.slice(-6).toLowerCase().includes(query)) return true;

    if (queryDigits.length >= MIN_DIGITS_FOR_NUMERIC_MATCH) {
        if (digitsOnly(notes).includes(queryDigits)) return true;
        if (String(Math.trunc(payment.amount ?? 0)).includes(queryDigits)) return true;
        if (payment.clientPhone && digitsOnly(payment.clientPhone).includes(queryDigits)) return true;
    }

    return false;
}

/** Devuelve true si el pago coincide con el término de búsqueda (término vacío = coincide todo). */
export function paymentMatchesQuery(payment: SearchablePayment, rawQuery: string): boolean {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return true;
    return matches(payment, query, digitsOnly(query));
}

/** Filtra una lista de pagos normalizando el término una sola vez. */
export function filterPayments<T extends SearchablePayment>(payments: T[], rawQuery: string): T[] {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return payments;
    const queryDigits = digitsOnly(query);
    return payments.filter(p => matches(p, query, queryDigits));
}
