#!/usr/bin/env node
/**
 * Fija que cada uno de los 40 valores de color REALES que hoy existen en
 * producción (auditados con `audit-colores-alt.mjs` el 5/9/26) se agrupe en la
 * familia correcta — y que ninguno quede sin cobertura sin que sea intencional.
 *
 * Corre sin base ni red.
 * Uso: node --experimental-strip-types scripts/checks/color-normalizado.check.mjs
 */

import { familiasDeColor, idsDeColor, todasLasFamilias, familiaColorPorId } from '../../src/lib/catalog/color-normalizado.ts';

const casos = [];
let fallas = 0;

const caso = (nombre, texto, idsEsperados) => {
    const dio = idsDeColor(texto);
    const ok = JSON.stringify(dio) === JSON.stringify(idsEsperados);
    if (!ok) fallas++;
    casos.push({ nombre, ok, esperado: idsEsperados, dio });
};

// ── Los 40 valores reales, auditados contra producción el 5/9/26 ────────────
caso('negro', 'negro', ['negro']);
caso('dorado', 'dorado', ['dorado']);
caso('plateado', 'plateado', ['plateado']);
caso('oro rosado', 'oro rosado', ['dorado', 'rosa']);
caso('azul noche', 'azul noche', ['azul']);
caso('gris grafito', 'gris grafito', ['gris']);
caso('bordó', 'bordó', ['bordo']);
caso('marrón claro translúcido', 'marrón claro translúcido', ['marron']);
caso('negro y dorado', 'negro y dorado', ['negro', 'dorado']);
caso('carey', 'carey', ['carey']);
caso('carey ámbar', 'carey ámbar', ['carey', 'ambar']);
caso('azul marino', 'azul marino', ['azul']);
caso('azul petróleo', 'azul petróleo', ['azul']);
caso('violeta translúcido', 'violeta translúcido', ['violeta']);
caso('jaspeado violeta y rosa', 'jaspeado violeta y rosa', ['rosa', 'violeta']); // rosa está antes que violeta en FAMILIAS
caso('plateado y negro', 'plateado y negro', ['negro', 'plateado']); // orden: negro va antes en FAMILIAS
caso('carey gris y negro', 'carey gris y negro', ['negro', 'carey']); // negro está antes que carey en FAMILIAS, tope 2
caso('negro mate', 'negro mate', ['negro']);
caso('celeste y dorado', 'celeste y dorado', ['dorado']); // "celeste" no está en ninguna familia — no se inventa "azul"
caso('rosa y dorado', 'rosa y dorado', ['dorado', 'rosa']);
caso('blanco', 'blanco', ['blanco']);
caso('carey multicolor azul y ámbar', 'carey multicolor azul y ámbar', ['carey', 'azul']); // tope 2, ámbar queda afuera
caso('ámbar miel translúcido', 'ámbar miel translúcido', ['ambar']);
caso('carey rojizo', 'carey rojizo', ['carey']); // "rojizo" no está en ninguna familia
caso('jaspeado rosa y verde agua', 'jaspeado rosa y verde agua', ['rosa', 'verde']);
caso('gris topo', 'gris topo', ['marron', 'gris']); // "topo" cuenta como marrón, y aparece antes en FAMILIAS
caso('gris topo y dorado', 'gris topo y dorado', ['dorado', 'marron']); // dorado está antes; tope 2, gris queda afuera
caso('negro y plateado', 'negro y plateado', ['negro', 'plateado']);
caso('marrón y plateado', 'marrón y plateado', ['plateado', 'marron']); // plateado está antes que marrón en FAMILIAS
caso('carey oscuro', 'carey oscuro', ['carey']);
caso('gris humo translúcido', 'gris humo translúcido', ['gris']);
caso('dorado claro', 'dorado claro', ['dorado']);
caso('rosa translúcido', 'rosa translúcido', ['rosa']);
caso('verde oliva', 'verde oliva', ['verde']);
caso('marrón topo y dorado', 'marrón topo y dorado', ['dorado', 'marron']); // dorado está antes que marrón en FAMILIAS
caso('carey y azul', 'carey y azul', ['carey', 'azul']);
caso('marrón oscuro', 'marrón oscuro', ['marron']);
caso('jaspeado azul y bordó', 'jaspeado azul y bordó', ['azul', 'bordo']);
caso('jaspeado violeta y verde', 'jaspeado violeta y verde', ['violeta', 'verde']);
caso('negros', 'negros', ['negro']); // plural

// ── Casos borde, no observados en producción pero que tienen que andar ──────
caso('vacío no rompe', '', []);
caso('null no rompe', null, []);
caso('undefined no rompe', undefined, []);
caso('mayúsculas', 'NEGRO', ['negro']);
caso('sin tilde escrita a mano', 'marron', ['marron']);
caso('palabra desconocida sola: no inventa nada', 'jaspeado esmeralda y coral', []);
caso('no confunde "moradona" con nada raro (límite de palabra)', 'moradona', []); // "morado" no es substring aislado
caso('no confunde "azulejo" con azul (límite de palabra)', 'detalle azulejo', []);

// ── El catálogo de familias no tiene duplicados ni huecos ───────────────────
const todas = todasLasFamilias();
const idsUnicos = new Set(todas.map(f => f.id));
if (idsUnicos.size !== todas.length) {
    fallas++;
    console.error(`❌ Hay ids de familia repetidos: ${todas.map(f => f.id).join(', ')}`);
}
for (const f of todas) {
    if (!familiaColorPorId(f.id)) { fallas++; console.error(`❌ familiaColorPorId('${f.id}') no encuentra su propia familia`); }
    if (!/^#[0-9a-f]{6}$/i.test(f.swatch)) { fallas++; console.error(`❌ ${f.id}: swatch "${f.swatch}" no es un hex válido`); }
}

// ── Salida ───────────────────────────────────────────────────────────────────
console.log(`\n▶ Normalización de color — ${casos.length} casos (sobre los 40 valores reales de producción)\n`);
for (const c of casos) {
    if (c.ok) console.log(`  ✅ ${c.nombre}`);
    else console.error(`  ❌ ${c.nombre}: esperaba ${JSON.stringify(c.esperado)}, dio ${JSON.stringify(c.dio)}`);
}

if (fallas) {
    console.error(`\n❌ ${fallas} caso(s) no dan lo esperado.\n`);
    process.exit(1);
}
console.log(`\n✅ Los ${casos.length} casos de color dan lo esperado, y el catálogo de familias está sano.\n`);
