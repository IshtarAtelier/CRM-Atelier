#!/usr/bin/env node
/**
 * Fija los casos del 2x1 de armazones de la tienda web.
 *
 * POR QUÉ EXISTE
 * Esta promo REGALA producto: un error de un renglón acá no da un cartel feo,
 * da un armazón de $136.000 sin cobrar. El 2x1 de multifocales del CRM ya tiene
 * su `check:promo` con 13 casos por el mismo motivo — el antecedente es que
 * antes de tener uno, un armazón de $160.000 se estaba bonificando a $35.143.
 *
 * Corre sin base y sin red.
 *
 * Uso: node scripts/checks/promo-2x1-armazones.check.mjs
 */

import { calcular2x1Armazones, armazonesDelCarrito } from '../../src/lib/promo-2x1-armazones.ts';

const casos = [];
let fallas = 0;

const caso = (nombre, armazones, activa, esperado) => {
    const r = calcular2x1Armazones(armazones, activa);
    const errores = Object.entries(esperado)
        .filter(([k, v]) => JSON.stringify(r[k]) !== JSON.stringify(v))
        .map(([k, v]) => `${k}: esperaba ${JSON.stringify(v)}, dio ${JSON.stringify(r[k])}`);
    if (errores.length) { fallas++; casos.push({ nombre, errores }); }
    else casos.push({ nombre, errores: null });
};

const arm = (id, precio, cantidad = 1) => ({ id, precioArmazon: precio, cantidad });

// ── La promo apagada no regala nada, pase lo que pase ────────────────────────
caso('apagada, con dos armazones: no descuenta',
    [arm('a', 136000), arm('b', 180000)], false,
    { aplica: false, bonificados: 0, descuento: 0 });

// ── El par básico: gratis el MÁS BARATO ──────────────────────────────────────
caso('dos armazones: se regala el más barato',
    [arm('a', 180000), arm('b', 136000)], true,
    { aplica: true, bonificados: 1, descuento: 136000, idsBonificados: ['b'] });

caso('el orden en que se agregaron no cambia cuál se regala',
    [arm('a', 136000), arm('b', 180000)], true,
    { aplica: true, bonificados: 1, descuento: 136000, idsBonificados: ['a'] });

// ── Un solo armazón no es un par ─────────────────────────────────────────────
caso('un solo armazón: no hay 2x1, y falta 1 para el par',
    [arm('a', 136000)], true,
    { aplica: false, bonificados: 0, descuento: 0, faltanParaElProximo: 1 });

caso('carrito vacío de armazones: faltan 2',
    [], true,
    { aplica: false, bonificados: 0, descuento: 0, faltanParaElProximo: 2 });

// ── De a pares, nunca "el tercero también" ───────────────────────────────────
caso('tres armazones: uno solo gratis, el más barato',
    [arm('a', 200000), arm('b', 136000), arm('c', 150000)], true,
    { bonificados: 1, descuento: 136000, faltanParaElProximo: 1 });

caso('cuatro armazones: dos gratis, los dos más baratos',
    [arm('a', 200000), arm('b', 136000), arm('c', 150000), arm('d', 190000)], true,
    { bonificados: 2, descuento: 286000, faltanParaElProximo: 2 });

caso('cinco armazones: dos gratis, no tres',
    [arm('a', 100000), arm('b', 110000), arm('c', 120000), arm('d', 130000), arm('e', 140000)], true,
    { bonificados: 2, descuento: 210000, faltanParaElProximo: 1 });

// ── La cantidad de una línea cuenta igual que dos líneas ─────────────────────
caso('una línea con cantidad 2 es un par',
    [arm('a', 136000, 2)], true,
    { aplica: true, bonificados: 1, descuento: 136000, idsBonificados: ['a'] });

caso('cantidad 3 en una línea: uno gratis',
    [arm('a', 136000, 3)], true,
    { bonificados: 1, descuento: 136000 });

