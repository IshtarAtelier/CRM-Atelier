/**
 * Corrige el duplicado de BC3063: el real es Pegaso (pegaso-c2, Receta).
 * Borra el Régulo duplicado (regulo-c2, Sol) que se creó por error. Reporta la imagen del Pegaso.
 *   PROD: DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/fix_bc3063_dup.js [--dry]
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

async function main() {
  const host = (process.env.DATABASE_URL || '').replace(/.*@/, '').replace(/\/.*/, '');
  const isProd = !/localhost|127\.0\.0\.1/.test(host);
  console.log(`\n🎯 DB: ${host} ${isProd ? '⚠️  PROD' : '· local'} ${DRY ? '· DRY' : ''}\n`);

  // 1) Estado del Pegaso real
  const peg = await prisma.webProduct.findUnique({ where: { slug: 'pegaso-c2' }, include: { product: true } });
  if (peg) {
    const img = peg.imageUrl || (peg.images && peg.images[0]) || '';
    const imgDesc = img.startsWith('data:') ? `data-uri ${Math.round(img.length/1024)}KB` : (img ? img.slice(0, 70) : '(sin imagen)');
    console.log(`PEGASO real: "${peg.name}" model=${peg.product.model} cat=${peg.category} stock=${peg.product.stock}`);
    console.log(`   imagen: ${imgDesc}`);
    console.log(`   imágenes en catálogo (Product): ${(peg.product.imagenesCatalogo||[]).length}`);
  } else { console.log('⚠️ No encontré pegaso-c2'); }

  // 2) Borrar el duplicado Régulo
  const reg = await prisma.webProduct.findUnique({ where: { slug: 'regulo-c2' }, include: { product: true } });
  if (!reg) { console.log('\nRégulo duplicado: no existe (¿ya borrado?)'); await prisma.$disconnect(); return; }
  console.log(`\nRÉGULO duplicado: "${reg.name}" model=${reg.product.model} cat=${reg.category} id=${reg.product.id}`);

  const orders = await prisma.orderItem.count({ where: { productId: reg.productId } });
  console.log(`   OrderItems que lo referencian: ${orders}`);
  if (DRY) { console.log('\nDRY: nada borrado.'); await prisma.$disconnect(); return; }

  if (orders > 0) {
    await prisma.webProduct.update({ where: { id: reg.id }, data: { isActive: false } });
    await prisma.product.update({ where: { id: reg.productId }, data: { publishToWeb: false } });
    console.log('\n⚠️ Tenía órdenes → lo DESACTIVÉ (no lo borro para no perder historial).');
  } else {
    await prisma.webProduct.delete({ where: { id: reg.id } });
    await prisma.product.delete({ where: { id: reg.productId } });
    console.log('\n✅ Régulo duplicado BORRADO (sin órdenes).');
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
