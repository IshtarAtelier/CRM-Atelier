/**
 * Reemplaza el teléfono viejo (+5493513447219) por el canónico (+5493518685644)
 * en el campo `content` de los 18 posts de contenidos-essilor, donde quedó
 * hardcodeado dentro del bloque JSON-LD embebido.
 *
 * Uso:
 *   node scripts/maintenance/fix-old-phone-blog-posts.js           # dry-run (solo muestra)
 *   node scripts/maintenance/fix-old-phone-blog-posts.js --apply   # aplica el update contra PROD_DATABASE_URL
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const VIEJO = "+5493513447219";
const NUEVO = "+5493518685644";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL } },
});

async function main() {
  const aplicar = process.argv.includes("--apply");

  const posts = await prisma.blogPost.findMany({
    where: { content: { contains: VIEJO } },
    select: { id: true, slug: true, title: true, content: true },
  });

  if (posts.length === 0) {
    console.log("Ningún post tiene el teléfono viejo. Nada para hacer.");
    return;
  }

  console.log(`${posts.length} posts con el teléfono viejo:\n`);
  for (const p of posts) console.log(`  - ${p.slug}`);

  if (!aplicar) {
    console.log("\nDry-run. Corré con --apply para escribir en la base.");
    return;
  }

  for (const p of posts) {
    const nuevoContent = p.content.split(VIEJO).join(NUEVO);
    await prisma.blogPost.update({
      where: { id: p.id },
      data: { content: nuevoContent },
      select: { id: true },
    });
    console.log(`✓ actualizado: ${p.slug}`);
  }

  console.log(`\n${posts.length} posts actualizados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
