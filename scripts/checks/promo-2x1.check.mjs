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
//   5. UN SOLO tildado en la venta: queda al 50%, sea el caro o el barato, y
//      valga solo (el otro armazón es del cliente) o junto a uno sin promo.
//      Un armazón sin tilde se cobra entero siempre. Reglas de Ishtar, 22/8/26.
//   5b. Pero TODO eso pide que el cliente se lleve los DOS pares de cristales.
//      Con un solo par no está usando el 2x1: el armazón va entero, ni gratis
//      ni al 50%. (Ishtar, 24/8/26.)
//   6. Un lente de sol tildado también puede ser el bonificado.
//
// Corre sin base y sin red.
// Correr:  npm run check:promo
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { PricingService } from '../../src/services/PricingService.ts';
import { hasActive2x1Promo, pick2x1FrameDiscount, recalculateCrystalPrices, armarParesDeCristal, applyTeñidoPromoDiscount, isTeñidoAddon, tenidoDeOtroLaboratorio, errorTenidoCruzado } from '../../src/lib/promo-utils.ts';

const cristal2x1 = (eye, precio = 305167) => ({ product: { id: 'c2x1', category: 'Cristal', type: 'Cristal Multifocal', name: 'Varilux Comfort', is2x1: true }, quantity: 1, price: precio, eye });
// La venta 2x1 REAL lleva DOS pares: uno cobrado y otro sin cargo (desde el
// par automático, agregar el cristal ya los carga a los dos). El armazón solo
// se bonifica si el cliente efectivamente se lleva los dos pares.
const dosPares2x1 = () => [cristal2x1('OD'), cristal2x1('OI'), cristal2x1('OD', 0), cristal2x1('OI', 0)];
const cristalComun = (eye) => ({ product: { id: 'comun', category: 'Cristal', type: 'Cristal Monofocal', name: 'Monofocal Orma', is2x1: false }, quantity: 1, price: 80000, eye });
const miPrimerVarilux = (eye) => ({ product: { id: 'mpv', category: 'Cristal', type: 'Cristal Multifocal', name: 'Mi Primer Varilux', is2x1: true }, quantity: 1, price: 200000, eye });
const armazon = (id, name, price, tildado, extra = {}) => ({ product: { id, category: 'Armazón de Receta', type: 'Armazón de Receta', brand: 'Atelier', name, eligible2x1: tildado, ...extra }, quantity: 1, price });
const clipOn = (id, price, tildado) => ({ product: { id, category: 'Armazón de Receta', type: 'Armazón de Receta', brand: 'Clip On', name: 'Clip On', eligible2x1: tildado }, quantity: 1, price });
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
        () => assert.equal(descuento([...dosPares2x1(), armazon('f1', 'A', 160000, false), armazon('f2', 'B', 160000, false)]), 0)],
    ['la marca NO decide: un "Atelier" sin tilde no se regala',
        () => assert.equal(descuento([...dosPares2x1(), armazon('f1', 'Orfeo C1', 160000, false), armazon('f2', 'Aquiles C1', 160000, false)]), 0)],
    ['MEZCLA: el tildado barato junto a uno sin tildar queda al 50%',
        () => assert.equal(descuento([...dosPares2x1(), armazon('f1', 'A', 160000, false), armazon('f2', 'B', 120000, true)]), 60000)],
    ['MEZCLA: el tildado caro junto a uno sin tildar también queda al 50%',
        () => assert.equal(descuento([...dosPares2x1(), armazon('f1', 'Caro', 160000, true), armazon('f2', 'Barato', 120000, false)]), 80000)],
    ['con los dos tildados se bonifica el segundo (más barato) ENTERO',
        () => assert.equal(descuento([...dosPares2x1(), armazon('f1', 'Caro', 160000, true), armazon('f2', 'Barato', 120000, true)]), 120000)],
    ['MEZCLA con lente de sol tildado: 50% del sol',
        () => assert.equal(descuento([...dosPares2x1(), armazon('f1', 'A', 160000, false), lenteSol('s1', 'Sol', 90000, true)]), 45000)],
    ['dos tildados: armazón + lente de sol → el más barato gratis entero',
        () => assert.equal(descuento([...dosPares2x1(), armazon('f1', 'A', 160000, true), lenteSol('s1', 'Sol', 90000, true)]), 90000)],
    ['el nombre de la promo avisa el 50% en la mezcla',
        () => {
            const r = pick2x1FrameDiscount([...dosPares2x1(), armazon('f1', 'A', 160000, false), armazon('f2', 'B', 120000, true)]);
            assert.ok(r.itemName?.includes('(50%)'), `itemName fue: ${r.itemName}`);
        }],
    ['armazón del cliente + UN armazón tildado comprado: 50%',
        () => assert.equal(descuento([...dosPares2x1(), armazon('f1', 'A', 120000, true)]), 60000)],
    ['armazón del cliente + UN armazón sin tildar: se cobra entero',
        () => assert.equal(descuento([...dosPares2x1(), armazon('f1', 'A', 120000, false)]), 0)],
    ['cantidad 2 del mismo armazón tildado: se bonifica una unidad',
        () => {
            const it = armazon('f1', 'A', 120000, true);
            it.quantity = 2;
            assert.equal(descuento([...dosPares2x1(), it]), 120000);
        }],
    ['pick2x1FrameDiscount banca ítems del cotizador (customPrice)',
        () => {
            const r = pick2x1FrameDiscount([
                ...dosPares2x1().map(c => ({ ...c, customPrice: c.price })),
                { product: armazon('f1', 'A', 0, true).product, quantity: 1, customPrice: 160000 },
                { product: armazon('f2', 'B', 0, true).product, quantity: 1, customPrice: 110000 },
            ]);
            assert.equal(r.discount, 110000);
        }],
    ['medio par (un solo ojo, reposición) NO enciende la promo',
        () => {
            assert.equal(hasActive2x1Promo([cristal2x1('OD')]), false);
            assert.equal(descuento([cristal2x1('OD'), armazon('f1', 'A', 120000, true)]), 0);
        }],
    ['UN SOLO par de cristales: el armazón tildado se cobra ENTERO (ni 50% ni gratis)',
        () => {
            assert.equal(descuento([cristal2x1('OD'), cristal2x1('OI'), armazon('f1', 'A', 120000, true)]), 0);
            assert.equal(descuento([cristal2x1('OD'), cristal2x1('OI'), armazon('f1', 'A', 160000, true), armazon('f2', 'B', 120000, true)]), 0);
        }],
    ['ítems SIN ojo (selects del server): un par no se puede hacer pasar por dos',
        () => {
            // Cada renglón sin `eye` cuenta como un par entero — es correcto
            // para los cristales que se venden por par. Lo que NO puede pasar
            // es que un par cargado como OD+OI pierda el ojo por el camino y
            // cuente doble: por eso todo select que alimente la promo tiene que
            // traer `eye` (order.service.ts lo perdía y activaba la promo con
            // un solo par).
            const parSinOjo = { product: cristal2x1('OD').product, quantity: 1, price: 610334 };
            assert.equal(descuento([parSinOjo, armazon('f1', 'A', 120000, true)]), 0, 'un solo par sin ojo NO bonifica');
            assert.equal(descuento([parSinOjo, { ...parSinOjo }, armazon('f1', 'A', 120000, true)]), 60000, 'dos pares sin ojo sí bonifican');
        }],
    ['CLIP-ON solo + armazón del cliente: se cobra ENTERO, no al 50%',
        () => assert.equal(descuento([...dosPares2x1(), clipOn('cl1', 200000, true)]), 0)],
    ['CLIP-ON + un armazón de la óptica que NO entra en la promo: el clip-on al 50%',
        () => assert.equal(descuento([...dosPares2x1(), armazon('f1', 'Orfeo C1', 160000, false), clipOn('cl1', 200000, true)]), 100000)],
    ['CLIP-ON acompañando a otro armazón tildado: ahí sí se bonifica',
        () => assert.equal(descuento([...dosPares2x1(), armazon('f1', 'Premium', 300000, true), clipOn('cl1', 200000, true)]), 200000)],
    ['DOS pares (el cliente sí se lleva el 2x1): ahí sí se bonifica',
        () => assert.equal(descuento([...dosPares2x1(), armazon('f1', 'A', 160000, true), armazon('f2', 'B', 120000, true)]), 120000)],
    ['ítem 2x1 sin ojo asignado cuenta como par entero (recálculo del server)',
        () => assert.equal(hasActive2x1Promo([{ product: cristal2x1('OD').product, quantity: 1, price: 610334 }]), true)],
    ['mezcla de variantes 2x1: se cobra el par más caro, va gratis el barato',
        () => {
            const caro = (eye) => ({ product: { id: 'T', category: 'Cristal', type: 'Cristal Multifocal', name: 'Varilux Transitions 2x1', is2x1: true, price: 610334 }, quantity: 1, price: 0, eye });
            const barato = (eye) => ({ product: { id: 'B', category: 'Cristal', type: 'Cristal Multifocal', name: 'Varilux Orma 2x1', is2x1: true, price: 400000 }, quantity: 1, price: 0, eye });
            const items = [caro('OD'), caro('OI'), barato('OD'), barato('OI')];
            recalculateCrystalPrices(items);
            assert.equal(items[0].price + items[1].price, 610334); // el caro, pagado
            assert.equal(items[2].price + items[3].price, 0);      // el barato, gratis
        }],
    ['agregar un cristal 2x1 arma solo el segundo par gratis (borrable)',
        () => {
            const renglones = armarParesDeCristal(cristal2x1('OD').product, []);
            assert.equal(renglones.length, 4); // par pagado + par gratis
            assert.equal(renglones.filter(r => r.isPromo && r.customPrice === 0).length, 2);
        }],
    ['si ya hay un par 2x1 sin compañero, el agregado ES el segundo par (no suma otro gratis)',
        () => {
            const prev = armarParesDeCristal(cristal2x1('OD').product, []).slice(0, 2); // borraron el par gratis
            const renglones = armarParesDeCristal({ ...cristal2x1('OD').product, id: 'otro', name: 'Varilux Orma 2x1' }, prev);
            assert.equal(renglones.length, 2); // un solo par, será el gratis al recalcular
        }],
    ['ítems rotos (product null, lista no-array) no revientan',
        () => {
            assert.equal(hasActive2x1Promo(null), false);
            assert.equal(pick2x1FrameDiscount([{ product: null, quantity: 1, price: 100 }, cristal2x1('OD')]).discount, 0);
        }],
];