// ── Basura de entrada: no se regala contra un precio que no se pudo leer ─────
caso('precio 0: la unidad no participa',
    [arm('a', 0), arm('b', 136000)], true,
    { aplica: false, bonificados: 0, descuento: 0 });

caso('precio nulo o roto: la unidad no participa',
    [arm('a', NaN), arm('b', 136000), arm('c', 150000)], true,
    { bonificados: 1, descuento: 136000 });

caso('precio negativo: la unidad no participa',
    [arm('a', -5000), arm('b', 136000)], true,
    { aplica: false, bonificados: 0, descuento: 0 });

caso('cantidad 0: la línea no participa',
    [arm('a', 136000, 0), arm('b', 150000)], true,
    { aplica: false, bonificados: 0, descuento: 0 });

// ── El descuento nunca puede superar lo que hay en el carrito ────────────────
caso('el descuento es como mucho la mitad del valor de los armazones',
    [arm('a', 136000), arm('b', 136000)], true,
    { descuento: 136000 });

// ── El tilde: solo entran los armazones marcados en /admin/web ──────────────
// Es la parte que decide QUÉ se regala. Un error acá regala un armazón que
// nadie marcó, o no regala el que sí.
const linea = (id, productId, precio, extra = {}) =>
    ({ id, productId, price: precio, basePrice: precio, quantity: 1, ...extra });

const casoTilde = (nombre, items, esMayorista, marcados, esperado) => {
    const r = armazonesDelCarrito(items, esMayorista, new Set(marcados));
    const dio = { cantidad: r.length, ids: r.map(x => x.id) };
    const errores = Object.entries(esperado)
        .filter(([k, v]) => JSON.stringify(dio[k]) !== JSON.stringify(v))
        .map(([k, v]) => `${k}: esperaba ${JSON.stringify(v)}, dio ${JSON.stringify(dio[k])}`);
    if (errores.length) { fallas++; casos.push({ nombre, errores }); }
    else casos.push({ nombre, errores: null });
};

casoTilde('sin ningún armazón marcado, no entra nada',
    [linea('l1', 'p1', 136000), linea('l2', 'p2', 150000)], false, [],
    { cantidad: 0 });

casoTilde('solo entra el marcado',
    [linea('l1', 'p1', 136000), linea('l2', 'p2', 150000)], false, ['p2'],
    { cantidad: 1, ids: ['l2'] });

casoTilde('los dos marcados entran los dos',
    [linea('l1', 'p1', 136000), linea('l2', 'p2', 150000)], false, ['p1', 'p2'],
    { cantidad: 2, ids: ['l1', 'l2'] });

casoTilde('mayorista: no entra ni el marcado',
    [linea('l1', 'p1', 136000), linea('l2', 'p2', 150000)], true, ['p1', 'p2'],
    { cantidad: 0 });

casoTilde('el segundo par del 2x1 de Varilux queda afuera aunque esté marcado',
    [linea('l1', 'p1', 136000), linea('l2', 'p1', 0, { lensConfig: { secondPair2x1: true } })],
    false, ['p1'],
    { cantidad: 1, ids: ['l1'] });

casoTilde('un ítem sin productId no entra',
    [linea('l1', undefined, 136000), linea('l2', 'p2', 150000)], false, ['p2'],
    { cantidad: 1, ids: ['l2'] });

// ── Salida ───────────────────────────────────────────────────────────────────
console.log(`\n▶ 2x1 de armazones de la tienda — ${casos.length} casos\n`);
for (const c of casos) {
    if (c.errores) {
        console.error(`  ❌ ${c.nombre}`);
        for (const e of c.errores) console.error(`       ${e}`);
    } else {
        console.log(`  ✅ ${c.nombre}`);
    }
}

if (fallas) {
    console.error(`\n❌ ${fallas} caso(s) del 2x1 de armazones no dan lo esperado.`);
    console.error('   Esta promo REGALA producto: un error acá sale plata real.\n');
    process.exit(1);
}
console.log(`\n✅ Los ${casos.length} casos del 2x1 de armazones dan lo esperado.\n`);
