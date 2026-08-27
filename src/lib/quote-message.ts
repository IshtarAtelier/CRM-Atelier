// ────────────────────────────────────────────────────────────────────────────
// El presupuesto tal cual se le manda al cliente por WhatsApp.
//
// Vivía escrito adentro de QuoteSummary, así que la ficha no tenía forma de
// guardar la MISMA copia que recibió el cliente: quedaba un resumen aparte, con
// otros datos y sin las cuotas. Acá se arma una sola vez y lo usan los dos —
// el envío y la nota de la ficha — para que no puedan divergir.
//
// Módulo PURO: sin prisma, sin fetch. Los importes salen de `PricingService`,
// que es el único lugar del sistema donde se calcula plata.
// ────────────────────────────────────────────────────────────────────────────

import { PricingService } from '@/services/PricingService';
import { lensOriginSuffix, lensOriginFromItem } from '@/lib/lens-origin';

const money = (n: number) => `$${Math.round(n || 0).toLocaleString('es-AR')}`;

/**
 * El mensaje de presupuesto/venta, exactamente como lo recibe el cliente.
 *
 * @param order  pedido con `items` (y sus productos) y los campos de importes.
 * @param clientName  nombre del cliente, como se lo saluda.
 */
export function buildQuoteMessage(order: any, clientName: string): string {
    const esVenta = order?.orderType === 'SALE' || order?.orderType === 'MAYORISTA';
    const f = PricingService.calculateOrderFinancials(order);

    // Una línea por producto distinto: dos cristales del mismo modelo (OD y OI)
    // son UNA línea, como siempre se le mostró al cliente.
    const agrupados: Record<string, { brand: string; name: string; origin: string }> = {};
    for (const it of order?.items || []) {
        const brand = it.product?.brand || it.productBrandSnapshot || '';
        const name = it.product?.name || it.productNameSnapshot || 'Producto';
        const origin = lensOriginSuffix(lensOriginFromItem(it));
        const key = `${brand}|${name}`;
        if (!agrupados[key]) agrupados[key] = { brand, name, origin };
    }
    const itemLines = Object.values(agrupados)
        .map(g => `• ${g.brand ? g.brand + ' · ' : ''}${g.name}${g.origin}`)
        .join('\n');

    const lineas: string[] = [
        `✨ *${esVenta ? 'VENTA' : 'PRESUPUESTO'} — ATELIER ÓPTICA* ✨`,
        `👤 *Cliente:* ${clientName}`,
        ``,
        itemLines,
        ``,
    ];

    // Si el admin aplicó un descuento especial, el mensaje lo dice en vez de
    // mostrar un precio de lista más bajo sin explicación: `listPrice` ya viene
    // neto, así que se parte del precio previo y se muestra la resta.
    if (f.specialDiscount > 0) {
        lineas.push(`Precio Lista: ${money(f.listPriceBeforeSpecial)}`);
        lineas.push(`✨ *Descuento especial: -${money(f.specialDiscount)}*`);
        lineas.push(`*Precio con tu descuento: ${money(f.listPrice)}*`);
    } else {
        lineas.push(`*Precio Lista: ${money(f.listPrice)}*`);
    }

    lineas.push(`🏦 *Transf. (-${f.discountTransfer}%): ${money(f.totalTransfer)}*`);
    lineas.push(`💵 *Efectivo (-${f.discountCash}%): ${money(f.totalCash)}*`);
    lineas.push(`💳 *Tarjeta (Lista): ${money(f.totalCard)}*`);
    lineas.push(`   ↳ 3 cuotas sin interés: ${money(f.installment3)} c/u`);
    lineas.push(`   ↳ 6 cuotas sin interés: ${money(f.installment6)} c/u`);
    // Las 12 cuotas (con 10%) se ofrecen SOLO al cotizar: un pedido que ya tiene
    // pagos está en etapa de saldo y no se le ofrece financiación larga (regla
    // de Ishtar, 27/8/26).
    if (f.paidReal <= 0) {
        lineas.push(`   ↳ 12 cuotas (con 10% costo financiero): ${money(f.installment12)} c/u`);
    }

    // Si ya hay pagos hechos, el saldo va en el mismo mensaje: sin esto el
    // cliente ve el total y cree que debe todo.
    if (f.hasBalance && (order?.paid || 0) > 0) {
        lineas.push(``);
        lineas.push(`Ya abonaste: ${money(order.paid)}`);
        lineas.push(`Saldo en efectivo: ${money(f.remainingCash)}`);
        lineas.push(`Saldo por transferencia: ${money(f.remainingTransfer)}`);
        lineas.push(`Saldo con tarjeta/lista: ${money(f.remainingCard)}`);
    } else if (!f.hasBalance && (order?.paid || 0) > 0) {
        lineas.push(``);
        lineas.push(`Estado: totalmente abonado ✅`);
    }

    return lineas.join('\n');
}
