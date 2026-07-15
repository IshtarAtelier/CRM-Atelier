// ────────────────────────────────────────────────────────────────────────────
// Verificación del fallback de productos del home.
// Fija la garantía "la home NUNCA renderiza sin productos":
//   1. la cadena vivo → memoria → snapshot elige siempre una fuente CON productos;
//   2. el snapshot commiteado existe, tiene productos y el shape esperado;
//   3. el formateo/dedup del carrusel no cambia por accidente.
//
// Correr:  npm run check:home
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  countProducts,
  hasProducts,
  chooseHomeSource,
  formatProducts as formatProductsRaw,
} from '../../src/lib/home-fallback.ts';
import { resolveStorageUrl } from '../../src/lib/utils/storage.ts';

// Mismo cableado que src/app/page.tsx: el resolvedor real, inyectado.
const formatProducts = (list) => formatProductsRaw(list, resolveStorageUrl);

let passed = 0;
const check = (name, cond) => {
  assert.ok(cond, `FALLÓ: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
};

const row = (name, model = null, price = 100000) => ({
  name,
  imageUrl: '/x.webp',
  images: [],
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  product: { id: name, price, stock: 1, model, category: 'Armazón de Receta', imagenesCatalogo: [] },
});
const data = (n) => ({
  destacados: Array.from({ length: n }, (_, i) => row(`P${i}`)),
  sol: [], receta: [], nuevos: [], count: n,
});
const EMPTY = data(0);

console.log('\nFallback de productos del home\n');

// — Cadena de selección: nunca elegir una fuente vacía habiendo otra con productos —
check('con DB viva → usa live', chooseHomeSource(data(5), data(3), data(2)).source === 'live');
check('DB caída (null) pero hay memoria → usa memory', chooseHomeSource(null, data(3), data(2)).source === 'memory');
check('DB caída y sin memoria → usa snapshot', chooseHomeSource(null, null, data(2)).source === 'snapshot');
check('DB responde VACÍO → NO se usa (cae a memoria)', chooseHomeSource(EMPTY, data(3), data(2)).source === 'memory');
check('DB vacía y memoria vacía → snapshot', chooseHomeSource(EMPTY, EMPTY, data(2)).source === 'snapshot');
check('la fuente elegida SIEMPRE tiene productos (si el snapshot los tiene)',
  hasProducts(chooseHomeSource(null, null, data(1)).data));

// — Snapshot commiteado: existe, con productos y shape correcto —
const snap = JSON.parse(readFileSync(new URL('../../src/data/home-snapshot.json', import.meta.url), 'utf8'));
check('snapshot: tiene productos (destacados > 0)', (snap.destacados?.length || 0) > 0);
check('snapshot: countProducts > 0', countProducts(snap) > 0);
check('snapshot: count de catálogo > 0', (snap.count || 0) > 0);
const first = snap.destacados[0];
check('snapshot: shape de fila (name/slug/product.id/product.price)',
  typeof first.name === 'string' && typeof first.slug === 'string' &&
  typeof first.product?.id === 'string' && 'price' in first.product);
check('snapshot: el formateo del carrusel produce items', formatProducts(snap.destacados).length > 0);

// — Formateo/dedup del carrusel —
const fmt = formatProducts([row('Frida C1', 'Frida C1'), row('Frida C5', 'Frida C5'), row('Vega C2', 'Vega C2')]);
check('dedup de variantes: Frida C1 + Frida C5 → 1 sola Frida', fmt.filter(p => p.name.startsWith('Frida')).length === 1);
check('dedup: Vega sobrevive', fmt.some(p => p.name.startsWith('Vega')));
check('precio en 6 cuotas formateado', fmt[0].price.startsWith('6 cuotas de $'));
check('tope de 12 items', formatProducts(Array.from({ length: 30 }, (_, i) => row(`M${i}`))).length === 12);
check('lista vacía → []', formatProducts([]).length === 0);

console.log(`\n✅ ${passed} checks OK — la home no puede quedar sin productos\n`);
