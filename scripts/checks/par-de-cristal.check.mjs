// ────────────────────────────────────────────────────────────────────────────
// A QUÉ PAR VA CADA CRISTAL (lib/armazon-por-par: asignarParAlCristal).
// Desde el 19/10/2026 una venta de dos pares no se convierte ni se envía a
// fábrica sin el par de cada cristal; hasta el 22/10 no había dónde elegirlo en
// los cristales (presupuesto de Mariel Miguel, trabado). Fija que al elegir uno
// se acomoden su compañero y el par que queda, sin pisar lo ya elegido.
// Sin base ni red. Corre en CI.   npm run check:par-cristal
// ────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { asignarParAlCristal } from '../../src/lib/armazon-por-par.ts';
import { cristalesSinArmazonAsignado } from '../../src/lib/order-frames.ts';

let n = 0;
const t = (nombre, fn) => { try { fn(); n++; } catch (e) { console.error(`✗ ${nombre}`); throw e; } };
const cristal = (nombre, eye, framePosition = null) => ({ eye, framePosition, productNameSnapshot: nombre, productCategorySnapshot: 'Cristal', productTypeSnapshot: 'Cristal Multifocal', product: { name: nombre, category: 'Cristal', type: 'Cristal Multifocal' } });
const armazon = (nombre, framePosition = null) => ({ eye: null, framePosition, productNameSnapshot: nombre, productCategorySnapshot: 'Armazón de Receta', product: { name: nombre, category: 'Armazón de Receta', type: 'Armazón de Receta' } });
const aplicar = (items, cambios) => items.map((it, i) => { const c = cambios.find(x => x.idx === i); return c ? { ...it, framePosition: c.framePosition } : it; });

// El caso de Mariel: 2 armazones, 4 cristales (dos XR Transitions y dos XR Xperio), ninguno asignado.
const mariel = () => [armazon('Aquiles C1', 1), armazon('Lentes de sol', 2), cristal('XR DESIGN TRANSITIONS', 'OD'), cristal('XR DESIGN TRANSITIONS', 'OI'), cristal('XR DESIGN XPERIO', 'OD'), cristal('XR DESIGN XPERIO', 'OI')];

t('elegir el par de UN cristal acomoda a su compañero y, con un solo par libre, a los otros dos', () => {
    const items = mariel();
    assert.equal(cristalesSinArmazonAsignado({ items }).length, 4);
    const cambios = asignarParAlCristal(items, 2, 1, 2);
    const despues = aplicar(items, cambios);
    assert.deepEqual(despues.slice(2).map(x => x.framePosition), [1, 1, 2, 2]);
    assert.equal(cristalesSinArmazonAsignado({ items: despues }).length, 0, 'ya se puede convertir en venta');
});
t('nunca pisa un par ya elegido, y no adivina si quedan sueltos que no son un OD + OI', () => {
    const items = mariel(); items[4].framePosition = 1; // el Xperio OD ya dice 1º par
    const despues = aplicar(items, asignarParAlCristal(items, 2, 2, 2));
    assert.deepEqual(despues.slice(2).map(x => x.framePosition), [2, 2, 1, null], 'el compañero del Xperio no se adivina: no quedó un OD + OI suelto');
    assert.equal(asignarParAlCristal(items, 2, 2, 2).some(c => c.idx === 4), false);
});
t('con un solo armazón no hay nada que acomodar, y un armazón no usa esta regla', () => {
    assert.deepEqual(asignarParAlCristal(mariel(), 2, 1, 1), [{ idx: 2, framePosition: 1 }]);
    assert.deepEqual(asignarParAlCristal(mariel(), 0, 2, 2), [{ idx: 0, framePosition: 2 }]);
});

console.log(`check:par-cristal OK (${n} grupos)`);
