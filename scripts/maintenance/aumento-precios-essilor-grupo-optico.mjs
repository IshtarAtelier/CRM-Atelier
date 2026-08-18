/**
 * Sube 7% el costo y el precio de lista de los cristales de Essilor y Grupo Óptico.
 * ESCRIBE en la base (solo con `--aplicar`).
 *
 * EL PORQUÉ
 * Essilor y Grupo Óptico subieron un 7% lo que le facturan a la óptica. Hay que
 * trasladarlo: al costo (lo que cuesta comprarlo) y al precio de lista (lo que paga
 * el cliente).
 *
 * ALCANCE (decidido 14/8/2026)
 *   - laboratory = 'OPTOVISION' (116 productos): TODAS las marcas que factura
 *     Optovision — Essilor, Varilux, Sygnus, "Mi primer Varilux", Kodak, Opto —
 *     sin excepción, es Essilor a estos efectos.
 *   - laboratory = 'GRUPO OPTICO' (21 productos).
 *   - laboratory = 'ESSILOR' literal (5 productos, todos línea Transitions): quedaron
 *     tageados así por una carga que no pasó por `autoCorrectLab()`
 *     (`src/utils/product-controllers.ts`), que normaliza variantes de "OPTO"/
 *     "OPTOVISION" pero no reconoce "ESSILOR". Son Essilor igual, entran en el
 *     aumento — y de paso el script les corrige `laboratory` a 'OPTOVISION' para
 *     que no se vuelvan a perder en un filtro futuro.
 *   - NO se toca 'LA CAMARA' (5 productos): no es Essilor ni Grupo Óptico.
 *
 * BASECOST VACÍO — no hay fórmula que recalcular
 * `Product.baseCost` (el "costo pelado" antes de calibrado+IVA, fórmula en
 * `src/lib/lens-cost.ts`) está NULL en el 100% de estos 142 productos: nunca se
 * cargó, solo se guardó el `cost` final. Sin baseCost no hay nada que hacerle a la
 * fórmula de calibrado/IVA — se multiplica `cost` directamente. Si en algún momento
 * se empieza a cargar `baseCost` de verdad, este script deja de ser el patrón
 * correcto: ahí correspondería recalcular con `computeFinalLensCost()` en vez de
 * multiplicar el final.
 *
 * NO toca `wholesalePrice` ni `salePrice` (están en 0/null en toda la categoría
 * Cristal al momento de escribir esto).
 *
 * CORRECCIÓN PUNTUAL — 'Orgánico fotocromático Gris' (GRUPO OPTICO, id abajo)
 * Antes de este aumento tenía costo $516.331 y precio $105.000 — el costo era ~5x
 * el precio, y por lejos el costo más alto de CUALQUIER monofocal de Grupo Óptico
 * (el resto cuesta entre $6.000 y $100.000). Confirmado con la dueña 14/8/2026:
 * los valores estaban invertidos y el producto es origin STOCK (lo tenía vacío).
 * Se corrige ANTES de aplicar el 7%: costo→$105.000, precio→$516.331,
 * origin→'STOCK' — y el aumento se aplica sobre esos valores ya corregidos, no
 * sobre los rotos.
 *
 * Uso:
 *   node --env-file=.env scripts/maintenance/aumento-precios-essilor-grupo-optico.mjs
 *   node --env-file=.env scripts/maintenance/aumento-precios-essilor-grupo-optico.mjs --aplicar
 *   node --env-file=.env scripts/maintenance/aumento-precios-essilor-grupo-optico.mjs --produccion
 *   node --env-file=.env scripts/maintenance/aumento-precios-essilor-grupo-optico.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const AUMENTO = 0.07;
const LABORATORIOS = ['OPTOVISION', 'GRUPO OPTICO', 'ESSILOR'];

// Ver "CORRECCIÓN PUNTUAL" arriba: costo/precio invertidos + origin faltante.
const CORRECCION_ORGANICO_FOTOCROMATICO_GRIS = {
  id: 'cmmxzsuc2004j10yt4nn8ruue',
  costCorregido: 105000,
  priceCorregido: 516331,
  origin: 'STOCK',
};

if (PRODUCCION && !process.env.PROD_DATABASE_URL) {
  console.error('Falta PROD_DATABASE_URL. Correr con --env-file=.env desde la carpeta que tiene el .env.');
  process.exit(1);
}

const prisma = new PrismaClient(
  PRODUCCION ? { datasources: { db: { url: process.env.PROD_DATABASE_URL } } } : {},
);

const $ = (n) => `$${Math.round(n).toLocaleString('es-AR')}`;

const productos = await prisma.product.findMany({
  where: { category: 'Cristal', laboratory: { in: LABORATORIOS } },
  select: { id: true, name: true, brand: true, laboratory: true, cost: true, price: true },
  orderBy: [{ laboratory: 'asc' }, { name: 'asc' }],
});

console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'local'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'simulación'}\n`);

const cambios = productos.map((p) => {
  const correccion = p.id === CORRECCION_ORGANICO_FOTOCROMATICO_GRIS.id
    ? CORRECCION_ORGANICO_FOTOCROMATICO_GRIS
    : null;
  const costBase = correccion ? correccion.costCorregido : p.cost;
  const priceBase = correccion ? correccion.priceCorregido : p.price;
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    laboratoryActual: p.laboratory,
    laboratoryNuevo: p.laboratory === 'ESSILOR' ? 'OPTOVISION' : p.laboratory,
    origenNuevo: correccion?.origin,
    costDe: p.cost,
    costBase,
    costA: Math.round(costBase * (1 + AUMENTO)),
    priceDe: p.price,
    priceBase,
    priceA: Math.round(priceBase * (1 + AUMENTO)),
    corregido: !!correccion,
  };
});

for (const lab of LABORATORIOS) {
  const grupo = cambios.filter((c) => c.laboratoryActual === lab);
  if (!grupo.length) continue;
  const relabel = lab === 'ESSILOR' ? ` → se retagea a 'OPTOVISION'` : '';
  console.log(`\n=== laboratory = '${lab}'${relabel} (${grupo.length} productos) ===`);
  for (const c of grupo) {
    console.log(`  ${c.name}${c.brand ? ` [${c.brand}]` : ''}`);
    if (c.corregido) {
      console.log(`     ⚠️  corregido (costo/precio invertidos) · origin → '${c.origenNuevo}'`);
      console.log(`     costo:  ${$(c.costDe)} (roto) → ${$(c.costBase)} (corregido) → ${$(c.costA)} (+7%)`);
      console.log(`     precio: ${$(c.priceDe)} (roto) → ${$(c.priceBase)} (corregido) → ${$(c.priceA)} (+7%)`);
    } else {
      console.log(`     costo:  ${$(c.costDe)} → ${$(c.costA)}`);
      console.log(`     precio: ${$(c.priceDe)} → ${$(c.priceA)}`);
    }
  }
}

console.log(`\nTOTAL: ${cambios.length} cristales suben ${(AUMENTO * 100).toFixed(0)}% de costo y precio.`);

if (!APLICAR) {
  console.log('\nSimulación: no se escribió nada. Agregar --aplicar para hacerlo.');
  await prisma.$disconnect();
  process.exit(0);
}

let hechos = 0;
for (const c of cambios) {
  await prisma.product.update({
    where: { id: c.id },
    data: {
      cost: c.costA,
      price: c.priceA,
      ...(c.laboratoryNuevo !== c.laboratoryActual ? { laboratory: c.laboratoryNuevo } : {}),
      ...(c.origenNuevo ? { origin: c.origenNuevo } : {}),
    },
  });
  hechos++;
}
console.log(`\n✅ ${hechos} cristales actualizados.`);
await prisma.$disconnect();
