/**
 * Agrega "Blanco" al nombre de los cristales que lo son.
 * ESCRIBE en la base (solo con `--aplicar`).
 *
 * POR QUÉ
 * Un cristal blanco puede tener filtro azul y antirreflejo y sigue siendo
 * blanco: no es de sol. Los de sol son los teñidos, los fotocromáticos
 * (Transitions, Acclimates, Xtractive, fotosensibles) y los polarizados
 * (Xperio) o espejados. Como el nombre no lo aclaraba, el vendedor tenía que
 * deducirlo del material — y el cliente no tenía cómo saberlo.
 *
 * QUÉ TOCA
 * Solo `Product.name`, y solo de cristales que NO son de sol y que todavía no
 * dicen "blanco". El precio, el costo y todo lo demás quedan intactos.
 *
 * DÓNDE PONE LA PALABRA
 * Antes del "2x1" final, que es como ya están escritos los que sí lo aclaran
 * ("SMART FREE - Organico 1.49 Blanco 2x1"). Si el nombre no termina en 2x1,
 * va al final.
 *
 * OJO CON EL HISTÓRICO: las ventas ya hechas guardan el nombre congelado
 * (productNameSnapshot), así que renombrar NO les cambia lo que dicen.
 *
 * Uso:
 *   node --env-file=.env scripts/maintenance/aclarar-cristal-blanco.mjs --produccion
 *   node --env-file=.env scripts/maintenance/aclarar-cristal-blanco.mjs --produccion --aplicar
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

/** Lo que hace que un cristal NO sea blanco. */
const DE_SOL = /transitions|fotocrom|otocrom|fotosensible|xperio|polariz|acclimat|xtractive|espejad|te[ñn]ido/i;
/** Ya lo aclara. */
const YA_LO_DICE = /blanc/i;

console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'local'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'simulación'}\n`);

const cristales = await prisma.product.findMany({
  where: { category: 'Cristal' },
  select: { id: true, name: true, brand: true },
  orderBy: [{ brand: 'asc' }, { name: 'asc' }],
});

const cambios = [];
const deSol = [];
for (const p of cristales) {
  const nombre = (p.name || '').trim();
  if (!nombre) continue;
  if (DE_SOL.test(nombre)) { deSol.push(`${p.brand} · ${nombre}`); continue; }
  if (YA_LO_DICE.test(nombre)) continue;

  // Antes del "2x1" final; si no lo tiene, al final.
  const nuevo = /2\s?x\s?1\s*$/i.test(nombre)
    ? nombre.replace(/\s*(2\s?x\s?1)\s*$/i, ' Blanco $1')
    : `${nombre} Blanco`;

  cambios.push({ id: p.id, marca: p.brand, de: nombre, a: nuevo.replace(/\s{2,}/g, ' ').trim() });
}

for (const c of cambios) {
  console.log(`   ${c.marca}`);
  console.log(`     antes:  ${c.de}`);
  console.log(`     ahora:  ${c.a}`);
}

console.log(`\nTOTAL: ${cambios.length} cristales pasan a aclarar "Blanco".`);
console.log(`No se tocan: ${deSol.length} de sol (teñidos, fotocromáticos, polarizados, espejados) y los que ya lo dicen.`);

if (!cambios.length) {
  await prisma.$disconnect();
  process.exit(0);
}

if (!APLICAR) {
  console.log('\nSimulación: no se escribió nada. Agregar --aplicar para hacerlo.');
  await prisma.$disconnect();
  process.exit(0);
}

let hechos = 0;
for (const c of cambios) {
  await prisma.product.update({ where: { id: c.id }, data: { name: c.a } });
  hechos++;
}
console.log(`\n✅ ${hechos} cristales renombrados.`);
console.log('Las ventas ya hechas no cambian: guardan el nombre congelado de cuando se vendieron.');
await prisma.$disconnect();
