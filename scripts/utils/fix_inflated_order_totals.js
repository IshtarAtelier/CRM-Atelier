/**
 * Repara ventas cuyo valor fue reescrito por un cobro de más.
 *
 * El bug (corregido en contact.service.ts): al cargar o editar un pago, si lo
 * cobrado superaba el total del pedido, el sistema pisaba `total` y
 * `subtotalWithMarkup` con el monto pagado ("regla automática de recargo por
 * financiación"). Un comprobante cargado de más redefinía el precio de la venta,
 * y borrar ese pago NO devolvía el valor original (deletePayment solo recalcula
 * `paid`). Resultado: ventas que valen $50.000 figurando en $100.000.
 *
 * Qué hace: recalcula el valor de cada venta a partir de sus ÍTEMS (que el bug no
 * tocó) con la misma fórmula del cotizador (PricingService.calculateTotals):
 *
 *     subtotal           = Σ(precio × cantidad) − appliedPromoDiscount
 *     subtotalWithMarkup = subtotal × (1 + markup/100) − specialDiscount
 *     total (contado)    = subtotalWithMarkup × (1 − discountCash/100)
 *
 * markup, appliedPromoDiscount, specialDiscount y discountCash quedaron intactos,
 * así que la reconstrucción es exacta. Reporta toda venta cuyo valor guardado esté
 * POR ENCIMA del que justifican sus ítems, con el detalle de sus cobros para que
 * se vea cuál sobra.
 *
 * DRY por defecto (solo informa). Para escribir agregar --commit:
 *   LOCAL informe:   node scripts/utils/fix_inflated_order_totals.js
 *   PROD informe:    DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/fix_inflated_order_totals.js
 *   PROD 1 cliente:  DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/fix_inflated_order_totals.js --client=cmqlg0d43003z25b1yu1frrft
 *   PROD escribir:   DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/fix_inflated_order_totals.js --client=... --commit
 *
 * Filtros: --client=<id> y --order=<id> (repetibles). Sin filtros barre todo.
 * Nunca borra ni modifica pagos: solo devuelve el valor de la venta y deja el
 * cobro sobrante a la vista para que una persona decida qué hacer con él.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COMMIT = process.argv.includes('--commit');
const argValues = (flag) => process.argv
    .filter(a => a.startsWith(`${flag}=`))
    .flatMap(a => a.slice(flag.length + 1).split(',').map(s => s.trim()).filter(Boolean));

const CLIENT_IDS = argValues('--client');
const ORDER_IDS = argValues('--order');

// Diferencia mínima para considerar que el valor fue inflado (absorbe redondeos).
const TOLERANCE = 1;

const money = (n) => `$${Math.round(n || 0).toLocaleString('es-AR')}`;
const dmy = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '—';

/** Reproduce PricingService.calculateTotals con los campos que el bug no tocó. */
function expectedTotals(order) {
    const rawSubtotal = order.items.reduce(
        (sum, it) => sum + ((it.price || 0) * (it.quantity || 1)), 0
    );
    const subtotal = Math.max(0, rawSubtotal - (order.appliedPromoDiscount || 0));
    const withMarkup = subtotal * (1 + (order.markup || 0) / 100);
    const special = Math.min(withMarkup, order.specialDiscount || 0);
    const subtotalWithMarkup = Math.round(withMarkup - special);
    const total = Math.round(subtotalWithMarkup * (1 - (order.discountCash || 0) / 100));
    return { rawSubtotal, subtotalWithMarkup, total };
}

