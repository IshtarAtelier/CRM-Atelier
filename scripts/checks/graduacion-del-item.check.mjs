// ────────────────────────────────────────────────────────────────────────────
// LEJOS / CERCA POR CRISTAL (src/lib/receta/graduacion-del-item.ts): la
// graduación que va al cristal según su uso. Nació el 21/10/2026 porque un
// monofocal de cerca salía a fábrica con la graduación de lejos.
// Sin base ni red. Corre en CI.   npm run check:receta-item
// ────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { graduacionDelItem, adicionDelOjo, recetaPermiteCerca, usoPorDefecto, usoDelCristal, esMonofocal } from '../../src/lib/receta/graduacion-del-item.ts';

let n = 0;
const t = (nombre, fn) => { try { fn(); n++; } catch (e) { console.error(`✗ ${nombre}`); throw e; } };

const conAdd = { sphereOD: -2, cylinderOD: -0.75, axisOD: 90, sphereOI: -1.5, cylinderOI: null, axisOI: null, addition: 2.25, distanceOD: 32, distanceOI: 31, prescriptionType: 'ADDITION' };
const dosSecciones = { sphereOD: -2, cylinderOD: -0.75, axisOD: 90, sphereOI: -1.5, nearSphereOD: 0.25, nearSphereOI: 0.75, nearCylinderOD: -0.5, nearAxisOD: 85, nearDistanceOD: 30, nearDistanceOI: 29, prescriptionType: 'ADDITION' };
const soloCerca = { sphereOD: null, sphereOI: null, nearSphereOD: 2, nearSphereOI: 2.25, prescriptionType: 'NEAR' };
const soloLejos = { sphereOD: -3, cylinderOD: -1, axisOD: 180, sphereOI: -3.25, prescriptionType: 'FAR' };

t('lejos: la columna de lejos tal cual, con la adición si la hay', () => {
    assert.deepEqual(graduacionDelItem(conAdd, 'OD', 'LEJOS'), { sphereVal: -2, cylinderVal: -0.75, axisVal: 90, additionVal: 2.25, pdVal: 32 });
    assert.deepEqual(graduacionDelItem(soloLejos, 'OI', 'LEJOS'), { sphereVal: -3.25, cylinderVal: null, axisVal: null, additionVal: null, pdVal: null });
});
t('cerca con adición: lejos + adición, cilindro y eje de lejos, sin adición en el ítem', () => {
    assert.deepEqual(graduacionDelItem(conAdd, 'OD', 'CERCA'), { sphereVal: 0.25, cylinderVal: -0.75, axisVal: 90, additionVal: null, pdVal: 32 });
    assert.deepEqual(graduacionDelItem(conAdd, 'OI', 'CERCA'), { sphereVal: 0.75, cylinderVal: null, axisVal: null, additionVal: null, pdVal: 31 });
});
t('cerca escrita en la receta: manda la sección Cerca (esfera, cilindro, eje y DNP de cerca)', () => {
    assert.deepEqual(graduacionDelItem(dosSecciones, 'OD', 'CERCA'), { sphereVal: 0.25, cylinderVal: -0.5, axisVal: 85, additionVal: null, pdVal: 30 });
    // OI sin cilindro de cerca: toma el de lejos (null acá).
    assert.deepEqual(graduacionDelItem(dosSecciones, 'OI', 'CERCA'), { sphereVal: 0.75, cylinderVal: null, axisVal: null, additionVal: null, pdVal: 29 });
    // La adición de una receta en dos secciones es la diferencia.
    assert.equal(adicionDelOjo(dosSecciones, 'OD'), 2.25); assert.equal(adicionDelOjo(dosSecciones, 'OI'), 2.25);
    assert.deepEqual(graduacionDelItem(dosSecciones, 'OD', 'LEJOS').additionVal, 2.25);
});
t('receta solo de cerca: el default es CERCA y la graduación sale de la sección Cerca', () => {
    assert.equal(usoPorDefecto(soloCerca), 'CERCA'); assert.equal(usoPorDefecto(conAdd), 'LEJOS'); assert.equal(usoPorDefecto(null), 'LEJOS');
    assert.equal(graduacionDelItem(soloCerca, 'OD', 'CERCA').sphereVal, 2);
    assert.equal(usoDelCristal(null, soloCerca), 'CERCA'); assert.equal(usoDelCristal('lejos', soloCerca), 'LEJOS'); assert.equal(usoDelCristal('CERCA', soloLejos), 'CERCA'); assert.equal(usoDelCristal('otra', conAdd), 'LEJOS');
});
t('cerca se ofrece solo si la receta tiene cerca o adición', () => {
    assert.equal(recetaPermiteCerca(conAdd), true); assert.equal(recetaPermiteCerca(dosSecciones), true); assert.equal(recetaPermiteCerca(soloCerca), true);
    assert.equal(recetaPermiteCerca(soloLejos), false); assert.equal(recetaPermiteCerca(null), false);
    // Una "adición" de 20 (agudeza visual mal leída) no es adición: no habilita cerca.
    assert.equal(recetaPermiteCerca({ ...soloLejos, addition: 20 }), false);
    // Sin cerca ni adición, pedir CERCA devuelve lejos (no hay otra): por eso se controla antes.
    assert.equal(graduacionDelItem(soloLejos, 'OD', 'CERCA').sphereVal, -3);
});
t('solo los monofocales eligen uso', () => {
    assert.equal(esMonofocal({ type: 'Cristal Monofocal' }), true); assert.equal(esMonofocal(null, 'Cristal Monofocal'), true);
    assert.equal(esMonofocal({ type: 'Cristal Multifocal' }), false); assert.equal(esMonofocal({ type: 'Armazón de Receta' }), false);
});

console.log(`check:receta-item OK (${n} grupos)`);
