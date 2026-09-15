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
    return m.includes('PAY_WAY') || m.includes('PAYWAY') || m.includes('NARANJA')
        || m.includes('GO_CUOTAS') || m.includes('MERCADO_PAGO');
}

/**
 * ¿El cobro es con Mercado Pago (cualquier plan)?
 * Único lugar del criterio: lo usan el formulario de pagos y la validación del
 * servidor, que TIENEN que coincidir o el cobro se rechaza al guardar.
 */
export function esMercadoPago(method: string | null | undefined) {
    return (method || '').toUpperCase().includes('MERCADO_PAGO');
}

/**
 * ¿Es un cobro presencial con Mercado Pago Point?
 *
 * Importa porque el ticket de Point NO trae lote ni cupón —trae "Operación #" y
 * el código de autorización—, así que no se le pueden exigir los mismos campos
 * que a un posnet de Pay Way o Naranja. Exigírselos era lo que obligaba a
 * inventar números: el 14/9/26 un cobro por Point tenía en "cupón" los últimos
 * cuatro dígitos del CUIT del comercio.
 */
export function esPointPresencial(method: string | null | undefined, cardMode: string | null | undefined) {
    return isCardMethod(method || '') && cardMode === 'PRESENCIAL' && esMercadoPago(method);
}

/**
 * Cuenta especial: forma de pago fuera del listado (canje, cheque, descuento a
 * un empleado). No tiene plataforma ni comprobante que la respalde, así que no
 * se le exige la foto; lo que sí se exige es escribir cuál fue.
 */
export const METODO_ESPECIAL = 'OTRO_ESPECIAL';

/**
 * ¿Es un cobro de Mercado Pago en cuotas largas (12/18)?
 *
 * ÚNICA definición del concepto: el cliente pagó lista × FACTOR_MP_CUOTAS_LARGAS
 * (10% de costo financiero) y por eso cada peso cobrado vale 1/factor de lista.
 * La usan PricingService (saldos), alertOverpayment (sobrepago) y las comisiones
 * de médicos; el espejo SQL del filtro "con saldo" replica exactamente este
 * criterio (POSITION('MERCADO_PAGO') + regex '_(12|18)(_|$)') — si tocás uno,
 * tocá el otro (src/app/api/orders/route.ts).
 */
export function esMpCuotasLargas(method: string | null | undefined): boolean {
    const m = (method || '').toUpperCase().trim();
    return m.includes('MERCADO_PAGO') && /_(12|18)(_|$)/.test(m);
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
