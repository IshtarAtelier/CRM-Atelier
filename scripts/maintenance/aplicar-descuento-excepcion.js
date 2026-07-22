/**
 * Descuento especial POR EXCEPCIÓN sobre ventas puntuales.
 *
 * Estas ventas se cerraron a un precio pactado por debajo del precio de lista
 * (se igualó el presupuesto de otra óptica, o se cambió el cristal por uno de
 * stock). El sistema siguió midiendo el saldo contra el precio de lista, así
 * que figuran con un saldo que en la realidad no existe.
 *
 * La corrección NO toca los pagos ni los ítems: carga el hueco como
 * `specialDiscount` (el descuento que solo el admin puede dar) y recalcula el
 * valor de la venta con la fórmula canónica de PricingService:
 *
 *     subtotal           = Σ(precio × cantidad) − appliedPromoDiscount
 *     subtotalWithMarkup = subtotal × (1 + markup/100) − specialDiscount
 *     total (contado)    = subtotalWithMarkup × (1 − discountCash/100)
 *
 * Al quedar el descuento guardado en su propio campo, el valor sigue siendo
 * reproducible desde los ítems: reabrir y guardar el pedido, o correr
 * fix_inflated_order_totals.js, da exactamente el mismo número.
 *
 * Es idempotente (correrlo dos veces no descuenta dos veces) y solo BAJA el
 * valor de la venta: si el cálculo diera un valor mayor al guardado, no escribe.
 *
 *   DRY RUN:  node scripts/maintenance/aplicar-descuento-excepcion.js --prod
 *   APLICAR:  node scripts/maintenance/aplicar-descuento-excepcion.js --prod --commit
 *
 * Sin --prod corre contra la base local. --prod toma PROD_DATABASE_URL del .env
 * (nunca hace falta pasar la credencial por línea de comandos).
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const COMMIT = process.argv.includes('--commit');
const PROD = process.argv.includes('--prod');

if (PROD && !process.env.PROD_DATABASE_URL) {
    console.error('Falta PROD_DATABASE_URL en el .env');
    process.exit(1);
}
const prisma = PROD
    ? new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } })
    : new PrismaClient();

// Autorizado por la dueña el 22/07/2026. El motivo queda en la auditoría y en
// la ficha del cliente: es la explicación de por qué esa venta valió menos.
const EXCEPCIONES = [
    {
        id: 'cmqmhkita007x25b1oz775mzu', // #5MZU
        cliente: 'Verónica Ramirez',
        motivo: 'Se le bajó el valor del cristal: venía con otro presupuesto, se cobró el crizal y se realizó con un 1.60 de stock. Acordado en su momento.',
    },
    {
        id: 'cmpn4qm4k0002xxzaspd91ue5', // #1UE5
        cliente: 'Hernando Miguel',
        motivo: 'Se igualó el presupuesto de multifocales de otra óptica para cerrar la venta.',
    },
    {
        id: 'cmr9e3k9m006lvns75s2wrgzq', // #RGZQ
        cliente: 'Maria Andrea Robert',
        motivo: 'Se igualó el presupuesto de multifocales de otra óptica para cerrar la venta.',
    },
];

const money = (n) => `$${Math.round(n || 0).toLocaleString('es-AR')}`;

/** Equivalente en precio de lista de lo cobrado (misma regla que PricingService). */
function listEquivalentPaid(order) {
    const dc = order.discountCash ?? 20;
    const dt = order.discountTransfer ?? 15;
    const factorCash = 1 - dc / 100;
    const factorTrans = 1 - dt / 100;

    const eq = (order.payments || []).reduce((acc, p) => {
        const amount = p.amount || 0;
        const method = (p.method || '').toUpperCase().trim();
        const isCash = ['CASH', 'EFECTIVO', 'EFVO'].includes(method);
        const isTrans = ['TRANSFER', 'TRANSFERENCIA', 'TRANSF', 'DEPOSITO'].some(m => method.includes(m));
        if (isCash && factorCash > 0) return acc + amount / factorCash;
        if (isTrans && factorTrans > 0) return acc + amount / factorTrans;
        return acc + amount; // tarjeta u otro: vale su valor nominal de lista
    }, 0);

    // Mismo failsafe que PricingService: si no hay pagos desglosados, vale `paid`.
    return eq === 0 && (order.paid || 0) > 0 ? order.paid : eq;
}

