import { PricingService } from '@/services/PricingService';
import { lensOriginFromItem, lensOriginLabel } from '@/lib/lens-origin';

/**
 * Resumen en TEXTO del presupuesto/orden: las mismas líneas y los mismos
 * importes que ve el cliente en el PDF.
 *
 * Existe para que el envío quede asentado en la ficha con el detalle completo,
 * y no solo como "se envió un presupuesto". Es el mismo dato en dos lugares
 * (PDF y ficha), así que se arma acá una sola vez.
 *
 * Los importes NO se recalculan: los precios de ítem aplican el mismo
 * `markupFactor` que el PDF, y los totales salen de `PricingService`, que es el
 * único lugar donde se calcula plata en el sistema.
 */

/** Separador entre el resumen de una línea y el detalle colapsable. */
export const DETALLE_MARK = '\n⟦detalle⟧\n';

/** Parte un `content` de Interaction en { resumen, detalle }. */
export function splitDetalle(content: string): { resumen: string; detalle: string | null } {
    const i = content.indexOf(DETALLE_MARK);
    if (i === -1) return { resumen: content, detalle: null };
    return {
        resumen: content.slice(0, i),
        detalle: content.slice(i + DETALLE_MARK.length),
    };
}

const money = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

function eyeLabel(eye?: string | null): string {
    if (eye === 'RIGHT' || eye === 'OD') return 'Ojo Derecho (OD)';
    if (eye === 'LEFT' || eye === 'OI') return 'Ojo Izquierdo (OI)';
    return eye || '';
}

export function buildOrderDetailSummary(order: any): string {
    // Mismo factor que el PDF (order-pdf-generator.ts): el precio que ve el
    // cliente incluye el markup del pedido.
    const markupFactor = 1 + ((order.markup || 0) / 100);
    const lineas: string[] = [];

    for (const it of order.items || []) {
        const precio = Math.round(it.price * markupFactor);
        const cantidad = it.quantity || 1;
        const nombre = `${it.product?.brand || it.productBrandSnapshot || ''} ${it.product?.name || it.productNameSnapshot || ''}`.trim() || 'Artículo';

        const extras: string[] = [];
        const indice = it.product?.lensIndex || it.productLensIndexSnapshot;
        if (indice) extras.push(`Índice ${indice}`);
        const origen = lensOriginLabel(lensOriginFromItem(it));
        if (origen) extras.push(`Origen: ${origen}`);
        const lado = eyeLabel(it.eye);
        if (lado) extras.push(lado);

        const importe = precio === 0
            ? 'SIN CARGO (bonificado por promoción)'
            : `${cantidad} × ${money(precio)} = ${money(precio * cantidad)}`;

        lineas.push(`• ${nombre}${extras.length ? ` (${extras.join(' · ')})` : ''}\n   ${importe}`);
    }

    const partes: string[] = [];
    if (lineas.length) partes.push(lineas.join('\n'));

    // Descuentos, con los mismos nombres que muestra el PDF
    const promoInflado = Math.round((order.appliedPromoDiscount || 0) * markupFactor);
    const descuentos: string[] = [];
    if (promoInflado > 0) descuentos.push(`🎁 ${order.appliedPromoName || 'Bonificación Armazón'}: -${money(promoInflado)}`);
    if (order.specialDiscount > 0) descuentos.push(`Descuento especial: -${money(order.specialDiscount)}`);
    if (descuentos.length) partes.push(descuentos.join('\n'));

    // Totales y saldo: SIEMPRE de PricingService (regla del proyecto).
    const f = PricingService.calculateOrderFinancials(order);
    const totales = [`TOTAL (precio de lista): ${money(f.listPrice)}`];

    // Las tres formas de pago con sus cuotas, igual que el PDF. Sin esto la nota
    // decía un solo número y no se entendía qué se le había cotizado: el cliente
    // recibe tres precios distintos y dos planes de cuotas.
    totales.push(`💵 Efectivo (-${f.discountCash}%): ${money(f.totalCash)}`);
    totales.push(`🏦 Transferencia (-${f.discountTransfer}%): ${money(f.totalTransfer)}`);
    totales.push(`💳 Tarjeta (lista): ${money(f.totalCard)}`);
    totales.push(`   ↳ 3 cuotas sin interés de ${money(f.installment3)}`);
    totales.push(`   ↳ 6 cuotas sin interés de ${money(f.installment6)}`);

    if (f.hasBalance) {
        totales.push(`Saldo en efectivo: ${money(f.remainingCash)}`);
        totales.push(`Saldo por transferencia: ${money(f.remainingTransfer)}`);
        totales.push(`Saldo con tarjeta/lista: ${money(f.remainingCard)}`);
    } else {
        totales.push('Estado: totalmente abonado ✅');
    }
    partes.push(totales.join('\n'));

    return partes.join('\n\n');
}
