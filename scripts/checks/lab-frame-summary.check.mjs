// ────────────────────────────────────────────────────────────────────────────
// Verificación del resumen de armazón/medidas/teñido (lab-frame-summary.ts).
// Caso real (28/7/2026): el origen del armazón no aparecía en "la venta", el
// segundo par de un 2x1 era invisible en todos lados, y el teñido no salía en
// el PDF que recibe el cliente ni decía a qué par correspondía.
//
// Correr:  node --experimental-strip-types scripts/checks/lab-frame-summary.check.mjs
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import {
  isTwoPairOrder,
  tintServiceCount,
  frameOriginLabel,
  measurementsLabel,
  describeLabFrameDetails,
} from '../../src/lib/lab-frame-summary.ts';

let passed = 0;
const check = (name, cond) => {
  assert.ok(cond, `FALLÓ: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
};

console.log('\nResumen de armazón, medidas y teñido\n');

const tenido = { product: { name: 'Teñido', category: 'Tratamiento', type: 'Tratamientos' } };

// — Detección de 2x1 —
check('2x1 por nombre de promo', isTwoPairOrder({ appliedPromoName: 'Promo 2x1 Verano' }));
check('2x1 por nombre de producto en el ítem', isTwoPairOrder({
  items: [{ product: { name: 'Armazón Ray-Ban 2x1' } }]
}));
check('un pedido de un solo par no es 2x1', !isTwoPairOrder({ items: [tenido] }));

// — Conteo de teñido —
check('sin líneas de teñido → 0', tintServiceCount({ items: [] }) === 0);
check('una línea de teñido → 1', tintServiceCount({ items: [tenido] }) === 1);
check('dos líneas de teñido → 2', tintServiceCount({ items: [tenido, tenido] }) === 2);

// — Origen del armazón —
check('OPTICA → "De la óptica"', frameOriginLabel({ frameSource: 'OPTICA' }) === 'De la óptica');
check('USUARIO con marca y modelo', frameOriginLabel({
  frameSource: 'USUARIO', userFrameBrand: 'Ray-Ban', userFrameModel: 'RB2140'
}) === 'Del cliente — Ray-Ban RB2140');
check('USUARIO sin marca ni modelo cargados', frameOriginLabel({ frameSource: 'USUARIO' }) === 'Del cliente');
check('sin frameSource → null', frameOriginLabel({}) === null);

// — Medidas —
check('las 4 medidas juntas', measurementsLabel('52', '38', '18', '13') === 'A: 52  B: 38  ED: 13  Pte: 18');
check('solo alguna medida cargada', measurementsLabel('52', null, null, null) === 'A: 52');
check('ninguna medida → null', measurementsLabel(null, null, null, null) === null);

// — Resumen completo: pedido de un solo par —
{
  const s = describeLabFrameDetails({
    frameSource: 'OPTICA',
    labFrameShape: 'Ovalado', frameA: '52', frameB: '38', frameDbl: '18', frameEdc: '13',
    labColor: 'Gris Oscuro (Grado: 80%)', labTreatment: 'Teñido',
    labNotes: 'Cliente pidió antirreflejo extra',
    items: [tenido]
  });
  check('un solo par → un elemento en pairs', s.pairs.length === 1);
  check('la etiqueta del único par es genérica ("Armazón")', s.pairs[0].label === 'Armazón');
  check('origen presente', s.origin === 'De la óptica');
  check('teñido presente y con el texto combinado', s.tint?.text === 'Teñido - Gris Oscuro (Grado: 80%)');
  check('con un solo par, el teñido NUNCA es ambiguo', s.tint?.ambiguousPair === false);
  check('notas presentes', s.notes === 'Cliente pidió antirreflejo extra');
  check('no está vacío', s.isEmpty === false);
}

// — Resumen completo: 2x1 con teñido en un solo par (AMBIGUO) —
{
  const s = describeLabFrameDetails({
    appliedPromoName: 'Promo 2x1',
    frameSource: 'USUARIO', userFrameBrand: 'Vulk', userFrameModel: 'Modelo A',
    labFrameShape: 'Redondo', frameA: '50', frameB: '36', frameDbl: '17', frameEdc: '12',
    labFrameShape2: 'Cuadrado', frameA2: '54',
    labColor: 'Azul', labTreatment: 'Teñido',
    items: [tenido]
  });
  check('2x1 → dos elementos en pairs', s.pairs.length === 2);
  check('el primer par se llama "Par 1"', s.pairs[0].label.includes('Par 1'));
  check('el segundo par se llama "Par 2" y marca que es bonificado', s.pairs[1].label.includes('Par 2') && s.pairs[1].label.toLowerCase().includes('bonificado'));
  check('el par 2 no está vacío (tiene forma y medida A cargadas)', s.pairs[1].isEmpty === false);
  check('el par 2 solo muestra la medida A que se cargó', s.pairs[1].measurements === 'A: 54');
  check('CON 2x1 y una sola línea de teñido, se marca AMBIGUO', s.tint?.ambiguousPair === true);
}

// — Resumen completo: 2x1 con teñido en LOS DOS pares (sin ambigüedad) —
{
  const s = describeLabFrameDetails({
    appliedPromoName: 'Promo 2x1',
    labFrameShape: 'Redondo', labFrameShape2: 'Cuadrado',
    labColor: 'Azul', labTreatment: 'Teñido',
    items: [tenido, tenido]
  });
  check('2x1 con DOS líneas de teñido → NO es ambiguo', s.tint?.ambiguousPair === false);
}

// — Pedido sin nada cargado —
{
  const s = describeLabFrameDetails({ items: [] });
  check('sin ningún dato cargado, isEmpty es true', s.isEmpty === true);
  check('el único par figura vacío', s.pairs[0].isEmpty === true);
  check('sin teñido, tint es null', s.tint === null);
}

console.log(`\n✅ ${passed} checks OK — resumen de armazón/medidas/teñido blindado\n`);
