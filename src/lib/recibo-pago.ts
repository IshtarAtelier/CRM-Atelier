// ────────────────────────────────────────────────────────────────────────────
// El recibo de pago que se le manda al cliente: cómo se nombra la forma de pago
// y qué dice el mensaje. UNA sola fuente.
//
// Lo usan el envío automático al registrar un pago (contact.service) y el
// reenvío a mano desde la ficha (api/payments/[id]/resend-receipt). Antes la
// cadena de etiquetas y el texto vivían adentro del flujo automático, así que
// un reenvío no podía decir exactamente lo mismo sin copiarlo — y dos copias de
// un texto que ve el cliente divergen siempre.
// ────────────────────────────────────────────────────────────────────────────

import { formatearPrecio } from '@/lib/format-precio';

/** "TRANSFERENCIA_ISHTAR" → "mediante transferencia bancaria". */
export function etiquetaMetodoDePago(method: string): string {
    const m = method || '';
    if (m === 'EFECTIVO' || m === 'CASH') return 'en efectivo';
    if (m.includes('TRANSFERENCIA')) return 'mediante transferencia bancaria';
    if (m.includes('NARANJA_Z') || m === 'PLAN_Z') return 'mediante Tarjeta Naranja (Plan Z)';
    if (m.includes('PAY_WAY_3') || m === 'CREDIT_3') return 'mediante Tarjeta de Crédito (3 Cuotas)';
    if (m.includes('PAY_WAY_6') || m === 'CREDIT_6') return 'mediante Tarjeta de Crédito (6 Cuotas)';
    if (m.includes('PAY_WAY')) return 'mediante Tarjeta de Crédito';
    if (m.includes('MERCADO_PAGO_3')) return 'mediante Mercado Pago (3 Cuotas sin interés)';
    if (m.includes('MERCADO_PAGO_6')) return 'mediante Mercado Pago (6 Cuotas sin interés)';
    if (m.includes('MERCADO_PAGO_12')) return 'mediante Mercado Pago (12 Cuotas, con 10% de costo financiero)';
    if (m.includes('MERCADO_PAGO_18')) return 'mediante Mercado Pago (18 Cuotas, con 10% de costo financiero)';
    if (m.includes('GO_CUOTAS')) return 'mediante Go Cuotas';
    return `mediante ${m.replace(/_/g, ' ')}`;
}

/** El mensaje de WhatsApp que acompaña al recibo. `fecha` ya formateada (dd/MM/yyyy). */
export function textoReciboPago(args: { clientName: string; method: string; amount: number; fecha: string }): string {
    return `Hola *${args.clientName}*, desde Atelier te informamos que hemos recibido tu pago ${etiquetaMetodoDePago(args.method)} por *$${formatearPrecio(args.amount)}* con fecha *${args.fecha}*. ¡Muchas gracias!`;
}
