/**
 * Swap Pegaso: BC3063-C1 -> BC3063-C2 (mismo modelo de RECETA, otro color).
 * Preserva precio/stock/categoría/gender/cost. Cambia nombre/model/slug/foto/medidas.
 * --dry imprime el estado actual y lo planeado, sin escribir.
 *   PROD: DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/swap_pegaso.js [--dry]
 */
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const IMG = '/private/tmp/claude-501/-Users-ishtarpissano-proyectos/84ad0938-e35f-4a4d-aaf3-b4065b675e6d/scratchpad/sol-fotos/fenix-bc3063-c2.png'; // BC3063 C2

const OLD_SLUG = 'pegaso-c1';
const NEW = { name: 'Pegaso C2', model: 'BC3063-C2', slug: 'pegaso-c2', med: { lw: 49, bw: 20, tl: 148 } };

async function main() {
  const host = (process.env.DATABASE_URL || '').replace(/.*@/, '').replace(/\/.*/, '');
  const isProd = !/localhost|127\.0\.0\.1/.test(host);
  console.log(`\n🎯 DB: ${host || '(sin URL)'} ${isProd ? '⚠️  PROD' : '· local'} ${DRY ? '· DRY' : ''}\n`);

  const wp = await prisma.webProduct.findUnique({ where: { slug: OLD_SLUG }, include: { product: true } });
  if (!wp) { console.log(`❌ No existe slug="${OLD_SLUG}".`); await prisma.$disconnect(); return; }
  const p = wp.product;
  console.log('── ESTADO ACTUAL ──');
  console.log(`name=${p.name} | model=${p.model} | cat(web)=${wp.category} | cat(prod)=${p.category}`);
  console.log(`price=${p.price} | stock=${p.stock} | cost=${p.cost} | gender=${p.gender} | med=${p.lensWidth}-${p.bridgeWidth}-${p.templeLength}`);
  console.log(`imgs=${(p.imagenesCatalogo||[]).length} | webImgs=${(wp.images||[]).length} | isActive=${wp.isActive}`);
  console.log(`desc: ${(wp.description||'').slice(0,160)}`);
  console.log('\n── PLANEADO ──');
  console.log(`name=${NEW.name} | model=${NEW.model} | slug=${NEW.slug} | med=${NEW.med.lw}-${NEW.med.bw}-${NEW.med.tl} | foto nueva=BC3063 C2 | (preserva precio/stock/cat/desc)`);

  if (DRY) { console.log('\nDRY: nada escrito.'); await prisma.$disconnect(); return; }

  const { lw, bw, tl } = NEW.med;
  const buf = await sharp(IMG).resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const uri = `data:image/webp;base64,${buf.toString('base64')}`;

  await prisma.product.update({
    where: { id: p.id },
    data: {
      name: NEW.name, model: NEW.model,
      imagenesCatalogo: [uri], lensWidth: lw, bridgeWidth: bw, templeLength: tl,
      seoTitle: (p.seoTitle || '').replace(/C1/g, 'C2') || null,
      seoDescription: (p.seoDescription || '').replace(/C1/g, 'C2') || null,
      seoTags: (p.seoTags || '').replace(/bc3063-c1|bc3063 c1|pegaso c1/gi, m => m.replace(/c1/i, 'C2')),
    },
  });
  await prisma.webProduct.update({
    where: { id: wp.id },
    data: {
      name: NEW.name, slug: NEW.slug, imageUrl: uri, images: [uri],
      description: (wp.description || '').replace(/C1/g, 'C2'),
    },
  });
  console.log(`\n✅ Pegaso ${OLD_SLUG} → ${NEW.slug} (BC3063-C2) en ${host}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
