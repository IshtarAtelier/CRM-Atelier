/**
 * Ajusta los precios de lista del catálogo para que haya una ESCALERA.
 * ESCRIBE en la base (solo con `--aplicar`).
 *
 * EL PROBLEMA QUE RESUELVE
 * El 10/8/2026 el catálogo era plano: 82 de 114 productos valían exactamente
 * $160.000 y 111 de 114 estaban entre $160.000 y $200.000. Sin escalera, el
 * cliente no puede elegir — nada se siente una oportunidad y nada se siente un
 * gusto. Y peor: los precios estaban DESALINEADOS DEL COSTO. El titanio costaba
 * un 55% más que el acetato ($45.000 contra $29.000) y se vendía apenas un 18%
 * más caro. Se estaba subsidiando el mejor producto con el más barato.
 *
 * EL CRITERIO
 * No se toca la entrada. Los 82 armazones de receta a $160.000 son el 72% del
 * catálogo y también lo que se vende en el mostrador: bajarlos costaría plata
 * real en el canal que SÍ factura, para arreglar un problema del canal que no.
 * La escalera se construye moviendo lo que está mal ubicado alrededor de ese
 * piso, dentro del ±10-15% que autorizó la dueña.
 *
 * NO toca `wholesalePrice` (el precio mayorista es otra negociación) ni
 * `salePrice` (las ofertas se cargan aparte, y hoy no hay ninguna).
 *
 * Uso:
 *   node --env-file=.env scripts/maintenance/escalera-de-precios.mjs --produccion
 *   node --env-file=.env scripts/maintenance/escalera-de-precios.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');

if (PRODUCCION && !process.env.PROD_DATABASE_URL) {
  console.error('Falta PROD_DATABASE_URL. Correr con --env-file=.env desde la carpeta que tiene el .env.');
  process.exit(1);
}

const prisma = new PrismaClient(
  PRODUCCION ? { datasources: { db: { url: process.env.PROD_DATABASE_URL } } } : {},
);

/**
 * Se identifica por PRECIO ACTUAL + CATEGORÍA, no por una lista de nombres:
 * así el script sigue siendo correcto si mañana entran modelos nuevos a la
 * misma banda. Si una banda ya no existe (porque alguien movió un precio a
 * mano), el script avisa en vez de adivinar.
 */
const ESCALERA = [
  {
    desde: 150_000, categoria: 'Sol', hasta: 165_000,
    por: 'era el único producto por debajo de la entrada, y con el peor margen de todos (4,4x)',
  },
  {
    desde: 195_000, categoria: 'Clip-On', hasta: 175_000,
    por: 'un clip-on costaba MÁS que un armazón de receta. Es un segundo par, una compra por impulso: tiene que estar entre la entrada y el premium, no arriba de todo',
  },
  {
    desde: 189_000, categoria: null, hasta: 215_000,
    por: 'el titanio. Cuesta 55% más que el acetato y se vendía 18% más caro: se estaba regalando. Pasa de 4,2x a 4,8x, todavía por debajo del margen de la entrada',
  },
  {
    desde: 200_000, categoria: 'Sol', hasta: 225_000,
    por: 'acetato italiano Mazzucchelli. Es el producto con más historia del catálogo y estaba a un paso de la entrada',
  },
];

/** Estos NO se tocan, y por qué. Que esté escrito evita que alguien "complete" la tabla. */
const INTOCABLES = [
  [160_000, '82 armazones de receta: es la ENTRADA y el 72% del catálogo. También es lo que se vende en el mostrador — moverlo cuesta plata en el canal que sí factura'],
  [280_000, 'no es un armazón sino un CRISTAL (Essilor Orma Blue UV Crizal Saphire HR) publicado por error en el catálogo de armazones, con costo $0. Es un problema de catálogo, no de precio'],
  [350_000, 'Wicue Negro: producto especial, margen 10,9x. No entra en la escalera de armazones'],
];

const productos = await prisma.webProduct.findMany({
  where: { isActive: true },
  select: {
    id: true, name: true, category: true,
    product: { select: { id: true, price: true, wholesalePrice: true } },
  },
});

console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'local'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'simulación'}\n`);

const cambios = [];
for (const regla of ESCALERA) {
  const afectados = productos.filter(
    (w) => w.product?.price === regla.desde && (!regla.categoria || w.category === regla.categoria),
  );
  if (!afectados.length) {
    console.log(`⚠️  Nadie a $${regla.desde.toLocaleString('es-AR')}${regla.categoria ? ` en ${regla.categoria}` : ''} — ¿ya se movió a mano? No se toca.`);
    continue;
  }
  const costo = afectados[0].product.wholesalePrice || 0;
  const pct = Math.round(((regla.hasta - regla.desde) / regla.desde) * 100);
  console.log(`$${regla.desde.toLocaleString('es-AR')} → $${regla.hasta.toLocaleString('es-AR')}  (${pct > 0 ? '+' : ''}${pct}%)  ·  ${afectados.length} productos`);
  console.log(`   margen: ${costo ? (regla.desde / costo).toFixed(1) : '?'}x → ${costo ? (regla.hasta / costo).toFixed(1) : '?'}x`);
  console.log(`   ${regla.por}`);
  console.log(`   ${afectados.slice(0, 5).map((a) => a.name).join(', ')}${afectados.length > 5 ? ` y ${afectados.length - 5} más` : ''}\n`);
  for (const a of afectados) cambios.push({ productId: a.product.id, nombre: a.name, de: regla.desde, a: regla.hasta });
}

console.log('NO SE TOCAN:');
for (const [precio, motivo] of INTOCABLES) {
  const n = productos.filter((w) => w.product?.price === precio).length;
  console.log(`  $${precio.toLocaleString('es-AR')} (${n}): ${motivo}`);
}

if (!cambios.length) {
  console.log('\nNo hay nada que cambiar.');
  await prisma.$disconnect();
  process.exit(0);
}

console.log(`\nTOTAL: ${cambios.length} productos cambian de precio.`);

if (!APLICAR) {
  console.log('\nSimulación: no se escribió nada. Agregar --aplicar para hacerlo.');
  await prisma.$disconnect();
  process.exit(0);
}

// Uno por uno y no un updateMany por banda: si algo falla a mitad, queda claro
// dónde. Son 30 filas, no hace falta optimizar.
let hechos = 0;
for (const c of cambios) {
  await prisma.product.update({ where: { id: c.productId }, data: { price: c.a } });
  hechos++;
}
console.log(`\n✅ ${hechos} precios actualizados.`);
console.log('Las cuotas y el precio de contado se recalculan solos: salen del precio de lista.');
await prisma.$disconnect();
