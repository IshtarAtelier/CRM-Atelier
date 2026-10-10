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
import { readFileSync, existsSync } from 'node:fs';
import { createResilientSource, defaultIsEmpty } from '../../src/lib/catalog/resilience.ts';
import { CATALOG_SOURCE_KEYS, RECETA_BASE_WHERE, SOL_BASE_WHERE, FICHA_EN_TIENDA, FICHA_PUBLICADA, sePuedeVenderEnLaWeb, slugDeFichaPublicada } from '../../src/lib/catalog/queries.ts';
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

// ── Las fotos que promete el snapshot tienen que existir ────────────────────
// El snapshot es lo que se sirve si la base no responde. De nada sirve que
// tenga productos si sus imágenes ya no están en `public/`: la tienda de
// emergencia saldría con los cuadros rotos.
//
// Y es más que estética: cuando un producto se da de baja, sus fotos se borran
// del repo pero la fila queda congelada en el snapshot commiteado. Así se
// colaron 8 productos —apolo, ares, atlas, eros, febo, jano, nestor— cuyas
// fichas hoy devuelven 404 en producción. Con la base caída, el visitante los
// vería listados y al tocarlos caería en una pared. La foto faltante es la
// señal barata y local de que la fila está muerta.
const rutasDeImagen = new Set();
const recolectar = (x) => {
  if (typeof x === 'string') {
    if (/^\/(images|assets)\//.test(x)) rutasDeImagen.add(x);
  } else if (Array.isArray(x)) x.forEach(recolectar);
  else if (x && typeof x === 'object') Object.values(x).forEach(recolectar);
};
Object.values(snapshots).forEach(recolectar);

const publicDir = new URL('../../public/', import.meta.url);
const faltantes = [...rutasDeImagen]
  .filter((ruta) => !existsSync(new URL(`.${ruta}`, publicDir)))
  .sort();

if (faltantes.length) {
  console.error(`\n  ✗ ${faltantes.length} imágenes referenciadas por los snapshots NO existen en public/:`);
  for (const f of faltantes) console.error(`      ${f}`);
  console.error('\n  Suele significar que el snapshot quedó viejo y arrastra productos dados de baja.');
  console.error('  Se arregla regenerándolo contra la base de producción: npm run snapshot:catalog\n');
}
check(`snapshots: las ${rutasDeImagen.size} imágenes referenciadas existen en public/`, faltantes.length === 0);

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

console.log('\n— Vidrieras de armazones: página y respaldo con el mismo filtro (10/10/2026) —\n');
// El respaldo de /receta traía un cristal Xperio de $913.780 sin stock que la
// página en vivo excluía: las dos usaban filtros distintos.
for (const [nombre, where] of [['receta', RECETA_BASE_WHERE], ['sol', SOL_BASE_WHERE]]) {
  check(`${nombre}: el WHERE base excluye cristales y lo que no tiene stock`,
    where.product?.category?.not === 'Cristal' && where.product?.stock?.gt === 0);
}
for (const [archivo, constante] of [['src/app/receta/page.tsx', 'RECETA_BASE_WHERE'], ['src/app/lentes-de-sol/page.tsx', 'SOL_BASE_WHERE']]) {
  const fuente = readFileSync(new URL(`../../${archivo}`, import.meta.url), 'utf8');
  check(`${archivo} usa ${constante} (no una copia propia del filtro)`, new RegExp(`whereClause = ${constante}`).test(fuente));
}

console.log('\n— Una sola regla de qué se ve en la tienda (10/10/2026) —\n');
check('FICHA_EN_TIENDA: activa, publicada, con stock y nunca un cristal',
  FICHA_EN_TIENDA.isActive === true && FICHA_EN_TIENDA.product.publishToWeb === true
  && FICHA_EN_TIENDA.product.stock?.gt === 0 && FICHA_EN_TIENDA.product.category?.not === 'Cristal');
check('FICHA_PUBLICADA (abrir por dirección): activa, publicada y nunca un cristal',
  FICHA_PUBLICADA.isActive === true && FICHA_PUBLICADA.product.publishToWeb === true
  && FICHA_PUBLICADA.product.category?.not === 'Cristal');
// Todo lo público que lee fichas: ninguno escribe su propio `isActive: true`.
// Eran ~20 copias a mano y habían divergido (la ficha abría cualquier producto
// del CRM por su id; el home no excluía cristales en Sol/Receta).
const PUBLICOS = [
  'src/lib/catalog/queries.ts',
  'src/app/producto/[slug]/page.tsx',
  'src/app/sitemap.ts',
  'src/app/receta/page.tsx',
  'src/app/lentes-de-sol/page.tsx',
  'src/components/Storefront/ListadoCategoria.tsx',
  'src/app/api/catalog/route.ts',
  'src/app/api/health/route.ts',
];
for (const archivo of PUBLICOS) {
  let fuente = readFileSync(new URL(`../../${archivo}`, import.meta.url), 'utf8');
  // En queries.ts la regla se DEFINE: se mira solo lo que viene después.
  if (archivo.endsWith('queries.ts')) fuente = fuente.slice(fuente.indexOf('export const SOL_BASE_WHERE'));
  const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  check(`${archivo}: sin un \`isActive: true\` propio (usa FICHA_EN_TIENDA / FICHA_PUBLICADA)`, !/isActive:\s*true/.test(sinComentarios));
  // Y usa la regla: sin esto, un \`where: {}\` (que lista TODO) también pasaba.
  if (!archivo.endsWith('queries.ts')) {
    check(`${archivo}: usa la regla común`, /\b(FICHA_EN_TIENDA|FICHA_PUBLICADA|FICHA_MAYORISTA|RECETA_BASE_WHERE|SOL_BASE_WHERE|PRODUCTO_EN_TIENDA)\b/.test(sinComentarios));
  }
}
// El catálogo mayorista, el checkout y los links del bot: la misma regla.
for (const [archivo, patron, que] of [
  ['src/app/api/store/products/route.ts', /where:\s*FICHA_MAYORISTA/, 'el catálogo mayorista lista FICHA_MAYORISTA'],
  ['src/app/api/checkout/payway/route.ts', /sePuedeVenderEnLaWeb\(dbProduct\)/, 'el checkout solo vende lo publicado (sePuedeVenderEnLaWeb)'],
  ['src/services/armazones-al-dia.service.ts', /sePuedeVenderEnLaWeb\(p\)/, 'el carrito se pone al día con la misma regla'],
  ['src/app/api/bot/pricing/route.ts', /slugDeFichaPublicada\(p\)/, 'el bot solo linkea fichas que se pueden abrir'],
]) {
  const fuente = readFileSync(new URL(`../../${archivo}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  check(`${que} (${archivo})`, patron.test(fuente));
}
{
  const venta = (o) => sePuedeVenderEnLaWeb({ publishToWeb: true, category: 'Armazón de Receta', webProducts: [{ isActive: true }], ...o });
  check('sePuedeVenderEnLaWeb: publicado con ficha activa → sí', venta({}) === true);
  check('sePuedeVenderEnLaWeb: ficha oculta en /admin/web → no', venta({ webProducts: [{ isActive: false }] }) === false);
  check('sePuedeVenderEnLaWeb: sin ficha → no', venta({ webProducts: [] }) === false);
  check('sePuedeVenderEnLaWeb: despublicado → no', venta({ publishToWeb: false }) === false);
  check('sePuedeVenderEnLaWeb: cristal → no', venta({ category: 'Cristal' }) === false);
  check('slugDeFichaPublicada: solo la ficha activa', slugDeFichaPublicada({ publishToWeb: true, category: 'Lentes de Sol', webProducts: [{ slug: 'vieja', isActive: false }, { slug: 'vigente', isActive: true }] }) === 'vigente'
    && slugDeFichaPublicada({ publishToWeb: false, category: 'Lentes de Sol', webProducts: [{ slug: 'x', isActive: true }] }) === null);
}
const ficha = readFileSync(new URL('../../src/app/producto/[slug]/page.tsx', import.meta.url), 'utf8');
check('la ficha no abre un Product suelto por id (cristales, internos, desmarcados)', !/prisma\.product\.find(Unique|First)\(/.test(ficha));
check('la ficha busca con FICHA_PUBLICADA', /\.\.\.FICHA_PUBLICADA,\s*\n\s*OR:/.test(ficha));

console.log(`\n✅ ${passed} checks OK — el storefront no puede quedar sin productos\n`);