async function main() {
    console.log(`\n${COMMIT ? '🔴 MODO ESCRITURA' : '🔍 DRY RUN'} — descuentos por excepción — base ${PROD ? 'PRODUCCIÓN' : 'local'}\n`);

    const planned = [];

    for (const exc of EXCEPCIONES) {
        const o = await prisma.order.findUnique({
            where: { id: exc.id },
            select: {
                id: true, clientId: true, orderType: true, isDeleted: true, createdAt: true,
                total: true, paid: true, subtotalWithMarkup: true, specialDiscount: true,
                markup: true, discountCash: true, discountTransfer: true, appliedPromoDiscount: true,
                client: { select: { name: true } },
                payments: { select: { amount: true, method: true, date: true } },
                items: { select: { price: true, quantity: true } },
            },
        });

        const ref = `#${exc.id.slice(-4).toUpperCase()}`;
        if (!o) { console.log(`❌ ${ref} — no existe. Se saltea.\n`); continue; }
        if (o.isDeleted) { console.log(`❌ ${ref} — está borrado. Se saltea.\n`); continue; }
        if (!o.items.length) { console.log(`❌ ${ref} — sin ítems, no se puede recalcular. Se saltea.\n`); continue; }

        // Base de cálculo: SIEMPRE desde los ítems, nunca desde el valor guardado
        // (así el descuento no se apila si el script se corre dos veces).
        const rawSubtotal = o.items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
        const subtotal = Math.max(0, rawSubtotal - (o.appliedPromoDiscount || 0));
        const withMarkup = subtotal * (1 + (o.markup || 0) / 100);

        const eqPaid = listEquivalentPaid(o);
        const hueco = withMarkup - eqPaid;

        const nuevoDescuento = Math.round(Math.min(withMarkup, Math.max(0, hueco)));
        const nuevoSubtotal = Math.round(withMarkup - nuevoDescuento);
        const nuevoTotal = Math.round(nuevoSubtotal * (1 - (o.discountCash || 0) / 100));
        const saldoAntes = Math.max(0, (o.subtotalWithMarkup || o.total || 0) - eqPaid);
        const saldoDespues = Math.max(0, nuevoSubtotal - eqPaid);

        console.log(`── ${ref}  ${o.client?.name || exc.cliente}  (${o.orderType} · ${o.createdAt.toLocaleDateString('es-AR')})`);
        console.log(`   Motivo: ${exc.motivo}`);
        console.log(`   Ítems ${money(rawSubtotal)}` +
            (o.appliedPromoDiscount ? ` − promo ${money(o.appliedPromoDiscount)}` : '') +
            (o.markup ? ` + markup ${o.markup}%` : '') +
            `  ⇒ base ${money(withMarkup)}`);
        console.log(`   Cobrado ${money(o.paid)} en ${o.payments.length} pago(s) ⇒ equivalente de lista ${money(eqPaid)}`);
        console.log(`   Dto. especial:  ${money(o.specialDiscount)}  →  ${money(nuevoDescuento)}`);
        console.log(`   Valor de lista: ${money(o.subtotalWithMarkup)}  →  ${money(nuevoSubtotal)}`);
        console.log(`   Total contado:  ${money(o.total)}  →  ${money(nuevoTotal)}   (desc. efectivo ${o.discountCash || 0}%)`);
        console.log(`   SALDO:          ${money(saldoAntes)}  →  ${money(saldoDespues)}`);

        if (saldoDespues > 1) {
            console.log(`   ❌ El saldo no queda en cero — se saltea para revisión manual.\n`);
            continue;
        }
        if (nuevoSubtotal > (o.subtotalWithMarkup || 0) + 1) {
            console.log(`   ❌ El cálculo SUBE el valor de la venta — el script solo baja. Se saltea.\n`);
            continue;
        }
        if (Math.abs(nuevoSubtotal - (o.subtotalWithMarkup || 0)) <= 1 && nuevoDescuento === Math.round(o.specialDiscount || 0)) {
            console.log(`   ✅ Ya estaba aplicado, nada que hacer.\n`);
            continue;
        }

        console.log('');
        planned.push({ o, exc, nuevoDescuento, nuevoSubtotal, nuevoTotal, saldoAntes });
    }

    if (!planned.length) {
        console.log('Nada para aplicar.\n');
        return;
    }

    if (!COMMIT) {
        console.log(`DRY RUN — no se escribió nada. ${planned.length} pedido(s) listos. Agregá --commit para aplicar.\n`);
        return;
    }

    for (const { o, exc, nuevoDescuento, nuevoSubtotal, nuevoTotal, saldoAntes } of planned) {
        const ref = `#${o.id.slice(-4).toUpperCase()}`;
        await prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id: o.id },
                data: {
                    specialDiscount: nuevoDescuento,
                    subtotalWithMarkup: nuevoSubtotal,
                    total: nuevoTotal,
                },
            });
            await tx.auditLog.create({
                data: {
                    userId: null,
                    userName: 'Sistema (descuento por excepción autorizado por la dueña)',
                    action: 'UPDATE',
                    entityType: 'ORDER',
                    entityId: o.id,
                    details: {
                        motivo: exc.motivo,
                        saldoQueSeCancela: Math.round(saldoAntes),
                        antes: { total: o.total, subtotalWithMarkup: o.subtotalWithMarkup, specialDiscount: o.specialDiscount },
                        despues: { total: nuevoTotal, subtotalWithMarkup: nuevoSubtotal, specialDiscount: nuevoDescuento },
                        paid: o.paid,
                    },
                },
            });
            await tx.interaction.create({
                data: {
                    clientId: o.clientId,
                    type: 'SISTEMA',
                    content: `💸 Descuento por excepción de ${money(nuevoDescuento)} sobre el pedido ${ref}: la venta pasa de ${money(o.subtotalWithMarkup)} a ${money(nuevoSubtotal)} de lista y queda SIN SALDO. Motivo: ${exc.motivo}`,
                    userId: null,
                    userName: 'Sistema (autorizado por la dueña)',
                },
            });
        });
        console.log(`✔ ${ref} ${o.client?.name} — descuento ${money(nuevoDescuento)} aplicado, saldo en cero.`);
    }

    console.log(`\n✅ ${planned.length} pedido(s) ajustados. Los pagos y los ítems NO se tocaron.\n`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
