// ────────────────────────────────────────────────────────────────────────────
// Facturado SIN costo financiero (regla de Ishtar, 3/10/2026). SIN BASE y SIN
// RED: importa el PricingService REAL y lo prueba con ventas de juguete.
//
// La regla:
//  - La venta entra ENTERA al precio de EFECTIVO si la pagó en efectivo, o al
//    de TRANSFERENCIA si pagó por transferencia o con tarjeta (3, 6, 12, Payway,
//    MP, Naranja, pago web). Mixta con tarjeta = transferencia.
//  - Los SALDOS son independientes del objetivo: no se descuentan ni importa
//    cuánto lleva pagado. Sin pagos todavía, vale a transferencia.
//  - costoFinanciero = cobrado nominal − valor real de lo cobrado (tarjeta a
//    transferencia; MP 12 saca primero el +10% que trae adentro). Efectivo,
//    transferencia, débito y cuenta especial: cero.
//  - La misma venta vale lo mismo pagada en 3, 6 o 12: el objetivo no premia la tarjeta.
//  - Venta web por transferencia (sin subtotalWithMarkup, total ya rebajado):
//    vale `total` tal cual, no se le descuenta otra vez.
//
// Correr:  npm run check:sin-cf   (también en CI)
// ────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { PricingService } from '../../src/services/PricingService.ts';

const LISTA = 100_000;
const venta = (payments, extra = {}) => ({ subtotalWithMarkup: LISTA, total: LISTA, discountCash: 20, discountTransfer: 15, payments, ...extra });
const EFECTIVO = 80_000, TRANSF = 85_000;
const v = (o) => PricingService.valorSinCostoFinanciero(o);

// Efectivo completo.
let r = v(venta([{ method: 'EFECTIVO', amount: 80_000 }]));
assert.equal(r.real, EFECTIVO); assert.equal(r.modo, 'EFECTIVO'); assert.equal(r.costoFinanciero, 0);

// Seña en efectivo y saldo pendiente: la venta entra ENTERA a efectivo. El saldo no se descuenta.
r = v(venta([{ method: 'EFECTIVO', amount: 20_000 }]));
assert.equal(r.real, EFECTIVO); assert.equal(r.cobradoNominal, 20_000);

// Transferencia completa y transferencia parcial: entera a transferencia.
r = v(venta([{ method: 'TRANSFERENCIA_ISHTAR', amount: 85_000 }]));
assert.equal(r.real, TRANSF); assert.equal(r.modo, 'TRANSFERENCIA'); assert.equal(r.costoFinanciero, 0);
r = v(venta([{ method: 'TRANSFERENCIA_ISHTAR', amount: 10_000 }]));
assert.equal(r.real, TRANSF);

// Tarjeta 6 cuotas a lista: vale 85.000; costo financiero 15.000 sobre lo cobrado.
r = v(venta([{ method: 'MERCADO_PAGO_6_ISH', amount: LISTA }]));
assert.equal(r.real, TRANSF); assert.equal(r.modo, 'TARJETA'); assert.equal(r.cobradoNominal, LISTA); assert.equal(r.costoFinanciero, 15_000);

// Payway 3, Naranja, pago web: misma regla. En 3, 6 o 12 vale lo mismo.
for (const method of ['PAY_WAY_3_ISH', 'PAY_WAY_6_YANI', 'NARANJA_Z_YANI', 'TARJETA', 'MERCADO_PAGO_3_ISH']) {
    assert.equal(v(venta([{ method, amount: LISTA }])).real, TRANSF, method);
}

// MP 12: el cliente paga 110.000 (lista × 1,10). Vale 85.000; costo financiero 25.000.
r = v(venta([{ method: 'MERCADO_PAGO_12_ISH', amount: 110_000 }]));
assert.equal(r.real, TRANSF); assert.equal(r.costoFinanciero, 25_000);

// Tarjeta parcial (seña con tarjeta, saldo pendiente): entera a transferencia; CF solo sobre lo cobrado.
r = v(venta([{ method: 'PAY_WAY_6_ISH', amount: 40_000 }]));
assert.equal(r.real, TRANSF); assert.equal(r.costoFinanciero, 6_000);

// Mixta efectivo + tarjeta: manda la tarjeta → transferencia.
r = v(venta([{ method: 'EFECTIVO', amount: 30_000 }, { method: 'PAY_WAY_6_ISH', amount: 62_500 }]));
assert.equal(r.real, TRANSF); assert.equal(r.modo, 'TARJETA');

// Mixta efectivo + transferencia: transferencia.
r = v(venta([{ method: 'EFECTIVO', amount: 30_000 }, { method: 'TRANSFERENCIA_ISHTAR', amount: 40_000 }]));
assert.equal(r.real, TRANSF); assert.equal(r.costoFinanciero, 0);

// Sin pagos: a transferencia. Independiente de los saldos.
r = v(venta([]));
assert.equal(r.real, TRANSF); assert.equal(r.modo, 'SIN_PAGOS'); assert.equal(r.cobradoNominal, 0);

// Cuenta especial y débito: sin plataforma, sin costo financiero, a transferencia.
for (const method of ['OTRO_ESPECIAL', 'DEBIT']) {
    r = v(venta([{ method, amount: 85_000 }]));
    assert.equal(r.real, TRANSF, method); assert.equal(r.costoFinanciero, 0, method);
}

// Descuento propio de la venta (no un 15% plano): transferencia 10%, efectivo 25%.
assert.equal(v({ ...venta([{ method: 'PAY_WAY_6_ISH', amount: LISTA }]), discountTransfer: 10 }).real, 90_000);
assert.equal(v({ ...venta([{ method: 'EFECTIVO', amount: 75_000 }]), discountCash: 25 }).real, 75_000);

// Failsafe: `paid` sin filas de pago cuenta como cobrado sin costo financiero; la venta vale a transferencia.
r = v({ ...venta([]), paid: 50_000 });
assert.equal(r.cobradoNominal, 50_000); assert.equal(r.costoFinanciero, 0); assert.equal(r.real, TRANSF);

// Venta web por transferencia: nace sin subtotalWithMarkup y con total YA rebajado (85.000).
const web = { subtotalWithMarkup: null, total: 85_000, discountCash: null, discountTransfer: null, labNotes: 'Método de envío: Retiro. Método de pago: TRANSFER.', payments: [] };
assert.equal(v(web).real, 85_000);
assert.equal(v({ ...web, payments: [{ method: 'TRANSFERENCIA_ISHTAR', amount: 85_000 }] }).real, 85_000);
// Venta web con tarjeta: total = lista, vale a transferencia.
const webCard = { subtotalWithMarkup: null, total: LISTA, discountCash: null, discountTransfer: null, labNotes: 'Método de pago: CARD.', payments: [{ method: 'TARJETA', amount: LISTA }] };
assert.equal(v(webCard).real, TRANSF);

console.log('✔ facturado sin costo financiero: la venta entera a efectivo o a transferencia según cómo pagó; los saldos no se descuentan');
