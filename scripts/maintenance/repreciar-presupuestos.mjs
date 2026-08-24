/**
 * Repricia TODOS los presupuestos abiertos al precio de catálogo vigente.
 * ESCRIBE en la base (solo con `--aplicar`).
 *
 * PARA QUÉ
 * Después de un aumento de catálogo, los presupuestos ya guardados siguen
 * mostrando el precio viejo hasta que alguien los abre y guarda de nuevo
 * (el server los repricia recién ahí). Eso deja semanas de convivencia entre
 * dos precios para el mismo cristal: el vendedor abre uno viejo, ve un
 * número, abre otro nuevo y ve otro. Este script corta esa ambigüedad de una:
 * los pasa a todos al precio de hoy en un solo momento.
 *
 * QUÉ NO TOCA
 * - Las VENTAS (orderType 'SALE'): nunca. Precio pactado es precio pactado.
 *   Es la misma regla que protege order.service.ts (ver check:venta-no-repricea).
 * - Los presupuestos borrados (isDeleted).
 * - Cualquier ítem que NO sea de la lista que se filtre (por defecto, los
 *   cristales de OPTOVISION — los del aumento del 7%).
 *
 * CÓMO REPRECIA
 * Aplica el MISMO porcentaje que subió el catálogo a cada renglón afectado,
 * sin tocar la estructura del presupuesto: el par gratis del 2x1 sigue en $0
 * y un precio pisado a mano se mantiene pisado (con el aumento encima).
 *
 * A propósito NO usa `recalculateCrystalPrices` (la función del server):
 * esa REORGANIZA la promo — decide de nuevo qué par va gratis — y sobre
 * presupuestos viejos con renglones descuadrados (dos OD y un OI, que los
 * hay) reasigna el bonificado y termina cobrando de más. Eso está bien
 * cuando el vendedor edita el carrito en pantalla y ve lo que pasa; no está
 * bien en una corrida masiva. Los totales sí se recalculan con
 * PricingService, igual que updateOrder.
 *
 * Uso:
 *   node --experimental-strip-types --import ./scripts/checks/_alias.mjs --env-file=.env scripts/maintenance/repreciar-presupuestos.mjs --produccion
 *   node --experimental-strip-types --import ./scripts/checks/_alias.mjs --env-file=.env scripts/maintenance/repreciar-presupuestos.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { recalculateCrystalPrices, applyTeñidoPromoDiscount } from '../../src/lib/promo-utils.ts';
import { calculateQuoteTotals } from '../../src/services/PricingService.ts';

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const LAB = (process.argv.find(a => a.startsWith('--laboratorio=')) || '').split('=')[1] || 'OPTOVISION';
const CATEGORIA = (process.argv.find(a => a.startsWith('--categoria=')) || '').split('=')[1] || 'Cristal';
// El MISMO porcentaje con el que se subió el catálogo. Tiene que coincidir:
// este script no lee "cuánto subió cada producto", aplica el factor pactado.
const PORCENTAJE = Number((process.argv.find(a => a.startsWith('--porcentaje=')) || '').split('=')[1] || '7');
const FACTOR = 1 + PORCENTAJE / 100;

if (!Number.isFinite(PORCENTAJE) || PORCENTAJE <= 0) {
  console.error('--porcentaje debe ser un número positivo (ej: --porcentaje=7).');
  process.exit(1);
}

if (PRODUCCION && !process.env.PROD_DATABASE_URL) {
  console.error('Falta PROD_DATABASE_URL. Correr con --env-file=.env desde la carpeta que tiene el .env.');
  process.exit(1);
}

const prisma = new PrismaClient(
  PRODUCCION ? { datasources: { db: { url: process.env.PROD_DATABASE_URL } } } : {},
);

console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'local'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'simulación'}`);
console.log(`Filtro: ${CATEGORIA} de ${LAB} · aumento a replicar: ${PORCENTAJE}%\n`);

const productosDelAumento = await prisma.product.findMany({
  where: { category: CATEGORIA, laboratory: LAB },
  select: { id: true },
});
const idsAfectados = new Set(productosDelAumento.map(p => p.id));

const presupuestos = await prisma.order.findMany({
  where: {
    isDeleted: false,
    orderType: { not: 'SALE' },
    items: { some: { productId: { in: [...idsAfectados] } } },
  },
  select: {
    id: true, total: true, subtotalWithMarkup: true, markup: true,
    discountCash: true, specialDiscount: true,
    client: { select: { name: true } },
    items: {
      select: {
        id: true, productId: true, price: true, quantity: true, eye: true,
        crystalColorType: true,
        product: true,
      },
    },
  },
  orderBy: { updatedAt: 'desc' },
});

const tintStylePrices = Object.fromEntries(
  (await prisma.tintStylePrice.findMany()).map(t => [t.category, t.price]),
);

const cambios = [];
for (const orden of presupuestos) {
  // Mismo shape que usa updateOrder al recalcular.
  const items = orden.items.map(it => ({
    id: it.id,
    product: it.product,
    productId: it.productId,
    quantity: it.quantity,
    price: it.price,
    eye: it.eye,
    crystalColorType: it.crystalColorType,
    // isPromo no existe en la base: el par gratis del 2x1 se representa con
    // price 0. recalculateCrystalPrices lo vuelve a derivar solo.
    isPromo: it.price === 0,
  }));

  // NO se usa recalculateCrystalPrices acá, aunque sea la función del server.
  // Esa función REORGANIZA la promo (decide de nuevo qué par va gratis), y
  // sobre presupuestos viejos con renglones descuadrados (dos OD y un OI, que
  // los hay) reasigna el par bonificado y termina cobrando de más. Ese
  // reordenamiento es correcto cuando el vendedor está editando el carrito en
  // pantalla; NO lo es para una corrida masiva a espaldas de nadie.
  //
  // Acá se hace lo único que corresponde: aplicar el MISMO factor de aumento
  // que subió el catálogo, renglón por renglón, sin tocar la estructura.
  //  - El par gratis del 2x1 (price 0) sigue en 0.
  //  - Un precio pisado a mano se respeta: se le aplica el mismo factor, no se
  //    lo devuelve al precio de lista (bajarle el precio a un presupuesto ya
  //    entregado al cliente sería peor que dejarlo viejo).
  for (const it of items) {
    if (!idsAfectados.has(it.productId)) continue;
    if (it.price === 0) continue;
    it.price = Math.round(it.price * FACTOR);
  }
  applyTeñidoPromoDiscount(items, tintStylePrices);

  const cartItems = items.map(it => ({
    product: it.product || { price: it.price },
    quantity: it.quantity,
    customPrice: it.price,
  }));
  const totals = calculateQuoteTotals(
    cartItems,
    orden.markup || 0,
    orden.discountCash || 0,
    [],
    orden.specialDiscount || 0,
  );

  const lineasCambiadas = items.filter((it, i) => it.price !== orden.items[i].price);
  const totalCambio = totals.subtotalWithMarkup !== (orden.subtotalWithMarkup || 0);
  if (!lineasCambiadas.length && !totalCambio) continue;

  // ¿El total guardado ya estaba desalineado ANTES del aumento? Pasa en
  // presupuestos viejos (renglones agregados sin recalcular, productos
  // borrados). El script lo corrige de paso — pero hay que poder verlo, si no
  // parece que el aumento subió más de lo pactado.
  const totalsPrevios = calculateQuoteTotals(
    orden.items.map(it => ({ product: it.product || { price: it.price }, quantity: it.quantity, customPrice: it.price })),
    orden.markup || 0, orden.discountCash || 0, [], orden.specialDiscount || 0,
  );
  const desalineadoPrevio = totalsPrevios.subtotalWithMarkup - (orden.subtotalWithMarkup || 0);

  cambios.push({
    ordenId: orden.id,
    cliente: orden.client?.name || 'sin cliente',
    deTotal: orden.subtotalWithMarkup || 0,
    aTotal: totals.subtotalWithMarkup,
    desalineadoPrevio,
    lineas: items.map((it, i) => ({
      id: it.id,
      nombre: `${it.product?.name || '?'}${it.eye ? ` [${it.eye}]` : ''}`,
      catalogo: it.product?.price || 0,
      de: orden.items[i].price,
      a: it.price,
    })),
    totals,
  });
}

for (const c of cambios) {
  const pct = c.deTotal ? Math.round(((c.aTotal - c.deTotal) / c.deTotal) * 100) : 0;
  console.log(`#${c.ordenId.slice(-6).toUpperCase()} · ${c.cliente}`);
  console.log(`   lista: $${c.deTotal.toLocaleString('es-AR')} → $${c.aTotal.toLocaleString('es-AR')}  (${pct >= 0 ? '+' : ''}${pct}%)`);
  if (c.desalineadoPrevio) {
    console.log(`   ⚠️  el total guardado YA estaba desalineado en $${c.desalineadoPrevio.toLocaleString('es-AR')} antes del aumento (se corrige de paso)`);
  }
  for (const l of c.lineas) {
    if (l.de === l.a) continue;
    const pctL = l.de ? Math.round(((l.a - l.de) / l.de) * 100) : 0;
    console.log(`      ${l.nombre}: $${l.de.toLocaleString('es-AR')} → $${l.a.toLocaleString('es-AR')} (${pctL >= 0 ? '+' : ''}${pctL}%)  [catálogo: $${(l.catalogo || 0).toLocaleString('es-AR')}]`);
  }
}

console.log(`\nTOTAL: ${cambios.length} presupuestos cambian (de ${presupuestos.length} que tienen algún producto de la lista).`);

if (!cambios.length) {
  console.log('Nada que hacer.');
  await prisma.$disconnect();
  process.exit(0);
}

if (!APLICAR) {
  console.log('\nSimulación: no se escribió nada. Agregar --aplicar para hacerlo.');
  await prisma.$disconnect();
  process.exit(0);
}

let hechos = 0;
for (const c of cambios) {
  // Una transacción por presupuesto: si algo falla, se ve exactamente en cuál
  // y los anteriores quedan bien. Son cientos de filas, no hace falta más.
  await prisma.$transaction([
    ...c.lineas
      .filter(l => l.de !== l.a)
      .map(l => prisma.orderItem.update({ where: { id: l.id }, data: { price: l.a } })),
    prisma.order.update({
      where: { id: c.ordenId },
      data: {
        subtotalWithMarkup: c.totals.subtotalWithMarkup,
        total: c.totals.totalCash,
        appliedPromoName: c.totals.appliedPromoName,
        appliedPromoDiscount: c.totals.promoFrameDiscount,
        specialDiscount: Math.round(c.totals.specialDiscountAmount),
      },
    }),
  ]);
  hechos++;
}

console.log(`\n✅ ${hechos} presupuestos repreciados al catálogo vigente.`);
console.log('Las ventas no se tocaron. Los saldos y las cuotas salen del precio de lista: se recalculan solos.');
await prisma.$disconnect();
