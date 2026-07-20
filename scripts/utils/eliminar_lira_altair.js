/**
 * Elimina Lira (G7010 C1) y Altair (GS7014S C2) — no están en ningún pedido.
 * Salvaguarda: si algún Product tiene OrderItems asociados, NO borra (avisa).
 *   PROD: DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/eliminar_lira_altair.js [--dry]
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const SLUGS = ['lira-c1', 'altair-c2'];

async function main() {
  const host = (process.env.DATABASE_URL || '').replace(/.*@/, '').replace(/\/.*/, '');
  console.log(`\n🎯 ${host} ${!/localhost/.test(host) ? '⚠️ PROD' : ''} ${DRY ? '· DRY' : ''}\n`);

  for (const slug of SLUGS) {
    // select puntual: evita la columna fantasma imageAlts (drift local vs prod)
    const wp = await prisma.webProduct.findUnique({ where: { slug }, select: { id: true, productId: true, name: true } });
    if (!wp) { console.log(`• ${slug}: no existe (ya borrado)`); continue; }
    const ventas = await prisma.orderItem.count({ where: { productId: wp.productId } });
    console.log(`• ${slug} (${wp.name}) — ventas asociadas: ${ventas}`);
    if (ventas > 0) { console.log(`   ⛔ tiene ventas, NO se borra (habría que despublicar). Salteo.`); continue; }
    if (DRY) { console.log('   (dry) se borraría WebProduct + Product'); continue; }
    await prisma.webProduct.deleteMany({ where: { slug } });          // deleteMany no selecciona columnas
    await prisma.product.deleteMany({ where: { id: wp.productId } });
    console.log('   🗑️  borrado (WebProduct + Product)');
  }
  console.log(DRY ? '\nDRY: nada borrado.' : '\n✅ Listo.');
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
