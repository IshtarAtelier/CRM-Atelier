#!/usr/bin/env node
/**
 * Fija la semántica del módulo genérico de facetas: contar cada una contra las
 * OTRAS activas (nunca contra sí misma), y que el multi-valor (color) cuente
 * un producto para más de una opción sin duplicar el filtrado.
 *
 * Corre sin base ni red.
 * Uso: node --experimental-strip-types scripts/checks/facetas.check.mjs
 */

import { calcularFacetas, filtrarPorFacetas, facetaValorUnico, facetaValoresMultiples } from '../../src/lib/catalog/facetas.ts';

const casos = [];
let fallas = 0;

const caso = (nombre, fn) => {
    try {
        const [ok, detalle] = fn();
        if (!ok) fallas++;
        casos.push({ nombre, ok, detalle });
    } catch (e) {
        fallas++;
        casos.push({ nombre, ok: false, detalle: `excepción: ${e.message}` });
    }
};

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Catálogo de prueba: mismo espíritu que el real (forma/material/color) ───
const catalogo = [
    { id: '1', forma: 'Cuadrado', material: 'Titanio', colores: ['negro'] },
    { id: '2', forma: 'Cuadrado', material: 'Acetato', colores: ['carey'] },
    { id: '3', forma: 'Redondo', material: 'Titanio', colores: ['dorado', 'negro'] },
    { id: '4', forma: 'Aviador', material: 'Metal', colores: [] }, // sin color reconocido
    { id: '5', forma: 'Cuadrado', material: 'Titanio', colores: ['negro'] },
];

const facetaForma = facetaValorUnico('forma', p => p.forma);
const facetaMaterial = facetaValorUnico('material', p => p.material);
const facetaColor = facetaValoresMultiples('color', p => p.colores);
const FACETAS = [facetaForma, facetaMaterial, facetaColor];

// ── La regla central: contra las OTRAS, nunca contra sí misma ────────────────
caso('sin filtros activos, cada faceta cuenta el catálogo entero', () => {
    const c = calcularFacetas(catalogo, FACETAS, {});
    return [
        igual(c.forma, { Cuadrado: 3, Redondo: 1, Aviador: 1 }) &&
        igual(c.material, { Titanio: 3, Acetato: 1, Metal: 1 }) &&
        igual(c.color, { negro: 3, carey: 1, dorado: 1 }),
        c,
    ];
});

caso('con Titanio activo, el conteo de FORMA no aplica material sobre sí... espera, aplica material (no es su propia faceta)', () => {
    // Con material=Titanio puesto, contar FORMA se hace contra material=Titanio
    // (la faceta ajena) pero SIN aplicar forma (la propia). Quedan los items 1,3,5.
    const c = calcularFacetas(catalogo, FACETAS, { material: 'Titanio' });
    return [igual(c.forma, { Cuadrado: 2, Redondo: 1 }), c.forma];
});

caso('con Titanio activo, el conteo de MATERIAL ignora el propio filtro (ve el catálogo entero vía las otras facetas)', () => {
    // Al contar MATERIAL no se aplica el filtro de material — solo forma y color,
    // que están sin elegir. Por eso da el total real de cada material, no solo Titanio.
    const c = calcularFacetas(catalogo, FACETAS, { material: 'Titanio' });
    return [igual(c.material, { Titanio: 3, Acetato: 1, Metal: 1 }), c.material];
});

caso('con Cuadrado activo, el conteo de COLOR se calcula contra forma=Cuadrado', () => {
    // Cuadrado: items 1, 2, 5 → colores negro(1), carey(2), negro(5) = negro:2, carey:1
    const c = calcularFacetas(catalogo, FACETAS, { forma: 'Cuadrado' });
    return [igual(c.color, { negro: 2, carey: 1 }), c.color];
});

// ── Multi-valor: un producto cuenta para las DOS opciones de color ──────────
caso('un producto con dos colores suma en las dos, no se duplica en el filtrado', () => {
    const c = calcularFacetas(catalogo, FACETAS, {});
    const sumaDorado = c.color.dorado === 1;
    const filtrados = filtrarPorFacetas(catalogo, FACETAS, { color: 'dorado' });
    // Solo el item 3 tiene "dorado" en su lista — filtrarPorFacetas no debe
    // devolverlo dos veces ni devolver de más.
    return [sumaDorado && filtrados.length === 1 && filtrados[0].id === '3', { sumaDorado, filtrados }];
});

caso('filtrar por color=negro devuelve los 3 productos con negro (uno de ellos también dorado)', () => {
    const filtrados = filtrarPorFacetas(catalogo, FACETAS, { color: 'negro' });
    return [filtrados.length === 3 && filtrados.map(p => p.id).sort().join(',') === '1,3,5', filtrados.map(p => p.id)];
});

// ── Sin ningún valor reconocido: no cuenta ni rompe ─────────────────────────
caso('un producto sin color reconocido no aparece en ningún conteo de color', () => {
    const c = calcularFacetas(catalogo, FACETAS, {});
    const totalColor = Object.values(c.color).reduce((a, b) => a + b, 0);
    // 3 negro + 1 carey + 1 dorado = 5, pero el item 4 no aporta ninguno.
    return [totalColor === 5, c.color];
});

// ── Combinar dos filtros a la vez ────────────────────────────────────────────
caso('filtrar por forma=Cuadrado Y color=negro da la intersección', () => {
    const filtrados = filtrarPorFacetas(catalogo, FACETAS, { forma: 'Cuadrado', color: 'negro' });
    return [filtrados.length === 2 && filtrados.map(p => p.id).sort().join(',') === '1,5', filtrados.map(p => p.id)];
});

// ── Comparación insensible a mayúsculas en valor único ──────────────────────
caso('facetaValorUnico compara sin importar mayúsculas', () => {
    const f = facetaValorUnico('x', p => p.forma);
    return [f.coincide({ forma: 'cuadrado' }, 'CUADRADO'), null];
});

// ── Catálogo vacío no rompe nada ─────────────────────────────────────────────
caso('catálogo vacío da conteos vacíos, no rompe', () => {
    const c = calcularFacetas([], FACETAS, {});
    return [igual(c.forma, {}) && igual(c.color, {}), c];
});

// ── Salida ───────────────────────────────────────────────────────────────────
console.log(`\n▶ Módulo genérico de facetas — ${casos.length} casos\n`);
for (const c of casos) {
    if (c.ok) console.log(`  ✅ ${c.nombre}`);
    else console.error(`  ❌ ${c.nombre}\n       dio: ${JSON.stringify(c.detalle)}`);
}

if (fallas) {
    console.error(`\n❌ ${fallas} caso(s) no dan lo esperado.\n`);
    process.exit(1);
}
console.log(`\n✅ Los ${casos.length} casos del módulo de facetas dan lo esperado.\n`);
