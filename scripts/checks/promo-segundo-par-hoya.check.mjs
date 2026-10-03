// ────────────────────────────────────────────────────────────────────────────
// PROMO DEL SEGUNDO PAR DE HOYA / PENTAX ("Ampliá tu visión"): la regla
// completa, caso por caso. Vive en src/lib/promo-segundo-par-hoya.ts y
// PricingService delega ahí.
//
//   1. La enciende un primer par de progresivo Hoya (LifeStyle 4, Array 2,
//      Summit, Argos) o Pentax Allfocus. Mi Primer Hoya, Nulux, Sync, Visión
//      Simple y Tact no encienden nada.
//   2. El segundo par es del mismo diseño (igual o menor valor) o un Tact.
//      Nunca más caro que el primero.
//   3. Al cliente se le descuenta DESCUENTO_SEGUNDO_PAR_HOYA % del 2º par; los
//      renglones quedan a lista y el descuento va al total (como el armazón
//      del 2x1), guardado en appliedPromoDiscount.
//   4. Un solo 2º par por venta; con varios pares, el 1º es el más caro.
//   5. Los pares se arman por armazón asignado o, sin asignar, en orden.
//
// Corre sin base y sin red. Correr: npm run check:promo-hoya
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { descuentoSegundoParHoya, paresHoya, lineaHoyaDe } from '../../src/lib/promo-segundo-par-hoya.ts';
import { PricingService, calculateQuoteTotals } from '../../src/services/PricingService.ts';
import { DESCUENTO_SEGUNDO_PAR_HOYA } from '../../src/lib/constants/descuentos.ts';
import { CATALOGO_VITOLEN } from '../../src/services/lab-modules/vitolen/catalogo.ts';

let fallas = 0;
const ok = (desc, fn) => {
    try { fn(); console.log(`  ✅ ${desc}`); }
    catch (e) { fallas++; console.log(`  ❌ ${desc}\n     ${e.message}`); }
};

let uid = 1;
const par = (nombre, precioPar, extra = {}) => ['OD', 'OI'].map(eye => ({
    product: { id: nombre, category: 'Cristal', type: 'Cristal Multifocal', name: nombre },
    quantity: 1, customPrice: Math.round(precioPar / 2), eye, uid: uid++, ...extra,
}));
const ARRAY_150 = 'HOYA ARRAY 2 - 1.50 CLEAR BLUE FILTER';
const ARRAY_167 = 'HOYA ARRAY 2 - 1.67 CLEAR';
const SUMMIT = 'HOYA SUMMIT - 1.50 CLEAR BLUE FILTER';
const TACT = 'HOYA TACT BKS - 1.50 CLEAR BLUE FILTER';
const MPH = CATALOGO_VITOLEN.find(c => c.linea === 'mph-array-2').nombre;
const NULUX = 'HOYA NULUX IDENTITY V+ - 1.60 CLEAR';
const armazon = (precio) => ({ product: { id: 'arm', category: 'Armazón de Receta', type: 'Armazón de Receta', name: 'Vulk Roma', eligible2x1: false }, quantity: 1, customPrice: precio, uid: uid++ });

