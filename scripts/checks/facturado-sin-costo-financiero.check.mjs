// ────────────────────────────────────────────────────────────────────────────
// Facturado SIN costo financiero (regla de Ishtar, 3/10/2026). SIN BASE y SIN
// RED: importa el PricingService REAL y lo prueba con ventas de juguete.
//
// Qué protege:
//  - Efectivo y transferencia valen lo cobrado, tal cual.
//  - Tarjeta (3, 6, 12 cuotas, Payway, MP, Naranja) vale lo que esa parte
//    hubiera valido POR TRANSFERENCIA. MP 12 primero saca el +10% que trae adentro.
//  - El saldo no cobrado se valúa a transferencia (independiente de los saldos).
//  - costoFinanciero = cobrado nominal − valor real de lo cobrado, nunca negativo
//    para efectivo/transferencia (ahí es cero).
//  - La misma venta vale lo mismo pagada en 3, 6 o 12: el objetivo no premia la tarjeta.
//
// Correr:  npm run check:sin-cf
// ────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { PricingService } from '../../src/services/PricingService.ts';

const LISTA = 100_000;
const venta = (payments) => ({ subtotalWithMarkup: LISTA, total: LISTA, discountCash: 20, discountTransfer: 15, payments });
const TRANSF = LISTA * 0.85; // 85.000

// Efectivo completo: vale lo cobrado (80.000), sin costo financiero.
let v = PricingService.valorSinCostoFinanciero(venta([{ method: 'EFECTIVO', amount: 80_000 }]));
assert.equal(v.real, 80_000); assert.equal(v.costoFinanciero, 0); assert.equal(v.saldoReal, 0);

// Transferencia completa: 85.000.
v = PricingService.valorSinCostoFinanciero(venta([{ method: 'TRANSFERENCIA_ISHTAR', amount: 85_000 }]));
assert.equal(v.real, TRANSF); assert.equal(v.costoFinanciero, 0);

// Tarjeta 6 cuotas a lista: cobrado 100.000, vale 85.000, costo financiero 15.000.
v = PricingService.valorSinCostoFinanciero(venta([{ method: 'MERCADO_PAGO_6_ISH', amount: LISTA }]));
assert.equal(v.real, TRANSF); assert.equal(v.cobradoNominal, LISTA); assert.equal(v.costoFinanciero, 15_000);

// Payway 3 y Naranja: misma regla.
for (const method of ['PAY_WAY_3_ISH', 'NARANJA_Z_YANI', 'TARJETA']) {
    v = PricingService.valorSinCostoFinanciero(venta([{ method, amount: LISTA }]));
    assert.equal(v.real, TRANSF, method);
}

// MP 12: el cliente paga 110.000 (lista × 1,10). Vale 85.000; costo financiero 25.000.
v = PricingService.valorSinCostoFinanciero(venta([{ method: 'MERCADO_PAGO_12_ISH', amount: 110_000 }]));
assert.equal(v.real, TRANSF); assert.equal(v.costoFinanciero, 25_000);

// Sin ningún pago: saldo entero a transferencia. Independiente de los saldos.
v = PricingService.valorSinCostoFinanciero(venta([]));
assert.equal(v.real, TRANSF); assert.equal(v.cobradoNominal, 0); assert.equal(v.saldoReal, TRANSF);

// Mixta: seña 20.000 en efectivo (= 25.000 de lista) + resto sin cobrar.
v = PricingService.valorSinCostoFinanciero(venta([{ method: 'EFECTIVO', amount: 20_000 }]));
assert.equal(v.cobradoReal, 20_000);
assert.equal(v.saldoReal, Math.round(75_000 * 0.85));
assert.equal(v.real, 20_000 + Math.round(75_000 * 0.85));

// Descuento propio de la venta (no un 15% plano): transferencia 10%.
v = PricingService.valorSinCostoFinanciero({ ...venta([{ method: 'PAY_WAY_6_ISH', amount: LISTA }]), discountTransfer: 10 });
assert.equal(v.real, 90_000);

// Failsafe: `paid` sin filas de pago se toma tal cual.
v = PricingService.valorSinCostoFinanciero({ ...venta([]), paid: 50_000 });
assert.equal(v.cobradoNominal, 50_000); assert.equal(v.real, 50_000 + Math.round(50_000 * 0.85));

console.log('✔ facturado sin costo financiero: efectivo/transferencia tal cual, tarjeta a transferencia, saldo a transferencia');
