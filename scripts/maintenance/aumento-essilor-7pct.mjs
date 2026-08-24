/**
 * Aumento del 7% en los cristales del laboratorio Optovision (Essilor/Varilux
 * y las marcas que procesa el mismo lab: Kodak, Sygnus, Opto, Transitions).
 * ESCRIBE en la base (solo con --aplicar).
 *
 * POR QUÉ 7%
 * Relevamiento de precios de la competencia (24/8/2026, Ishtar) contra Lens,
 * Óptica Valencia, Urban Glass, Tutanoski, Paesani, Peretti — comparando
 * SOLO contra los que también dan 2x1 (Lens y Valencia, la comparación
 * justa). Con un 7% el Comfort Max y el XR Design quedan justo debajo del
 * techo de mercado (Valencia) sin pasarlo. Solo se sube `price` (P.
 * Minorista): `wholesalePrice`, `cost` y `baseCost` NO se tocan — es un
 * aumento de margen, no un ajuste de costo.
 *
 * Uso:
 *   node --env-file=.env scripts/maintenance/aumento-essilor-7pct.mjs --produccion
 *   node --env-file=.env scripts/maintenance/aumento-essilor-7pct.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const PORCENTAJE = 0.07;

if (PRODUCCION && !process.env.PROD_DATABASE_URL) {
  console.error('Falta PROD_DATABASE_URL. Correr con --env-file=.env desde la carpeta que tiene el .env.');
  process.exit(1);
}

const prisma = new PrismaClient(
  PRODUCCION ? { datasources: { db: { url: process.env.PROD_DATABASE_URL } } } : {},
);

console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'local'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'simulación'} · aumento: 7%\n`);

const productos = await prisma.product.findMany({
  where: { category: 'Cristal', laboratory: 'OPTOVISION' },
  select: { id: true, name: true, brand: true, price: true },
  orderBy: [{ brand: 'asc' }, { price: 'asc' }],
});

if (!productos.length) {
  console.log('No hay productos que coincidan (category=Cristal, laboratory=OPTOVISION). No se toca nada.');
  await prisma.$disconnect();
  process.exit(0);
}

const porMarca = {};
const cambios = [];
for (const p of productos) {
  const de = p.price;
  const a = Math.round(de * (1 + PORCENTAJE));
  cambios.push({ productId: p.id, nombre: `${p.brand} · ${p.name}`, de, a });
  (porMarca[p.brand] = porMarca[p.brand] || []).push({ nombre: p.name, de, a });
}

for (const [marca, filas] of Object.entries(porMarca)) {
  console.log(`${marca} (${filas.length}):`);
  for (const f of filas) {
    console.log(`   $${f.de.toLocaleString('es-AR')} → $${f.a.toLocaleString('es-AR')}   ${f.nombre}`);
  }
  console.log('');
}

console.log(`TOTAL: ${cambios.length} productos suben 7%.`);

if (!APLICAR) {
  console.log('\nSimulación: no se escribió nada. Agregar --aplicar para hacerlo.');
  await prisma.$disconnect();
  process.exit(0);
}

let hechos = 0;
for (const c of cambios) {
  await prisma.product.update({ where: { id: c.productId }, data: { price: c.a } });
  hechos++;
}
console.log(`\n✅ ${hechos} precios actualizados.`);
console.log('Las cuotas y el precio de contado se recalculan solos: salen del precio de lista.');
await prisma.$disconnect();
