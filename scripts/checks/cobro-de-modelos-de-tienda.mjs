/**
 * ¿Se cobraron las ventas de los modelos que hoy están activos en la tienda?
 *
 * Complemento de modelos-vendidos-en-tienda.mjs: aquel cuenta VENTAS, este
 * mira COBROS. Dos reglas de CLAUDE.md mandan acá:
 *   · `Order.paid` NO prueba que se haya cobrado — la verdad son las filas de
 *     `Payment`.
 *   · El saldo NUNCA es lista − cobrado: cada pago se convierte a su
 *     equivalente de lista. Por eso el cálculo NO se reimplementa: se llama a
 *     PricingService.calculateOrderFinancials(), el único lugar donde vive.
 *
 * El saldo es de la VENTA ENTERA (armazón + cristales + tratamientos), no del
 * armazón solo: lo que se cobra o se debe es el ticket, no el renglón.
 *
 * SOLO LECTURA.
 *
 * Uso:
 *   node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/checks/cobro-de-modelos-de-tienda.mjs [--prod]
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { PricingService } from '@/services/PricingService';

const usarProd = process.argv.includes('--prod');

const env = Object.fromEntries(
    readFileSync(new URL('../../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);
const url = usarProd ? env.PROD_DATABASE_URL : env.DATABASE_URL;
if (!url) { console.error(`No encontré ${usarProd ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en .env`); process.exit(1); }
console.log(`Base: ${usarProd ? 'PRODUCCIÓN' : 'local'} (${url.replace(/:\/\/[^@]*@/, '://***@').split('?')[0]})\n`);

const prisma = new PrismaClient({ datasourceUrl: url });
const plata = (n) => '$' + Math.round(n).toLocaleString('es-AR');
const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '—');

try {
    const activos = await prisma.webProduct.findMany({
        where: { isActive: true, product: { publishToWeb: true, stock: { gt: 0 }, category: { not: 'Cristal' } } },
        select: { name: true, product: { select: { id: true } } },
    });
    const nombrePorProducto = new Map(activos.map((w) => [w.product.id, w.name]));

    const items = await prisma.orderItem.findMany({
        where: { productId: { in: [...nombrePorProducto.keys()] }, order: { orderType: 'SALE', isDeleted: false } },
        select: { productId: true, price: true, orderId: true },
    });
    if (items.length === 0) { console.log('Ningún modelo activo de la tienda registra ventas.'); process.exit(0); }

    const ordenes = await prisma.order.findMany({
        where: { id: { in: [...new Set(items.map((i) => i.orderId))] } },
        select: {
            id: true, createdAt: true, total: true, paid: true, subtotalWithMarkup: true,
            discountCash: true, discountTransfer: true, specialDiscount: true, labStatus: true,
            client: { select: { name: true } },
            payments: { select: { method: true, amount: true, date: true } },
        },
    });
    const porId = new Map(ordenes.map((o) => [o.id, o]));

    const filas = items.map((it) => {
        const o = porId.get(it.orderId);
        const fin = PricingService.calculateOrderFinancials(o);
        return {
            modelo: nombrePorProducto.get(it.productId),
            cliente: o.client?.name || '—',
            fecha: o.createdAt,
            precioArmazon: it.price,
            listaVenta: fin.listPrice,
            equivalentePagado: fin.listEquivalentPaid,
            saldo: fin.remainingList,
            tieneSaldo: fin.hasBalance,
            pagos: o.payments.length,
            campoPaid: o.paid,
            labStatus: o.labStatus,
        };
    }).sort((a, b) => b.saldo - a.saldo || new Date(a.fecha) - new Date(b.fecha));

    const conSaldo = filas.filter((f) => f.tieneSaldo);
    const sinPagos = filas.filter((f) => f.pagos === 0);

    console.log(`${filas.length} ventas de modelos activos en la tienda`);
    console.log(`  · Cobradas por completo: ${filas.length - conSaldo.length}`);
    console.log(`  · Con saldo pendiente:   ${conSaldo.length}  (${plata(conSaldo.reduce((s, f) => s + f.saldo, 0))} a cobrar)`);
    console.log(`  · SIN NINGÚN PAGO cargado: ${sinPagos.length}\n`);

    console.log('MODELO'.padEnd(16) + 'CLIENTE'.padEnd(24) + 'FECHA'.padEnd(12) + 'LISTA'.padStart(12) + 'PAGADO(eq)'.padStart(13) + 'SALDO'.padStart(12) + '  P.');
    console.log('─'.repeat(95));
    for (const f of filas) {
        console.log(
            String(f.modelo).slice(0, 15).padEnd(16) +
            String(f.cliente).slice(0, 23).padEnd(24) +
            fecha(f.fecha).padEnd(12) +
            plata(f.listaVenta).padStart(12) +
            plata(f.equivalentePagado).padStart(13) +
            (f.tieneSaldo ? plata(f.saldo) : '—').padStart(12) +
            '  ' + f.pagos,
        );
    }
    console.log('\nP. = cantidad de filas de Payment. Cero pagos con saldo en $0 sería un dato inventado por el campo `paid`.');
} finally {
    await prisma.$disconnect();
}