// ── Teñidos (Ishtar, 16/10/2026): cada laboratorio tiñe sus cristales, y en el
// 2x1 el 2º par lleva UN teñido sin cargo, compacto/plena o degradé.
const cristalGO = (eye) => ({ product: { id: 'cgo', category: 'Cristal', type: 'Cristal Multifocal', name: 'Varilux Comfort', is2x1: true, laboratory: 'GRUPO OPTICO' }, quantity: 1, price: 300000, eye });
const cristalOpto = (eye) => ({ product: { id: 'copto', category: 'Cristal', type: 'Cristal Multifocal', name: 'Multifocal Opto 2x1', is2x1: true, laboratory: 'OPTOVISION' }, quantity: 1, price: 300000, eye });
const tenidoGO = (name, extra = {}) => ({ product: { id: 'tgo-' + name, category: 'Tratamiento', type: 'Tratamientos', name, laboratory: 'GRUPO OPTICO', price: 30000 }, quantity: 1, price: 30000, ...extra });
const colorOpto = (name, extra = {}) => ({ product: { id: 'topto-' + name, category: 'Tratamiento', type: 'Tratamientos', name, laboratory: 'OPTOVISION', price: 35073 }, quantity: 1, price: 35073, ...extra });
const dosPares = (c) => [c('OD'), c('OI'), { ...c('OD'), price: 0, isPromo: true }, { ...c('OI'), price: 0, isPromo: true }];
const precioDe = (it) => (it.customPrice !== undefined ? it.customPrice : it.price);
casos.push(
    ['las coloraciones de Optovisión SON teñidos (antes solo contaba "Teñido …")',
        () => {
            assert.equal(isTeñidoAddon({ name: 'Coloración plena — hasta tinte 1 · Optovisión', category: 'Tratamiento' }), true);
            assert.equal(isTeñidoAddon({ name: 'Teñido Compacto · Grupo Óptico', category: 'Tratamiento' }), true);
            assert.equal(isTeñidoAddon({ name: 'Multifocal fotocromático teñido', category: 'Cristal' }), false);
        }],
    ['un teñido de Grupo Óptico no entra sobre cristales de Optovisión (y al revés)',
        () => {
            assert.equal(tenidoDeOtroLaboratorio(tenidoGO('Teñido Compacto · Grupo Óptico').product, dosPares(cristalOpto)), 'OPTOVISION');
            assert.equal(tenidoDeOtroLaboratorio(colorOpto('Coloración plena · Optovisión').product, dosPares(cristalGO)), 'GRUPO OPTICO');
            assert.equal(tenidoDeOtroLaboratorio(colorOpto('Coloración plena · Optovisión').product, dosPares(cristalOpto)), null);
            // Sin cristales todavía, no hay con qué comparar: se deja agregar.
            assert.equal(tenidoDeOtroLaboratorio(tenidoGO('Teñido Compacto · Grupo Óptico').product, []), null);
            assert.match(errorTenidoCruzado([...dosPares(cristalOpto), tenidoGO('Teñido Compacto · Grupo Óptico')]), /OPTOVISION/);
            assert.equal(errorTenidoCruzado([...dosPares(cristalGO), tenidoGO('Teñido Compacto · Grupo Óptico')]), null);
        }],
    ['2x1 de Optovisión: la coloración plena del 2º par va sin cargo',
        () => {
            const items = [...dosPares(cristalOpto), colorOpto('Coloración plena — hasta tinte 1 · Optovisión')];
            applyTeñidoPromoDiscount(items, {});
            assert.equal(precioDe(items[4]), 0);
            assert.equal(items[4].isPromo, true);
        }],
    ['2x1 con DOS teñidos: se bonifica el del 2º par (el último cargado), el del 1º se cobra',
        () => {
            const items = [...dosPares(cristalGO), tenidoGO('Teñido Compacto · Grupo Óptico'), tenidoGO('Teñido Degradé · Grupo Óptico')];
            applyTeñidoPromoDiscount(items, {});
            assert.equal(precioDe(items[4]), 30000);
            assert.equal(precioDe(items[5]), 0);
        }],
    ['2x1 con DOS teñidos asignados a sus armazones: el bonificado es el del armazón que regala el 2x1',
        () => {
            const armazon = (id, price, framePosition) => ({ product: { id, category: 'Armazón', type: 'Armazón', name: 'Marco ' + id, eligible2x1: true }, quantity: 1, price, framePosition });
            const items = [...dosPares(cristalGO), armazon('a1', 100000, 'P1'), armazon('a2', 80000, 'P2'),
                tenidoGO('Teñido Degradé · Grupo Óptico', { framePosition: 'P2' }), tenidoGO('Teñido Compacto · Grupo Óptico', { framePosition: 'P1' })];
            assert.equal(pick2x1FrameDiscount(items).item.framePosition, 'P2');
            applyTeñidoPromoDiscount(items, {});
            assert.equal(precioDe(items[6]), 0, 'el del armazón bonificado (P2) va sin cargo');
            assert.equal(precioDe(items[7]), 30000, 'el del 1º par se cobra');
        }],
    ['según muestra, Aquarelle y doble color se cobran siempre, también con el 2x1',
        () => {
            for (const nombre of ['Teñido según muestra · Grupo Óptico', 'Coloración según muestra · Optovisión', 'Coloración Aquarelle · Optovisión', 'Coloración doble color · Optovisión']) {
                const t = nombre.startsWith('Teñido') ? tenidoGO(nombre) : colorOpto(nombre);
                const items = [...dosPares(nombre.startsWith('Teñido') ? cristalGO : cristalOpto), t];
                applyTeñidoPromoDiscount(items, {});
                assert.equal(precioDe(items[4]), t.product.price, nombre);
                assert.equal(items[4].isPromo, false, nombre);
            }
        }],
    ['sin 2x1, el teñido se cobra al precio del producto de SU laboratorio',
        () => {
            // Sin la marca is2x1 y sin "2x1" en el nombre (el nombre también enciende la promo).
            const sin2x1 = (c) => ['OD', 'OI'].map(eye => ({ ...c(eye), product: { ...c(eye).product, is2x1: false, name: 'Multifocal común' } }));
            const items = [...sin2x1(cristalOpto), colorOpto('Coloración degradé · Optovisión')];
            applyTeñidoPromoDiscount(items, {});
            assert.equal(precioDe(items[2]), 35073);
        }],
);

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
