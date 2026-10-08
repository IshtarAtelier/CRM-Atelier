// ────────────────────────────────────────────────────────────────────────────
// 2x1: EL PAR BONIFICADO TIENE QUE VENIR SIN CARGO (regla de Ishtar, 25/9/2026).
//
// "Siempre que esté tildado el 2x1 en cristales, SIEMPRE tiene que haber uno
// sin costo o con costos mínimos que no superen 30.000". Este check fija la
// regla tal como la aplica el cruce (src/services/lab-recon/cost-matching.ts):
//
//   1. El costo de sistema de una venta 2x1 cuenta UN par: el bonificado va en $0.
//   2. Con los dos pedidos facturados, el más barato tiene que estar dentro del
//      tope (TOPE_PAR_BONIFICADO_2X1). Si hasta ese vino por encima, el lab
//      cobró el par bonificado → SOBRECOSTO aunque la SUMA cierre.
//   3. Con un solo pedido facturado no hay veredicto (un par por el precio de
//      dos es el 2x1 funcionando).
//   4. La marca en la nota se saca y se vuelve a poner en cada cruce.
//
// Caso real de referencia: Gabriela Peralta, 21/9/2026 (Optovisión), pedidos
// 619486 ($288.380) y 619492 ($25.410) contra un sistema de $370.399.
//
// Corre sin base y sin red.
// Correr:  npm run check:par-bonificado
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { esVenta2x1, parBonificadoCobrado, systemCostForLab, segundoParDePromoVitolen } from '../../src/services/lab-recon/cost-matching.ts';
import { importeEsperadoSegundoPar, segundoParCobradoDeMas } from '../../src/services/lab-modules/vitolen/promo.ts';
import { MARCA_SEGUNDO_PAR_PROMO_COBRADO } from '../../src/lib/lab-factura.ts';
import { TOPE_PAR_BONIFICADO_2X1 } from '../../src/services/lab-recon/types.ts';
import { MARCA_PAR_BONIFICADO_COBRADO, estaResuelta, sinNotaParBonificado, tieneParBonificadoCobrado } from '../../src/lib/lab-factura.ts';

const cristal = (eye, price, cost = 370399) => ({
    eye, price, quantity: 1,
    productCategorySnapshot: 'Cristal', productNameSnapshot: 'Varilux Comfort Max 2x1',
    laboratorySnapshot: 'Optovision', productCostSnapshot: cost,
});
const armazon = (price, cost) => ({
    eye: null, price, quantity: 1,
    productCategorySnapshot: 'Armazón de Receta', productNameSnapshot: 'Nashira Negro',
    laboratorySnapshot: null, productCostSnapshot: cost,
});
/** La venta 2x1 tal como la guarda el servidor: dos pares, el segundo en $0. */
const venta2x1 = () => ({
    appliedPromoName: null,
    labOrderNumber: '619486-619492',
    items: [cristal('OD', 185000), cristal('OI', 185000), cristal('OD', 0), cristal('OI', 0), armazon(120000, 40000)],
});
const ventaUnPar = () => ({
    appliedPromoName: null,
    labOrderNumber: '620277',
    items: [cristal('OD', 185000), cristal('OI', 185000), armazon(120000, 40000)],
});


/** Vitolen con la promo del 2º par del CRM: dos pares del mismo diseño a precio de lista, el par 2 más barato. */
const cristalVitolen = (eye, fp, price, baseCost, cost) => ({
    eye, price, quantity: 1, framePosition: fp,
    productCategorySnapshot: 'Cristal', productNameSnapshot: 'HOYA LIFESTYLE 4 - 1.50 CLEAR',
    laboratorySnapshot: 'Vitolen', productCostSnapshot: cost,
    product: { name: 'HOYA LIFESTYLE 4 - 1.50 CLEAR', category: 'Cristal', laboratory: 'Vitolen', cost, baseCost },
});
const ventaVitolen = () => ({
    appliedPromoName: '2º par Hoya (HOYA LIFESTYLE 4 - 1.50 CLEAR) -80%',
    labOrderNumber: '6981382-6981390',
    __labConfig: { calibrado: 10000, iva: 21 },
    items: [cristalVitolen('OD', 1, 250000, 220000, 300000), cristalVitolen('OI', 1, 250000, 220000, 300000),
        cristalVitolen('OD', 2, 180000, 200000, 300000), cristalVitolen('OI', 2, 180000, 200000, 300000), armazon(120000, 40000)],
});

