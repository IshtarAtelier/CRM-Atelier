/**
 * Qué es un pedido según su `orderType`. Única definición: el PDF y el mensaje
 * de WhatsApp la comparten para no volver a contradecirse (uno con saldo y sin
 * 12 cuotas, el otro al revés).
 */
export function esVentaDeOrden(order: { orderType?: string | null } | null | undefined): boolean {
    return order?.orderType === 'SALE' || order?.orderType === 'MAYORISTA';
}

/** Un presupuesto es una cotización: no habla de pagos ni de saldos. */
export function esPresupuestoDeOrden(order: { orderType?: string | null } | null | undefined): boolean {
    return !esVentaDeOrden(order);
}
