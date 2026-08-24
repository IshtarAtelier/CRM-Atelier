// ────────────────────────────────────────────────────────────────────────────
// COLOR DE LA LENTE: que un cristal blanco no pase por uno de sol.
//
// Un cristal blanco puede tener filtro azul y antirreflejo y sigue siendo
// blanco. Los de sol son los fotocromáticos (Transitions, Acclimates,
// Xtractive, fotosensibles), los polarizados (Xperio) y los espejados.
// El color se DERIVA del nombre — no hay campo en la base — así que un
// nombre nuevo del laboratorio se clasifica solo. Este check fija los casos
// reales del catálogo, incluido el que casi se me escapa (Fotosensible).
//
// Corre sin base y sin red.
// Correr:  npm run check:color-lente
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { colorDeLente } from '../../src/lib/color-de-lente.ts';

const cristal = (name) => ({ name, category: 'Cristal', type: 'Cristal Multifocal' });

const casos = [
    // Blancos: el filtro azul y el antirreflejo NO los tiñen.
    ['XR DESIGN - ORMA + CRIZAL 2x1', 'Blanco'],
    ['KODAK PRECISE - ORMA BLUE UV 2x1', 'Blanco'],
    ['Blue UV ORMA - 1.50 Filter System Con Crizal Prevencia', 'Blanco'],
    ['Multifocal SMART FREE - Organico 1.56 Blue Light con AR essential, 2x1', 'Blanco'],
    ['ESSILOR NEW EDITIONS - Airwear 1.59 BLUE UV + AR Numax 2x1', 'Blanco'],
    ['Multifocal SMART FREE - Organico 1.49 Blanco 2x1', 'Blanco'],
    // Fotocromáticos, por marca y por texto.
    ['COMFORT MAX - ORMA TRANSITIONS GEN S + CRIZAL (fotocromaticos 8) 2x1', 'Fotocromático'],
    ['ESPACE PLUS DIGITAL - ORMA ACCLIMATES + CRIZAL 2x1 (Fotocromático)', 'Fotocromático'],
    ['ESSILOR NEW EDITIONS - Orgánico Fotosensible BLC+ AR Numax 2x1', 'Fotocromático'],
    ['PHYSIO 3.0 - ORMA TRANSITIONS XTRACTIVE + CRIZAL (fotocromatico Gris) 2x1', 'Fotocromático gris'],
    ['EYEZEN START - ORMA TRANSITIONS GEN S (Colores) + CRIZAL 2x1 (Fotocromático)', 'Fotocromático de color'],
    // De sol de verdad.
    ['COMFORT - ORMA XPERIO + CRIZAL 2x1', 'Polarizado'],
    ['Multifocal SMART FREE - Organico 1.49 Polarizado Gris/Brown 2x1', 'Polarizado'],
    ['ESSILOR NEW EDITIONS - Orgánico Espejado (Azul / Plata) + AR Numax 2x1', 'Espejado'],
];

let fallas = 0;
for (const [nombre, esperado] of casos) {
    const dio = colorDeLente(cristal(nombre));
    if (dio === esperado) console.log(`  ✅ ${esperado.padEnd(22)} ${nombre.slice(0, 58)}`);
    else { fallas++; console.error(`  ❌ esperaba "${esperado}" y dio "${dio}"\n     ${nombre}`); }
}

// Lo que NO es un cristal no lleva color de lente.
for (const p of [
    { name: 'Atelier Premium', category: 'Armazón de Receta', type: 'Armazón de Receta' },
    { name: 'Clip On', category: 'Armazón de Receta', type: 'Armazón de Receta' },
    null,
]) {
    const dio = colorDeLente(p);
    if (dio === null) console.log(`  ✅ sin color de lente          ${p?.name || '(nulo)'}`);
    else { fallas++; console.error(`  ❌ ${p?.name} no es un cristal y dio "${dio}"`); }
}

if (fallas > 0) { console.error(`\n❌ ${fallas} caso(s) mal clasificado(s).`); process.exit(1); }
console.log(`\n✅ Color de la lente: los ${casos.length + 3} casos dan lo esperado.`);