async function main() {
    const where = { isDeleted: false };
    if (CLIENT_IDS.length) where.clientId = { in: CLIENT_IDS };
    if (ORDER_IDS.length) where.id = { in: ORDER_IDS };
    // Sin filtros: solo tiene sentido barrer pedidos con cobros (el bug solo
    // se disparaba al registrar un pago).
    if (!CLIENT_IDS.length && !ORDER_IDS.length) where.paid = { gt: 0 };

    const orders = await prisma.order.findMany({
        where,
        select: {
            id: true, clientId: true, orderType: true, status: true, createdAt: true,
            total: true, paid: true, subtotalWithMarkup: true,
            markup: true, discountCash: true, specialDiscount: true, appliedPromoDiscount: true,
            client: { select: { name: true } },
            items: { select: { price: true, quantity: true, productNameSnapshot: true, eye: true } },
            payments: {
                select: { id: true, date: true, amount: true, method: true, notes: true, createdByName: true },
                orderBy: { date: 'asc' }
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    console.log(`\nAnalizando ${orders.length} pedido(s)${CLIENT_IDS.length || ORDER_IDS.length ? ' (filtrados)' : ' con cobros'}\n`);

    const inflated = [];
    const onlyCashTotal = [];
    const noItems = [];

    for (const o of orders) {
        if (o.items.length === 0) {
            if (CLIENT_IDS.length || ORDER_IDS.length) noItems.push(o);
            continue;
        }
        const exp = expectedTotals(o);
        const storedList = o.subtotalWithMarkup || o.total || 0;
        const listGap = storedList - exp.subtotalWithMarkup;
        const totalGap = (o.total || 0) - exp.total;

        // Solo se repara el VALOR DE LISTA inflado: es el que se muestra como precio
        // de la venta y el que usan reportes y dashboard. Y solo hacia abajo — si la
        // reconstrucción diera MÁS que lo guardado, la diferencia tiene otra causa
        // (ítems o precios editados después) y subir el precio de una venta cerrada
        // sería peor que el bug.
        if (listGap > TOLERANCE && exp.total <= (o.total || 0)) {
            inflated.push({ order: o, expected: exp, listGap, totalGap });
        } else if (totalGap > TOLERANCE) {
            // El precio de lista está intacto y solo `total` (precio contado) quedó
            // en lo efectivamente cobrado — pasa cuando se paga con tarjeta el precio
            // de lista. No se toca: no altera lo que se ve ni lo que reportan.
            onlyCashTotal.push({ order: o, expected: exp, totalGap });
        }
    }

    if (noItems.length) {
        console.log(`⚠️  ${noItems.length} pedido(s) sin ítems: no se puede reconstruir su valor, se saltean`);
        noItems.forEach(o => console.log(`    ${o.id} — ${o.client?.name || 's/cliente'} — ${money(o.total)}`));
        console.log('');
    }

    if (onlyCashTotal.length) {
        const suma = onlyCashTotal.reduce((s, r) => s + r.totalGap, 0);
        console.log(`ℹ️  ${onlyCashTotal.length} pedido(s) con el precio de lista intacto y solo el total contado movido a lo cobrado (${money(suma)} en total). No se tocan.\n`);
    }

    if (!inflated.length) {
        console.log('✅ Ningún pedido con el valor de lista inflado por cobros.\n');
        return;
    }

    console.log(`🔴 ${inflated.length} pedido(s) con el valor por encima de lo que justifican sus ítems:\n`);

    for (const { order: o, expected, listGap } of inflated) {
        const ref = `#${o.id.slice(-4).toUpperCase()}`;
        console.log(`── ${ref}  ${o.client?.name || 's/cliente'}  (${o.orderType} · ${dmy(o.createdAt)})`);
        console.log(`   id: ${o.id}`);
        console.log(`   Ítems (${o.items.length}): ${money(expected.rawSubtotal)}` +
            (o.appliedPromoDiscount ? ` − promo ${money(o.appliedPromoDiscount)}` : '') +
            (o.markup ? ` + markup ${o.markup}%` : '') +
            (o.specialDiscount ? ` − desc. especial ${money(o.specialDiscount)}` : ''));
        console.log(`   Valor de lista:  guardado ${money(o.subtotalWithMarkup)}  →  correcto ${money(expected.subtotalWithMarkup)}   (inflado ${money(listGap)})`);
        console.log(`   Total contado:   guardado ${money(o.total)}  →  correcto ${money(expected.total)}   (desc. efectivo ${o.discountCash || 0}%)`);
        console.log(`   Cobrado: ${money(o.paid)} en ${o.payments.length} pago(s):`);
        for (const p of o.payments) {
            console.log(`     · ${dmy(p.date)}  ${money(p.amount).padStart(12)}  ${p.method}` +
                `${p.createdByName ? `  — ${p.createdByName}` : ''}${p.notes ? `  ref: ${p.notes}` : ''}  [${p.id}]`);
        }
        const excess = (o.paid || 0) - expected.subtotalWithMarkup;
        if (excess > 0) console.log(`   ⚠️  Cobrado ${money(excess)} POR ENCIMA del valor real de la venta — revisar si sobra un comprobante`);
        console.log('');
    }

    if (!COMMIT) {
        console.log('DRY RUN — no se escribió nada. Agregá --commit para aplicar la corrección de valores.\n');
        return;
    }

    for (const { order: o, expected } of inflated) {
        await prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id: o.id },
                data: { total: expected.total, subtotalWithMarkup: expected.subtotalWithMarkup },
            });
            await tx.auditLog.create({
                data: {
                    userId: null,
                    userName: 'Sistema (corrección de valores inflados por cobros)',
                    action: 'UPDATE',
                    entityType: 'ORDER',
                    entityId: o.id,
                    details: {
                        motivo: 'El valor de la venta había sido reescrito por un cobro que superaba el total. Se recalculó desde los ítems del pedido.',
                        antes: { total: o.total, subtotalWithMarkup: o.subtotalWithMarkup },
                        despues: { total: expected.total, subtotalWithMarkup: expected.subtotalWithMarkup },
                        paid: o.paid,
                    },
                },
            });
        });
        console.log(`✔ ${o.id} — valor restaurado a ${money(expected.subtotalWithMarkup)} (lista) / ${money(expected.total)} (contado)`);
    }
    console.log(`\n✅ ${inflated.length} pedido(s) corregidos. Los cobros NO se tocaron: si sobra un comprobante, borralo desde la ficha.\n`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
