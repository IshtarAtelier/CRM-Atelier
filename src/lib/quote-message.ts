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
import { esVentaDeOrden } from '@/lib/order-type';

const money = (n: number) => `$${Math.round(n || 0).toLocaleString('es-AR')}`;

/**
 * El mensaje de presupuesto/venta, exactamente como lo recibe el cliente.
 *
 * @param order  pedido con `items` (y sus productos) y los campos de importes.
 * @param clientName  nombre del cliente, como se lo saluda.
 */
export function buildQuoteMessage(order: any, clientName: string): string {
    const esVenta = esVentaDeOrden(order);
    const f = PricingService.calculateOrderFinancials(order);

    // Una línea por producto distinto: dos cristales del mismo modelo (OD y OI)
    // son UNA línea, como siempre se le mostró al cliente.
    const agrupados: Record<string, { brand: string; name: string }> = {};
    for (const it of order?.items || []) {
        const brand = it.product?.brand || it.productBrandSnapshot || '';
        const name = it.product?.name || it.productNameSnapshot || 'Producto';
        const key = `${brand}|${name}`;
        if (!agrupados[key]) agrupados[key] = { brand, name };
    }
    const itemLines = Object.values(agrupados)
        .map(g => `• ${g.brand ? g.brand + ' · ' : ''}${g.name}`)
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
    // Un PRESUPUESTO es una cotización y no mira pagos: las 12 cuotas van
    // siempre (Ishtar, 29/9/26). En una VENTA que ya tiene pagos no se ofrece
    // financiación larga (27/8/26). El importe ya trae el recargo adentro; la
    // leyenda del % no se escribe (31/8 noche).
    if (!esVenta || f.paidReal <= 0) {
        lineas.push(`   ↳ 12 cuotas fijas: ${money(f.installment12)} c/u`);
    }

    // Con pagos hechos, el saldo va en el mismo mensaje: sin esto el cliente
    // ve el total y cree que debe todo. Vale también para un PRESUPUESTO que
    // ya tiene una seña: se muestra solo si hubo pago (Ishtar, 3/10/2026; el
    // 29/9 se había sacado del presupuesto por completo). Sin pagos, nada.
    // `paidReal` y no `order.paid`: hay ventas con filas de Payment y paid=0,
    // y el PDF ya usa paidReal — las dos piezas tienen que decir lo mismo.
    if (f.hasBalance && f.paidReal > 0) {
        lineas.push(``);
        lineas.push(`Ya abonaste: ${money(f.paidReal)}`);
        lineas.push(`Saldo en efectivo: ${money(f.remainingCash)}`);
        lineas.push(`Saldo por transferencia: ${money(f.remainingTransfer)}`);
        lineas.push(`Saldo con tarjeta/lista: ${money(f.remainingCard)}`);
    } else if (!f.hasBalance && f.paidReal > 0) {
        lineas.push(``);
        lineas.push(`Estado: totalmente abonado ✅`);
    }

    // ACÁ NO VA LA GARANTÍA. Estuvo en el pie del presupuesto desde el
    // 31/8/2026 y Ishtar lo dio de baja el 16/9/2026: el presupuesto es una
    // cotización, todavía no se compró nada, y la promesa de cambio se hace en
    // la confirmación de compra (`sale-confirmation.ts`) y solo cuando el
    // pedido lleva multifocales o Super Blue.

    return lineas.join('\n');
}