const casos = [
    ['una venta con el segundo par en $0 es 2x1',
        () => assert.equal(esVenta2x1(venta2x1()), true)],
    ['un solo par del mismo cristal NO es 2x1 (el cliente no se llevó el segundo)',
        () => assert.equal(esVenta2x1(ventaUnPar()), false)],
    ['la promo aplicada también la enciende',
        () => assert.equal(esVenta2x1({ appliedPromoName: '2x1 Multifocal (Armazón Bonificado)', items: [] }), true)],
    ['el costo de sistema del 2x1 cuenta UN par (370.399), no dos',
        () => assert.equal(systemCostForLab(venta2x1(), 'OPTOVISION'), 370399)],
    ['el costo de sistema de un par solo es el mismo par',
        () => assert.equal(systemCostForLab(ventaUnPar(), 'OPTOVISION'), 370399)],
    ['sin ítems del lab pedido cae a los cristales (respaldo histórico), nunca al armazón',
        () => assert.equal(systemCostForLab(venta2x1(), 'GRUPO_OPTICO'), 370399)],

    ['Gabriela Peralta: $288.380 + $25.410 → el par bonificado vino a $25.410, dentro del tope: NO se cobró',
        () => assert.deepEqual(parBonificadoCobrado([288380, 25410]), { cobrado: false, masBarato: 25410 })],
    ['Optovisión cobra el segundo par $5: sin cargo',
        () => assert.equal(parBonificadoCobrado([299875, 5]).cobrado, false)],
    ['$200.000 + $170.000: la suma cierra contra $370.399 pero el par bonificado se cobró entero',
        () => assert.deepEqual(parBonificadoCobrado([200000, 170000]), { cobrado: true, masBarato: 170000 })],
    ['los dos pares cobrados enteros (caso Grupo Óptico del 8/9): cobrado',
        () => assert.equal(parBonificadoCobrado([187746, 187746]).cobrado, true)],
    ['justo en el tope se acepta; un peso más, no',
        () => {
            assert.equal(parBonificadoCobrado([300000, TOPE_PAR_BONIFICADO_2X1]).cobrado, false);
            assert.equal(parBonificadoCobrado([300000, TOPE_PAR_BONIFICADO_2X1 + 1]).cobrado, true);
        }],
    ['con un solo pedido facturado no hay veredicto',
        () => assert.deepEqual(parBonificadoCobrado([370399]), { cobrado: false, masBarato: null })],
    ['sin pedidos tampoco',
        () => assert.deepEqual(parBonificadoCobrado([]), { cobrado: false, masBarato: null })],
    ['el tope es $30.000 (Ishtar, 25/9/2026)',
        () => assert.equal(TOPE_PAR_BONIFICADO_2X1, 30000)],

    ['la marca se reconoce en la nota',
        () => assert.equal(tieneParBonificadoCobrado(`Venta 2x1 con 2 pedidos. [${MARCA_PAR_BONIFICADO_COBRADO}: a reclamar $170.000]`), true)],
    ['la marca se saca entera y el resto de la nota queda',
        () => assert.equal(
            sinNotaParBonificado(`Venta 2x1 con 2 pedidos de lab (1-2). [${MARCA_PAR_BONIFICADO_COBRADO}: el más barato (2) costó $170.000; a reclamar $170.000] Enganchado por planilla.`),
            'Venta 2x1 con 2 pedidos de lab (1-2). Enganchado por planilla.')],
    ['una nota sin marca no se toca; vacía queda null',
        () => {
            assert.equal(sinNotaParBonificado('Pedido visto en el portal.'), 'Pedido visto en el portal.');
            assert.equal(sinNotaParBonificado(`[${MARCA_PAR_BONIFICADO_COBRADO}: x]`), null);
            assert.equal(sinNotaParBonificado(null), null);
        }],

    // ── Resuelto a mano: deja de salir en los avisos (Ishtar, 25/9/2026) ──
    ['una entrada con resolvedAt está resuelta',
        () => assert.equal(estaResuelta({ resolvedAt: new Date(), notes: null }), true)],
    ['sin resolvedAt y sin nota de resolución, sigue abierta',
        () => assert.equal(estaResuelta({ resolvedAt: null, notes: 'Pedido visto en el portal.' }), false)],
    ['las resoluciones en código (RESUELTO/RECLAMADO al inicio de la nota) cuentan como resueltas',
        () => {
            assert.equal(estaResuelta({ resolvedAt: null, notes: 'RESUELTO 16/7/2026: el vendedor lo cargó a costo de Atelier.' }), true);
            assert.equal(estaResuelta({ resolvedAt: null, notes: 'RECLAMADO a Grupo Óptico el 8/9/2026 (2x1 con los dos pares cobrados).' }), true);
        }],
    ['una nota que solo MENCIONA "reclamado" en el medio no resuelve nada',
        () => assert.equal(estaResuelta({ resolvedAt: null, notes: 'La venta tiene 2 pedidos; el cliente dice que fue reclamado.' }), false)],
    // ── VITOLEN: el 2º par de la promo NO es gratis, va al 20 % de lista + calibrado (Ishtar, 8/10/2026) ──
    ['Vitolen con la promo del 2º par: el 2º es el de MENOR valor de lista y se espera al 20 % + calibrado (con IVA)',
        () => {
            const v = ventaVitolen();
            const s = segundoParDePromoVitolen(v);
            assert.equal(s.pair, 2); assert.equal(s.nombre, 'HOYA LIFESTYLE 4 - 1.50 CLEAR');
            assert.equal(s.esperado, importeEsperadoSegundoPar(200000, { calibrado: 10000, iva: 21 })); // (40.000 + 10.000) × 1,21 = 60.500
            assert.equal(s.esperado, 60500);
        }],
    ['Vitolen: el costo de sistema cuenta el 1er par entero y el 2º al 20 % + calibrado',
        () => assert.equal(systemCostForLab(ventaVitolen(), 'VITOLEN'), 300000 + 60500)],
    ['Vitolen: si el par 1 es el más barato, el 2º de la promo es el par 1',
        () => { const v = ventaVitolen(); v.items.forEach(i => { if (i.productCategorySnapshot === 'Cristal') i.price = i.framePosition === 1 ? 100000 : 180000; }); assert.equal(segundoParDePromoVitolen(v).pair, 1); }],
    ['Vitolen sin promo aplicada (dos pares comprados aparte): nada que esperar, cada par entero',
        () => { const v = ventaVitolen(); v.appliedPromoName = null; assert.equal(segundoParDePromoVitolen(v), null); assert.equal(systemCostForLab(v, 'VITOLEN'), 600000); }],
    ['Vitolen sin el pelado (baseCost) del cristal: no se puede valuar, se cuenta entero y no se acusa',
        () => { const v = ventaVitolen(); v.items.forEach(i => { if (i.product) i.product.baseCost = null; }); assert.equal(segundoParDePromoVitolen(v).esperado, null); assert.equal(systemCostForLab(v, 'VITOLEN'), 600000); }],
    ['Vitolen: $300.000 + $60.500 es la promo cumplida; $300.000 + $90.000 es el 2º par cobrado de más (5 % de tolerancia)',
        () => {
            assert.equal(segundoParCobradoDeMas(60500, 60500), false);
            assert.equal(segundoParCobradoDeMas(63000, 60500), false);
            assert.equal(segundoParCobradoDeMas(90000, 60500), true);
            assert.equal(segundoParCobradoDeMas(300000, 60500), true);
        }],
    ['la marca del 2º par cobrado de más se limpia de la nota igual que la del par bonificado',
        () => assert.equal(sinNotaParBonificado(`Caso: Juan [${MARCA_SEGUNDO_PAR_PROMO_COBRADO}: el pedido más barato costó $ 90.000; a reclamar $ 29.500]`), 'Caso: Juan')],
];

let fallas = 0;
for (const [nombre, fn] of casos) {
    try { fn(); console.log(`  ✓ ${nombre}`); }
    catch (e) { fallas++; console.log(`  ✗ ${nombre}\n      ${e.message.split('\n')[0]}`); }
}
console.log(fallas ? `\n${fallas} caso(s) fallaron` : `\n${casos.length} casos OK`);
process.exit(fallas ? 1 : 0);
