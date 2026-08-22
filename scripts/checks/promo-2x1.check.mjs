// ────────────────────────────────────────────────────────────────────────────
// PROMO 2x1 DE MULTIFOCALES: la regla completa, caso por caso.
//
// La regla vive en UN solo lugar (src/lib/promo-utils.ts: hasActive2x1Promo +
// pick2x1FrameDiscount) y PricingService delega ahí. Este check la fija:
//
//   1. La promo la enciende un CRISTAL con 2x1 (nunca un armazón solo).
//   2. Mi Primer Varilux no la enciende.
//   3. El armazón bonificado se TILDA a mano en Stock (eligible2x1).
//      Sin tilde no se regala nada — ni por marca, ni por promedio, ni por
//      ninguna otra deducción. Esa deducción existió y regaló armazones de la
//      tienda web de $160.000 a $35.143.
//   4. Con DOS o más tildados: el más caro de la venta se cobra siempre y el
//      bonificado va sin cargo ENTERO.
//   5. MEZCLA (un tildado + otro sin tildar): el tildado queda al 50%, sea el
//      caro o el barato. Regla pedida por Ishtar el 22/8/26.
//   6. Un lente de sol tildado también puede ser el bonificado.
//
// Corre sin base y sin red.
// Correr:  npm run check:promo
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { PricingService } from '../../src/services/PricingService.ts';
import { hasActive2x1Promo, pick2x1FrameDiscount } from '../../src/lib/promo-utils.ts';

const cristal2x1 = (eye) => ({ product: { id: 'c' + eye, category: 'Cristal', type: 'Cristal Multifocal', name: 'Varilux Comfort', is2x1: true }, quantity: 1, price: 305167, eye });
const cristalComun = (eye) => ({ product: { id: 'm' + eye, category: 'Cristal', type: 'Cristal Monofocal', name: 'Monofocal Orma', is2x1: false }, quantity: 1, price: 80000, eye });
const miPrimerVarilux = (eye) => ({ product: { id: 'v' + eye, category: 'Cristal', type: 'Cristal Multifocal', name: 'Mi Primer Varilux', is2x1: true }, quantity: 1, price: 200000, eye });
const armazon = (id, name, price, tildado, extra = {}) => ({ product: { id, category: 'Armazón de Receta', type: 'Armazón de Receta', brand: 'Atelier', name, eligible2x1: tildado, ...extra }, quantity: 1, price });
const lenteSol = (id, name, price, tildado) => ({ product: { id, category: 'Lentes de Sol', type: 'Lentes de Sol', brand: 'Vulk', name, eligible2x1: tildado }, quantity: 1, price });

const descuento = (items) => PricingService.calculateTotals(items, 0, 0, []).promoFrameDiscount;

const casos = [
    ['la promo la enciende un cristal 2x1, no un armazón',
        () => assert.equal(hasActive2x1Promo([armazon('f1', 'A', 100000, true)]), false)],
    ['Mi Primer Varilux no la enciende',
        () => assert.equal(hasActive2x1Promo([miPrimerVarilux('OD')]), false)],
    ['sin cristal 2x1 no se bonifica nada, aunque haya tildados',
        () => assert.equal(descuento([cristalComun('OD'), cristalComun('OI'), armazon('f1', 'A', 160000, true), armazon('f2', 'B', 120000, true)]), 0)],
    ['con promo pero SIN armazones tildados: se cobran los dos enteros',
        () => assert.equal(descuento([cristal2x1('OD'), cristal2x1('OI'), armazon('f1', 'A', 160000, false), armazon('f2', 'B', 160000, false)]), 0)],
    ['la marca NO decide: un "Atelier" sin tilde no se regala',
        () => assert.equal(descuento([cristal2x1('OD'), cristal2x1('OI'), armazon('f1', 'Orfeo C1', 160000, false), armazon('f2', 'Aquiles C1', 160000, false)]), 0)],
    ['MEZCLA: el tildado barato junto a uno sin tildar queda al 50%',
        () => assert.equal(descuento([cristal2x1('OD'), cristal2x1('OI'), armazon('f1', 'A', 160000, false), armazon('f2', 'B', 120000, true)]), 60000)],
    ['MEZCLA: el tildado caro junto a uno sin tildar también queda al 50%',
        () => assert.equal(descuento([cristal2x1('OD'), cristal2x1('OI'), armazon('f1', 'Caro', 160000, true), armazon('f2', 'Barato', 120000, false)]), 80000)],
    ['con los dos tildados se bonifica el segundo (más barato) ENTERO',
        () => assert.equal(descuento([cristal2x1('OD'), cristal2x1('OI'), armazon('f1', 'Caro', 160000, true), armazon('f2', 'Barato', 120000, true)]), 120000)],
    ['MEZCLA con lente de sol tildado: 50% del sol',
        () => assert.equal(descuento([cristal2x1('OD'), cristal2x1('OI'), armazon('f1', 'A', 160000, false), lenteSol('s1', 'Sol', 90000, true)]), 45000)],
    ['dos tildados: armazón + lente de sol → el más barato gratis entero',
        () => assert.equal(descuento([cristal2x1('OD'), cristal2x1('OI'), armazon('f1', 'A', 160000, true), lenteSol('s1', 'Sol', 90000, true)]), 90000)],
    ['el nombre de la promo avisa el 50% en la mezcla',
        () => {
            const r = pick2x1FrameDiscount([cristal2x1('OD'), armazon('f1', 'A', 160000, false), armazon('f2', 'B', 120000, true)]);
            assert.ok(r.itemName?.includes('(50%)'), `itemName fue: ${r.itemName}`);
        }],
    ['un solo armazón: nada que bonificar',
        () => assert.equal(descuento([cristal2x1('OD'), cristal2x1('OI'), armazon('f1', 'A', 120000, true)]), 0)],
    ['cantidad 2 del mismo armazón tildado: se bonifica una unidad',
        () => {
            const it = armazon('f1', 'A', 120000, true);
            it.quantity = 2;
            assert.equal(descuento([cristal2x1('OD'), cristal2x1('OI'), it]), 120000);
        }],
    ['pick2x1FrameDiscount banca ítems del cotizador (customPrice)',
        () => {
            const r = pick2x1FrameDiscount([
                { ...cristal2x1('OD'), customPrice: 305167 },
                { product: armazon('f1', 'A', 0, true).product, quantity: 1, customPrice: 160000 },
                { product: armazon('f2', 'B', 0, true).product, quantity: 1, customPrice: 110000 },
            ]);
            assert.equal(r.discount, 110000);
        }],
    ['ítems rotos (product null, lista no-array) no revientan',
        () => {
            assert.equal(hasActive2x1Promo(null), false);
            assert.equal(pick2x1FrameDiscount([{ product: null, quantity: 1, price: 100 }, cristal2x1('OD')]).discount, 0);
        }],
];

let fallas = 0;
for (const [nombre, fn] of casos) {
    try {
        fn();
        console.log(`  ✅ ${nombre}`);
    } catch (e) {
        fallas++;
        console.error(`  ❌ ${nombre}\n     ${e.message}`);
    }
}

if (fallas > 0) {
    console.error(`\n❌ ${fallas} caso(s) de la promo 2x1 rotos.`);
    process.exit(1);
}
console.log(`\n✅ Promo 2x1: los ${casos.length} casos dan lo esperado.`);
