// ────────────────────────────────────────────────────────────────────────────
// LEJOS / CERCA POR CRISTAL (src/lib/receta/graduacion-del-item.ts): la
// graduación que va al cristal según su uso. Nació el 21/10/2026 porque un
// monofocal de cerca salía a fábrica con la graduación de lejos.
// Lo más importante que fija: un cristal que NO es monofocal, o que nadie
// marcó de cerca, sale EXACTAMENTE como antes (auditoría del 22/10/2026: la
// ficha guarda 'NEAR' en recetas multifocales escritas en dos secciones).
// Sin base ni red. Corre en CI.   npm run check:receta-item
// ────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { graduacionDelItem, adicionDelOjo, recetaPermiteCerca, recetaSoloDeCerca, usoPorDefecto, usoEfectivo, esMonofocal } from '../../src/lib/receta/graduacion-del-item.ts';

let n = 0;
const t = (nombre, fn) => { try { fn(); n++; } catch (e) { console.error(`✗ ${nombre}`); throw e; } };

const conAdd = { sphereOD: -2, cylinderOD: -0.75, axisOD: 90, sphereOI: -1.5, cylinderOI: null, axisOI: null, addition: 2.25, distanceOD: 32, distanceOI: 31, prescriptionType: 'ADDITION' };
// Así guarda la ficha una receta multifocal escrita en dos secciones: con tipo NEAR (195 de 346 recetas tienen el tipo mal).
const dosSeccionesNear = { sphereOD: -2, cylinderOD: -0.75, axisOD: 90, sphereOI: -1.5, nearSphereOD: 0.25, nearSphereOI: 0.75, nearCylinderOD: -0.5, nearAxisOD: 85, nearDistanceOD: 30, nearDistanceOI: 29, additionOD: 2.25, additionOI: 2.25, prescriptionType: 'NEAR' };
const soloCerca = { sphereOD: null, sphereOI: null, nearSphereOD: 2, nearSphereOI: 2.25, prescriptionType: 'NEAR' };
const soloLejos = { sphereOD: -3, cylinderOD: -1, axisOD: 180, sphereOI: -3.25, prescriptionType: 'FAR' };

// Lo que copiaba la venta hasta el 21/10/2026 (origin/main): la referencia que LEJOS no puede cambiar.
const comoAntes = (rx, ojo) => ojo === 'OD'
    ? { sphereVal: rx.sphereOD ?? null, cylinderVal: rx.cylinderOD ?? null, axisVal: rx.axisOD ?? null, additionVal: (rx.additionOD ?? rx.addition) ?? null }
    : { sphereVal: rx.sphereOI ?? null, cylinderVal: rx.cylinderOI ?? null, axisVal: rx.axisOI ?? null, additionVal: (rx.additionOI ?? rx.addition) ?? null };
const sinDnp = (g) => ({ sphereVal: g.sphereVal, cylinderVal: g.cylinderVal, axisVal: g.axisVal, additionVal: g.additionVal });

