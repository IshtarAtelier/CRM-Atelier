/**
 * Datos del voucher de una cobranza con tarjeta.
 *
 * Un mismo método (Pay Way, Naranja, Go Cuotas) genera DOS comprobantes muy
 * distintos según cómo se haya cobrado:
 *  - **Presencial (posnet):** ticket impreso con Nro. de lote, Nro. de cupón y
 *    Nro. de autorización. No trae número de operación.
 *  - **Link de pago:** comprobante digital con un número de operación / ID de
 *    pago, sin lote ni cupón.
 *
 * Por eso el vendedor elige el modo al cargar el pago y se guardan los números
 * que correspondan: son los que después permiten cruzar cada cobro contra la
 * liquidación de Pay Way.
 */

export type CardMode = 'PRESENCIAL' | 'LINK';

/** Los tres números del cupón, tal como salen de la DB o del formulario. */
export interface VoucherNumbers {
    batchNumber?: string | null;
    couponNumber?: string | null;
    authNumber?: string | null;
}

export interface CardVoucherDetails extends VoucherNumbers {
    cardMode?: CardMode | null;
}

/** Métodos que se cobran con tarjeta y por lo tanto tienen voucher. */
export function isCardMethod(method: string) {
    const m = (method || '').toUpperCase();
    return m.includes('PAY_WAY') || m.includes('PAYWAY') || m.includes('NARANJA') || m.includes('GO_CUOTAS');
}

/**
 * Forma comparable de un número del voucher: solo letras y dígitos, sin los ceros
 * a la izquierda. El ticket imprime "011" y la persona escribe "11" — es el mismo
 * lote y no puede generar dos claves distintas.
 */
export function normalizeVoucherNumber(value?: string | null) {
    return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');
}

/**
 * Clave única de un cobro presencial: lote + cupón + autorización. Ninguno de los
 * tres alcanza solo (un mismo nº de lote se repite todos los días), pero los tres
 * juntos identifican al cupón sin ambigüedad.
 */
export function cardVoucherKey(details: VoucherNumbers | null | undefined): string | null {
    if (!details) return null;
    const lote = normalizeVoucherNumber(details.batchNumber);
    const cupon = normalizeVoucherNumber(details.couponNumber);
    const aut = normalizeVoucherNumber(details.authNumber);
    // Con menos de dos datos no hay clave: sería un falso positivo esperando.
    if ([lote, cupon, aut].filter(Boolean).length < 2) return null;
    return `POS-${lote || 'S'}-${cupon || 'S'}-${aut || 'S'}`;
}

/** Texto corto para mostrar en la ficha y en los emails. */
export function describeCardVoucher(details: VoucherNumbers | null | undefined): string {
    if (!details) return '';
    const partes: string[] = [];
    if (details.batchNumber) partes.push(`Lote ${details.batchNumber}`);
    if (details.couponNumber) partes.push(`Cupón ${details.couponNumber}`);
    if (details.authNumber) partes.push(`Aut. ${details.authNumber}`);
    return partes.join(' · ');
}
