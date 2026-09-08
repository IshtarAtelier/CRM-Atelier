#!/usr/bin/env node
/**
 * El precio de oferta, fijado en TODAS las superficies que lo muestran o lo
 * cobran.
 *
 * POR QUÉ EXISTE
 * La regla ("vale si está cargado, es mayor a cero y es MENOR al de lista")
 * vive en `src/lib/precio-oferta.ts`, pero llegar a usarla en todos lados costó
 * tres bugs distintos, los tres del mismo tipo — el componente sabía resolver
 * la oferta y el dato nunca le llegaba:
 *
 *   · 7/9/26 — el carrusel del home ni siquiera recibía `salePrice`: una rebaja
 *     de verdad era invisible en la pantalla que más gente ve.
 *   · 8/9/26 — se le puso el cartel "26% OFF 🔥" a esa misma tarjeta, pero el
 *     NÚMERO seguía saliendo del precio de lista: Rigel C3, rebajado de
 *     $215.000 a $160.000, anunciaba "26% OFF" al lado de $182.750.
 *   · 8/9/26 — `LISTADO_SELECT` no traía `salePrice`, así que /receta,
 *     /lentes-de-sol y /clip-on mostraban $182.750 por el mismo anteojo que
 *     /tienda vendía a $136.000.
 *
 * Los tres se ven igual desde afuera: un precio más caro que el real en la
 * página que más tráfico tiene. Este check los vuelve imposibles de repetir en
 * silencio.
 *
 * Corre sin base y sin red.
 * Uso: node --experimental-strip-types scripts/checks/precio-oferta.check.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { precioConOferta } from '../../src/lib/precio-oferta.ts';
import { effectiveFramePrice } from '../../src/lib/checkout/checkout-pricing.ts';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '../..');

const casos = [];
let fallas = 0;
const ok = (nombre) => casos.push({ nombre, ok: true });
const mal = (nombre, detalle) => { fallas++; casos.push({ nombre, ok: false, detalle }); };
const esperar = (nombre, real, esperado) => {
    if (JSON.stringify(real) === JSON.stringify(esperado)) ok(nombre);
    else mal(nombre, `esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(real)}`);
};

// ── 1. La regla, con sus bordes ──────────────────────────────────────────────
esperar('oferta real: final es el rebajado',
    precioConOferta({ price: 215000, salePrice: 160000 }),
    { lista: 215000, final: 160000, enOferta: true, descuentoPct: 26 });

esperar('sin oferta: final es el de lista',
    precioConOferta({ price: 160000, salePrice: null }),
    { lista: 160000, final: 160000, enOferta: false, descuentoPct: 0 });

esperar('salePrice IGUAL al de lista no es oferta',
    precioConOferta({ price: 160000, salePrice: 160000 }),
    { lista: 160000, final: 160000, enOferta: false, descuentoPct: 0 });

esperar('salePrice MAYOR al de lista no es oferta (un aumento disfrazado)',
    precioConOferta({ price: 160000, salePrice: 200000 }),
    { lista: 160000, final: 160000, enOferta: false, descuentoPct: 0 });

esperar('salePrice en cero no es oferta',
    precioConOferta({ price: 160000, salePrice: 0 }),
    { lista: 160000, final: 160000, enOferta: false, descuentoPct: 0 });

esperar('producto nulo no rompe',
    precioConOferta(null),
    { lista: 0, final: 0, enOferta: false, descuentoPct: 0 });

// ── 2. Lo que se MUESTRA y lo que se COBRA tienen que dar lo mismo ───────────
// `effectiveFramePrice` es lo que cobra el checkout. Si alguna vez difiere de
// `precioConOferta().final` para un cliente minorista, la web muestra un precio
// y la tarjeta cobra otro.
for (const [price, salePrice] of [[215000, 160000], [160000, null], [160000, 0], [160000, 200000], [200000, 140000]]) {
    const muestra = precioConOferta({ price, salePrice }).final;
    const cobra = effectiveFramePrice({ price, salePrice, wholesalePrice: 0 }, false);
    if (muestra === cobra) ok(`muestra y cobra coinciden (lista ${price} · oferta ${salePrice ?? '—'}): $${cobra}`);
    else mal(`muestra y cobra DIFIEREN (lista ${price} · oferta ${salePrice ?? '—'})`, `web $${muestra} vs checkout $${cobra}`);
}

// ── 3. Cada superficie de cara al cliente pasa por la regla ──────────────────
// Estático a propósito: lo que falló las tres veces no fue el cálculo sino que
// una pantalla nueva (o una consulta) se olvidara de la oferta.
const DEBEN_USAR_LA_REGLA = [
    ['src/components/Storefront/HomeProductCarousel.tsx', 'carrusel del home'],
    ['src/components/Storefront/CategoryGrid.tsx', 'grilla de /receta, /lentes-de-sol y /clip-on'],
    ['src/app/tienda/TiendaClient.tsx', 'grilla de /tienda'],
    ['src/app/producto/[slug]/ProductClient.tsx', 'ficha del producto'],
];
for (const [archivo, queEs] of DEBEN_USAR_LA_REGLA) {
    const src = readFileSync(resolve(raiz, archivo), 'utf8');
    if (src.includes('precioConOferta')) ok(`${queEs}: usa precioConOferta()`);
    else mal(`${queEs}: NO usa precioConOferta()`, `${archivo} calcula el precio por su cuenta`);
}

// ── 4. Las consultas que alimentan esas pantallas traen `salePrice` ─────────
// Este es el error exacto que se repitió: el componente sabía, el dato no venía.
const queries = readFileSync(resolve(raiz, 'src/lib/catalog/queries.ts'), 'utf8');
for (const nombre of ['HOME_SELECT', 'TIENDA_SELECT', 'LISTADO_SELECT']) {
    const bloque = queries.slice(queries.indexOf(`export const ${nombre}`));
    const cuerpo = bloque.slice(0, bloque.indexOf('} as const;'));
    if (/salePrice:\s*true/.test(cuerpo)) ok(`${nombre} trae salePrice`);
    else mal(`${nombre} NO trae salePrice`, 'la pantalla que use este select va a mostrar el precio de lista para un producto rebajado');
}

// ── 4-bis. Cada listado PASA `salePrice` a la grilla ────────────────────────
// El select puede traerlo y el mapeo de la página perderlo igual: cada listado
// arma su propio objeto a mano. Pasó en los tres a la vez — /lentes-de-sol y
// /receta con mapeo propio, /clip-on a través de ListadoCategoria.
const PASAN_SALEPRICE = [
    ['src/app/lentes-de-sol/page.tsx', '/lentes-de-sol'],
    ['src/app/receta/page.tsx', '/receta'],
    ['src/components/Storefront/ListadoCategoria.tsx', 'ListadoCategoria (/clip-on)'],
];
for (const [archivo, queEs] of PASAN_SALEPRICE) {
    const src = readFileSync(resolve(raiz, archivo), 'utf8');
    if (/salePrice:\s*wp\.product\.salePrice/.test(src)) ok(`${queEs}: le pasa salePrice a la grilla`);
    else mal(`${queEs}: NO le pasa salePrice a la grilla`, `${archivo} arma el producto sin la oferta, así que la grilla muestra el precio de lista`);
}

// ── 5. Donde hay oferta, se VE: cartel de % y precio de lista tachado ───────
// Pedido de Ishtar (8/9): "la idea es que la oferta se vea". Un precio rebajado
// sin nada contra qué compararlo se lee como un precio normal.
const MUESTRAN_LA_OFERTA = [
    ['src/components/Storefront/HomeProductCarousel.tsx', 'carrusel del home'],
    ['src/components/Storefront/CategoryGrid.tsx', 'grilla de categoría'],
    ['src/app/tienda/TiendaClient.tsx', 'grilla de /tienda'],
];
for (const [archivo, queEs] of MUESTRAN_LA_OFERTA) {
    const src = readFileSync(resolve(raiz, archivo), 'utf8');
    const tachado = src.includes('line-through');
    const cartel = /OFF\s*🔥|descuentoPct/.test(src);
    if (tachado && cartel) ok(`${queEs}: muestra el % y el precio de lista tachado`);
    else mal(`${queEs}: la oferta no se ve entera`, `tachado: ${tachado ? 'sí' : 'NO'} · cartel de %: ${cartel ? 'sí' : 'NO'}`);
}

// ── Salida ───────────────────────────────────────────────────────────────────
console.log(`\n▶ Precio de oferta — ${casos.length} comprobaciones\n`);
for (const c of casos) {
    if (c.ok) console.log(`  ✅ ${c.nombre}`);
    else console.error(`  ❌ ${c.nombre}\n       ${c.detalle}`);
}
if (fallas) {
    console.error(`\n❌ ${fallas} problema(s). Un precio de oferta mal mostrado es un precio equivocado`);
    console.error(`   en la cara del cliente: o se anuncia más caro de lo que se cobra, o al revés.\n`);
    process.exit(1);
}
console.log(`\n✅ La oferta se resuelve con la misma regla en todas las superficies, y donde hay rebaja se ve.\n`);