t('LEJOS es exactamente lo que se copiaba antes, en cualquier receta (adición rara incluida)', () => {
    for (const rx of [conAdd, dosSeccionesNear, soloCerca, soloLejos, { ...soloLejos, addition: 0.25 }, { ...conAdd, additionOD: 0 }]) {
        for (const ojo of ['OD', 'OI']) assert.deepEqual(sinDnp(graduacionDelItem(rx, ojo, 'LEJOS')), comoAntes(rx, ojo), `${rx.prescriptionType} ${ojo}`);
    }
    assert.equal(graduacionDelItem(conAdd, 'OD', 'LEJOS').dnpCerca, null);
});
t('un cristal que NO es monofocal nunca va de cerca, aunque la receta diga NEAR o se haya marcado CERCA', () => {
    for (const rx of [dosSeccionesNear, soloCerca, conAdd]) {
        assert.equal(usoEfectivo(null, rx, false), 'LEJOS');
        assert.equal(usoEfectivo('CERCA', rx, false), 'LEJOS');
    }
    // El caso de la auditoría: progresivo con receta guardada como NEAR → sale con lejos + adición, como siempre.
    assert.deepEqual(sinDnp(graduacionDelItem(dosSeccionesNear, 'OD', usoEfectivo(null, dosSeccionesNear, false))), comoAntes(dosSeccionesNear, 'OD'));
});
t('un monofocal va de cerca solo si se eligió, o si la receta es solo de cerca (por los números, no por el tipo)', () => {
    assert.equal(usoEfectivo(null, dosSeccionesNear, true), 'LEJOS', 'NEAR con lejos cargada no es "solo cerca"');
    assert.equal(usoEfectivo('CERCA', dosSeccionesNear, true), 'CERCA');
    assert.equal(usoEfectivo('cerca', conAdd, true), 'CERCA');
    assert.equal(usoEfectivo(null, soloCerca, true), 'CERCA');
    assert.equal(usoEfectivo('LEJOS', soloCerca, true), 'LEJOS');
    assert.equal(usoEfectivo('CERCA', soloLejos, true), 'LEJOS', 'sin cerca ni adición no hay cerca');
    assert.equal(usoEfectivo('CERCA', null, true), 'LEJOS');
    assert.equal(recetaSoloDeCerca(soloCerca), true); assert.equal(recetaSoloDeCerca(dosSeccionesNear), false); assert.equal(recetaSoloDeCerca(null), false);
    assert.equal(usoPorDefecto(soloCerca), 'CERCA'); assert.equal(usoPorDefecto(dosSeccionesNear), 'LEJOS'); assert.equal(usoPorDefecto(conAdd), 'LEJOS');
});
t('cerca con adición: lejos + adición, cilindro y eje de lejos, sin adición en el ítem; la DNP no se toca si la receta no trae la de cerca', () => {
    assert.deepEqual(graduacionDelItem(conAdd, 'OD', 'CERCA'), { sphereVal: 0.25, cylinderVal: -0.75, axisVal: 90, additionVal: null, dnpCerca: null });
    assert.deepEqual(graduacionDelItem(conAdd, 'OI', 'CERCA'), { sphereVal: 0.75, cylinderVal: null, axisVal: null, additionVal: null, dnpCerca: null });
});
t('cerca escrita en la receta: manda la sección Cerca (esfera, cilindro, eje y DNP de cerca)', () => {
    assert.deepEqual(graduacionDelItem(dosSeccionesNear, 'OD', 'CERCA'), { sphereVal: 0.25, cylinderVal: -0.5, axisVal: 85, additionVal: null, dnpCerca: 30 });
    assert.deepEqual(graduacionDelItem(dosSeccionesNear, 'OI', 'CERCA'), { sphereVal: 0.75, cylinderVal: null, axisVal: null, additionVal: null, dnpCerca: 29 });
    assert.equal(graduacionDelItem(soloCerca, 'OD', 'CERCA').sphereVal, 2);
    // Adición implícita (cerca − lejos) solo si es positiva y creíble.
    assert.equal(adicionDelOjo({ sphereOD: -2, nearSphereOD: 0.25 }, 'OD'), 2.25);
    assert.equal(adicionDelOjo({ sphereOD: 1, nearSphereOD: -1 }, 'OD'), null);
});
t('cerca se ofrece solo si la receta tiene cerca o adición', () => {
    assert.equal(recetaPermiteCerca(conAdd), true); assert.equal(recetaPermiteCerca(dosSeccionesNear), true); assert.equal(recetaPermiteCerca(soloCerca), true);
    assert.equal(recetaPermiteCerca(soloLejos), false); assert.equal(recetaPermiteCerca(null), false);
    // Una "adición" de 20 (agudeza visual mal leída) no es adición: no habilita cerca.
    assert.equal(recetaPermiteCerca({ ...soloLejos, addition: 20 }), false);
});
t('solo los monofocales eligen uso', () => {
    assert.equal(esMonofocal({ type: 'Cristal Monofocal' }), true); assert.equal(esMonofocal(null, 'Cristal Monofocal'), true);
    assert.equal(esMonofocal({ type: 'Cristal Multifocal' }), false); assert.equal(esMonofocal({ type: 'Armazón de Receta' }), false); assert.equal(esMonofocal(null, null), false);
});

console.log(`check:receta-item OK (${n} grupos)`);
