/**
 * Saca el aviso "⏳ PREVENTA · Entrega estimada en ~1 semana" del principio de
 * las descripciones de producto. ESCRIBE en la base (solo con `--aplicar`).
 *
 * Por qué: las fichas dicen "En Stock" y a la vez arrancan con un aviso de
 * preventa. El cliente lee las dos cosas y no sabe cuál vale — y en una compra
 * de ticket alto esa duda se resuelve cerrando la pestaña. El aviso era
 * información operativa temporal (mientras no llegaba el stock) que quedó
 * pegada. Además hace que Merchant Center pueda desaprobar los productos por
 * contradecir la disponibilidad declarada.
 *
 * No vive en el código: es texto guardado en la descripción de cada producto.
 * Por eso hace falta este script y no un deploy.
 *
 * Qué hace exactamente: saca SOLO ese prefijo y deja intacto el resto de la
 * descripción. No toca `stock` ni la disponibilidad — si un producto es
 * realmente preventa, eso se marca por stock, no con un texto pegado adelante.
 *
 * Uso (base local):
 *   node scripts/maintenance/sacar-aviso-preventa.mjs             → simula
 *   node scripts/maintenance/sacar-aviso-preventa.mjs --aplicar   → escribe
 *
 * Contra PRODUCCIÓN — requiere autorización explícita de la dueña. `--produccion`
 * usa PROD_DATABASE_URL en lugar de DATABASE_URL, así no hay que armar la variable
 * a mano en la línea de comandos (que es como se termina apuntando a la base
 * equivocada por un typo):
 *   node --env-file=.env scripts/maintenance/sacar-aviso-preventa.mjs --produccion
 *   node --env-file=.env scripts/maintenance/sacar-aviso-preventa.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');

if (PRODUCCION && !process.env.PROD_DATABASE_URL) {
  console.error('Falta PROD_DATABASE_URL. Corré el comando con --env-file=.env desde la carpeta que tiene el .env.');
  process.exit(1);
}

const prisma = new PrismaClient(
  PRODUCCION ? { datasources: { db: { url: process.env.PROD_DATABASE_URL } } } : {},
);

/**
 * El aviso, en las variantes que aparecieron. Se saca solo si está al PRINCIPIO:
 * si alguien lo escribió en el medio de una descripción es una frase suya, no el
 * cartel automático, y no se toca.
 */
const PATRON = /^\s*(⏳\s*)?PREVENTA\s*[·:.-]?\s*Entrega estimada en\s*~?\s*1\s*semana[^\n.]*\.?\s*/i;

const url = (PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL) || '';
const esProd = !url.includes('localhost') && !url.includes('127.0.0.1');
console.log(`Base: ${esProd ? '⚠️  PRODUCCIÓN' : 'local'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'simulación'}\n`);

const productos = await prisma.webProduct.findMany({
  where: { description: { contains: 'PREVENTA', mode: 'insensitive' } },
  select: { id: true, slug: true, description: true },
});

if (!productos.length) {
  console.log('No hay ninguna descripción con el aviso de preventa.');
  await prisma.$disconnect();
  process.exit(0);
}

const cambios = [];
const noCoinciden = [];

for (const p of productos) {
  const limpia = (p.description || '').replace(PATRON, '').trimStart();
  if (limpia !== (p.description || '')) cambios.push({ ...p, limpia });
  else noCoinciden.push(p);
}

console.log(`Productos con "PREVENTA" en la descripción: ${productos.length}`);
console.log(`  ✅ se les puede sacar el aviso : ${cambios.length}`);
console.log(`  ⚠️  la palabra está en otro lado: ${noCoinciden.length} (no se tocan)\n`);

for (const c of cambios.slice(0, 8)) {
  console.log(`  ${c.slug}`);
  console.log(`    antes: ${(c.description || '').slice(0, 90).replace(/\n/g, ' ')}…`);
  console.log(`    queda: ${c.limpia.slice(0, 90).replace(/\n/g, ' ')}…`);
}
if (cambios.length > 8) console.log(`  … y ${cambios.length - 8} más`);

for (const n of noCoinciden) {
  console.log(`\n  ⚠️  ${n.slug}: dice PREVENTA pero no con el formato del cartel. Revisar a mano:`);
  console.log(`      ${(n.description || '').slice(0, 120).replace(/\n/g, ' ')}`);
}

if (!APLICAR) {
  console.log('\nSimulación: no se escribió nada. Agregar --aplicar para hacerlo.');
  await prisma.$disconnect();
  process.exit(0);
}

let hechos = 0;
for (const c of cambios) {
  await prisma.webProduct.update({ where: { id: c.id }, data: { description: c.limpia } });
  hechos++;
}
console.log(`\n✅ ${hechos} descripciones actualizadas.`);
await prisma.$disconnect();
