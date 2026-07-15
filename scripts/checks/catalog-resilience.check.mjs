// ────────────────────────────────────────────────────────────────────────────
// Verificación del sistema de resiliencia de catálogo.
// Fija la garantía "el storefront NUNCA renderiza sin productos":
//   1. el núcleo genérico (vivo → memoria → snapshot) elige siempre datos;
//   2. todos los snapshots registrados existen, tienen datos y el shape esperado
//      (y NO filtran campos internos como costos);
//   3. el formateo/dedup del carrusel del home no cambia por accidente.
//
// Correr:  npm run check:catalog
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createResilientSource, defaultIsEmpty } from '../../src/lib/catalog/resilience.ts';
import { CATALOG_SOURCE_KEYS } from '../../src/lib/catalog/queries.ts';
import { formatProducts as formatProductsRaw, countProducts, hasProducts } from '../../src/lib/home-fallback.ts';
import { resolveStorageUrl } from '../../src/lib/utils/storage.ts';

let passed = 0;
const check = (name, cond) => {
  assert.ok(cond, `FALLÓ: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
};
// El núcleo loguea fuerte al caer a fallback — silenciarlo durante los tests sintéticos.
const quiet = async (fn) => {
  const orig = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = orig; }
};

console.log('\n— Núcleo genérico (vivo → memoria → snapshot) —\n');

const SNAP = ['snapshot-item'];
const mkSource = (fetcher, extra = {}) =>
  createResilientSource({ key: 'test', fetcher, snapshot: SNAP, backoffMs: 1, ...extra });

await quiet(async () => {
  // vivo OK
  const s1 = mkSource(async () => ['vivo']);
  const r1 = await s1.get();
  check('vivo con datos → origin live', r1.origin === 'live' && r1.data[0] === 'vivo');

  // memoria: vivo OK y después la DB muere → sirve la última lectura buena
  let fail = false;
  const s2 = mkSource(async () => { if (fail) throw new Error('db down'); return ['vivo']; });
  await s2.get();
  fail = true;
  const r2 = await s2.get();
  check('DB muere tras lectura buena → origin memory con los datos previos',
    r2.origin === 'memory' && r2.data[0] === 'vivo');

  // snapshot: proceso "fresco" (sin memoria) con DB muerta
  const s3 = mkSource(async () => { throw new Error('db down'); });
  const r3 = await s3.get();
  check('DB muerta sin memoria → origin snapshot', r3.origin === 'snapshot' && r3.data === SNAP);

  // vacío = falla: vivo devuelve [] → NO se sirve vacío
  const s4 = mkSource(async () => []);
  const r4 = await s4.get();
  check('vivo VACÍO → no se sirve; cae a snapshot', r4.origin === 'snapshot');

  // la memoria no se envenena con lecturas vacías
  let empty = false;
  const s5 = mkSource(async () => (empty ? [] : ['bueno']));
  await s5.get();
  empty = true;
  const r5 = await s5.get();
  check('vivo vacío NO pisa la memoria buena', r5.origin === 'memory' && r5.data[0] === 'bueno');

  // reintentos: falla 2 veces y a la 3ra responde → live
  let attempts = 0;
  const s6 = mkSource(async () => { attempts++; if (attempts < 3) throw new Error('flaky'); return ['ok']; });
  const r6 = await s6.get();
  check('reintenta y recupera (3er intento OK → live)', r6.origin === 'live' && attempts === 3);

  // isEmpty custom para payloads compuestos
  const s7 = createResilientSource({
    key: 'test-composite',
    fetcher: async () => ({ products: [], meta: [{ x: 1 }] }),
    snapshot: { products: [{ id: 'snap' }], meta: [] },
    isEmpty: (d) => (d?.products?.length || 0) === 0,
    backoffMs: 1,
  });
  const r7 = await s7.get();
  check('compuesto sin products → vacío por isEmpty custom → snapshot', r7.origin === 'snapshot');
});

// defaultIsEmpty
check('defaultIsEmpty: [] vacío', defaultIsEmpty([]) === true);
check('defaultIsEmpty: [1] no vacío', defaultIsEmpty([1]) === false);
check('defaultIsEmpty: {a:[],b:[]} vacío', defaultIsEmpty({ a: [], b: [] }) === true);
check('defaultIsEmpty: {a:[1],b:[]} no vacío', defaultIsEmpty({ a: [1], b: [] }) === false);

console.log('\n— Snapshots commiteados (uno por fuente registrada) —\n');

const snapshots = {};
for (const key of CATALOG_SOURCE_KEYS) {
  const url = new URL(`../../src/data/snapshots/${key}.json`, import.meta.url);
  const parsed = JSON.parse(readFileSync(url, 'utf8'));
  snapshots[key] = parsed;
  check(`snapshot ${key}: existe, con envelope y datos`,
    parsed.key === key && typeof parsed.generatedAt === 'string' && !defaultIsEmpty(parsed.data));
}

// Shapes puntuales que consumen las páginas
const home = snapshots['home'].data;
check('home: destacados > 0 y count > 0', home.destacados.length > 0 && home.count > 0);
check('home: shape de fila (name/slug/product.id/price)', (() => {
  const f = home.destacados[0];
  return typeof f.name === 'string' && typeof f.slug === 'string' &&
         typeof f.product?.id === 'string' && 'price' in f.product;
})());
const tiendaRow = snapshots['tienda-catalogo'].data[0];
check('tienda-catalogo: campos de la grilla presentes',
  'salePrice' in tiendaRow.product && 'gender' in tiendaRow.product && 'seoTags' in tiendaRow.product &&
  typeof tiendaRow.slug === 'string');
check('tienda-catalogo: NO filtra datos internos (cost/proveedor) al JSON commiteado',
  !('cost' in tiendaRow.product) && !('wholesalePrice' in tiendaRow.product) && !('supplier' in tiendaRow.product));
for (const key of ['sol', 'receta']) {
  const d = snapshots[key].data;
  check(`${key}: products y meta con filas`, d.products.length > 0 && d.meta.length > 0);
}
check('arma-tus-lentes: filas con stock > 0', snapshots['arma-tus-lentes'].data.every((r) => (r.product?.stock || 0) > 0));

console.log('\n— Formato del carrusel del home —\n');

const formatProducts = (list) => formatProductsRaw(list, resolveStorageUrl);
const row = (name, model = null, price = 100000) => ({
  name, imageUrl: '/x.webp', images: [], slug: name.toLowerCase().replace(/\s+/g, '-'),
  product: { id: name, price, stock: 1, model, category: 'Armazón de Receta', imagenesCatalogo: [] },
});
const fmt = formatProducts([row('Frida C1', 'Frida C1'), row('Frida C5', 'Frida C5'), row('Vega C2', 'Vega C2')]);
check('dedup de variantes: Frida C1 + Frida C5 → 1 sola Frida', fmt.filter((p) => p.name.startsWith('Frida')).length === 1);
check('precio en 6 cuotas formateado', fmt[0].price.startsWith('6 cuotas de $'));
check('tope de 12 items', formatProducts(Array.from({ length: 30 }, (_, i) => row(`M${i}`))).length === 12);
check('el snapshot del home formatea productos', formatProducts(home.destacados).length > 0);
check('countProducts/hasProducts coherentes con el snapshot', hasProducts(home) && countProducts(home) > 0);

console.log(`\n✅ ${passed} checks OK — el storefront no puede quedar sin productos\n`);