console.log('\n— Qué enciende la promo —');
ok('el catálogo reconoce las líneas por nombre', () => {
    assert.equal(lineaHoyaDe({ product: { name: ARRAY_150, category: 'Cristal' } }), 'array-2');
    assert.equal(lineaHoyaDe({ product: { name: TACT, category: 'Cristal' } }), 'tact');
    assert.equal(lineaHoyaDe({ productNameSnapshot: SUMMIT }), 'summit');
    assert.equal(lineaHoyaDe({ product: { name: 'VARILUX COMFORT', category: 'Cristal' } }), null);
    assert.equal(lineaHoyaDe({ product: { name: ARRAY_150, category: 'Armazón de Receta' } }), null, 'un armazón con nombre raro no es cristal');
});
ok('dos pares Array 2 iguales: el 2º va con el descuento sobre su precio', () => {
    const items = [...par(ARRAY_150, 1364274, { framePosition: 1 }), ...par(ARRAY_150, 1364274, { framePosition: 2 })];
    const r = descuentoSegundoParHoya(items);
    assert.equal(r.discount, Math.round(1364274 * DESCUENTO_SEGUNDO_PAR_HOYA / 100));
    assert.equal(r.segundoPar.framePosition, 2);
    assert.equal(r.uids.length, 2);
    assert.match(r.itemName, /2º par Hoya/);
});
ok('el 2º par puede ser un material más barato del mismo diseño, o un Tact; nunca más caro', () => {
    const barato = descuentoSegundoParHoya([...par(ARRAY_167, 2000000), ...par(ARRAY_150, 1364274)]);
    assert.equal(barato.discount, Math.round(1364274 * 0.8));
    assert.equal(barato.segundoPar.nombre, ARRAY_150);
    const alReves = descuentoSegundoParHoya([...par(ARRAY_150, 1364274), ...par(ARRAY_167, 2000000)]);
    assert.equal(alReves.discount, Math.round(1364274 * 0.8), 'el 1º es el más caro, da igual el orden');
    const tact = descuentoSegundoParHoya([...par(SUMMIT, 1500000), ...par(TACT, 900000)]);
    assert.equal(tact.discount, Math.round(900000 * 0.8));
    const soloTact = descuentoSegundoParHoya([...par(TACT, 900000), ...par(TACT, 900000)]);
    assert.equal(soloTact.discount, 0, 'Tact no enciende la promo');
});
ok('distinto diseño no entra; Mi Primer Hoya, Nulux y un solo par tampoco', () => {
    assert.equal(descuentoSegundoParHoya([...par(ARRAY_150, 1364274), ...par(SUMMIT, 1300000)]).discount, 0);
    assert.equal(descuentoSegundoParHoya([...par(MPH, 800000), ...par(MPH, 800000)]).discount, 0);
    assert.equal(descuentoSegundoParHoya([...par(NULUX, 700000), ...par(NULUX, 700000)]).discount, 0);
    assert.equal(descuentoSegundoParHoya([...par(ARRAY_150, 1364274)]).discount, 0);
    assert.equal(descuentoSegundoParHoya([...par(ARRAY_150, 1364274), par(ARRAY_150, 1364274)[0]]).discount, 0, 'medio par no es un par');
    assert.equal(descuentoSegundoParHoya([]).discount, 0);
});
ok('sin armazón asignado los pares se arman en orden; tres pares = un solo 2º', () => {
    const pares = paresHoya([...par(ARRAY_150, 100), ...par(ARRAY_150, 100), ...par(ARRAY_150, 100)]);
    assert.equal(pares.length, 3);
    assert.ok(pares.every(p => p.completo));
    const r = descuentoSegundoParHoya([...par(ARRAY_150, 100), ...par(ARRAY_150, 100), ...par(ARRAY_150, 100)]);
    assert.equal(r.discount, 80);
});

console.log('\n— PricingService y el total de la venta —');
ok('el descuento baja el subtotal y queda nombrado; el armazón no cambia', () => {
    const items = [...par(ARRAY_150, 1000000, { framePosition: 1 }), ...par(ARRAY_150, 800000, { framePosition: 2 }), armazon(200000)];
    const t = calculateQuoteTotals(items, 0, 0, [], 0);
    assert.equal(t.rawSubtotal, 2000000);
    assert.equal(t.promoLensDiscount, 640000);
    assert.equal(t.promoFrameDiscount, 0);
    assert.equal(t.promoDiscount, 640000);
    assert.equal(t.subtotal, 1360000);
    assert.equal(t.subtotalWithMarkup, 1360000);
    assert.match(t.appliedPromoName, /2º par Hoya/);
    const r = PricingService.calculateTotals(items.map(i => ({ productId: i.product.id, product: i.product, quantity: 1, price: i.customPrice, eye: i.eye, framePosition: i.framePosition ?? null })), 0, 0, [], 0);
    assert.deepEqual(r.appliedPromos, [`Hoya: 2º par -${DESCUENTO_SEGUNDO_PAR_HOYA}%`]);
});
ok('sin segundo par no hay descuento ni nombre', () => {
    const t = calculateQuoteTotals([...par(ARRAY_150, 1000000), armazon(200000)], 0, 0, [], 0);
    assert.equal(t.promoLensDiscount, 0);
    assert.equal(t.promoDiscount, 0);
    assert.equal(t.appliedPromoName, null);
    assert.equal(t.subtotal, 1200000);
});
ok('el markup y el descuento por efectivo se aplican sobre el subtotal ya bonificado', () => {
    const items = [...par(ARRAY_150, 1000000, { framePosition: 1 }), ...par(ARRAY_150, 1000000, { framePosition: 2 })];
    const t = calculateQuoteTotals(items, 10, 15, [], 0);
    assert.equal(t.subtotal, 1200000);
    assert.equal(t.subtotalWithMarkup, 1320000);
    assert.equal(t.totalCash, 1122000);
});

console.log(fallas === 0 ? '\n✅ Promo del segundo par de Hoya: todo en orden.\n' : `\n❌ ${fallas} falla(s).\n`);
process.exit(fallas === 0 ? 0 : 1);
