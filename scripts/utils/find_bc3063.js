/** Solo lectura: busca Pegaso / BC3063 / Régulo para ver el estado real. */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const host = (process.env.DATABASE_URL || '').replace(/.*@/, '').replace(/\/.*/, '');
  console.log(`\n🎯 DB: ${host}\n`);
  const prods = await prisma.product.findMany({
    where: { OR: [
      { name: { contains: 'pegaso', mode: 'insensitive' } },
      { name: { contains: 'regulo', mode: 'insensitive' } },
      { name: { contains: 'régulo', mode: 'insensitive' } },
      { model: { contains: 'BC3063', mode: 'insensitive' } },
      { model: { contains: '3063', mode: 'insensitive' } },
    ] },
    include: { webProducts: { select: { slug: true, name: true, isActive: true, category: true } } },
  });
  console.log(`Encontrados: ${prods.length}\n`);
  for (const p of prods) {
    console.log(`• Product: "${p.name}" | model="${p.model}" | cat=${p.category} | stock=${p.stock} | pubWeb=${p.publishToWeb} | id=${p.id}`);
    for (const wp of p.webProducts) console.log(`   └ WebProduct: slug=${wp.slug} name="${wp.name}" active=${wp.isActive} cat=${wp.category}`);
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
