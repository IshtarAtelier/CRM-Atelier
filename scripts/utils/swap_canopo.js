/**
 * Cánopo: cambia el color mostrado de C4 (gris, lente clara) -> C2 (carey, lente de sol),
 * mismo modelo YD1331. Foto REAL del YD1331 C2 sacada de Kazwini (9iZzV1de...avif).
 * Actualiza EN SU LUGAR (no duplica). Mantiene el slug canopo-c4 para no romper la URL.
 *   LOCAL: node scripts/utils/swap_canopo.js [--dry]
 *   PROD : DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/swap_canopo.js [--dry]
 */
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const IMG = '/private/tmp/claude-501/-Users-ishtarpissano-proyectos/84ad0938-e35f-4a4d-aaf3-b4065b675e6d/scratchpad/sol-fotos/canopo-c2-real.png';

const SLUG = 'canopo-c4';   // registro existente (mantengo el slug para no romper la URL viva)
const NEW = { name: 'Cánopo C2', model: 'YD1331 C2', color: 'carey', shape: 'Redondo', med: { lw: 51, bw: 23, tl: 145 } };

async function main() {
  const host = (process.env.DATABASE_URL || '').replace(/.*@/, '').replace(/\/.*/, '');
  const isProd = !/localhost|127\.0\.0\.1/.test(host);
  console.log(`\n🎯 DB: ${host || '(sin URL)'} ${isProd ? '⚠️  PROD' : '· local'} ${DRY ? '· DRY' : ''}\n`);

  const wp = await prisma.webProduct.findUnique({ where: { slug: SLUG }, include: { product: true } });
  if (!wp) { console.log(`❌ No existe WebProduct slug="${SLUG}".`); await prisma.$disconnect(); return; }
  console.log(`Encontrado: ${wp.product.name} (${wp.product.model}) slug=${wp.slug} id=${wp.product.id}`);

  const { lw, bw, tl } = NEW.med;
  const buf = await sharp(IMG).resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const uri = `data:image/webp;base64,${buf.toString('base64')}`;
  const med = `Medidas: calibre ${lw}mm, puente ${bw}mm, patillas ${tl}mm.`;
  // YD1331 = ACETATO SOLAR MAZZUCCHELLI -> sí es italiano
  const description = `Los ${NEW.name} son anteojos de sol confeccionados en acetato italiano Mazzucchelli, con una silueta ${NEW.shape.toLowerCase()} de diseño unisex en tono ${NEW.color}. Livianos, resistentes y con protección UV. Una pieza premium de Atelier. ${med}`;

  console.log(`→ ${NEW.name} (${NEW.model}) color=${NEW.color} med=${lw}-${bw}-${tl} img=${Math.round(buf.length/1024)}KB`);
  if (DRY) { console.log('\nDRY: nada escrito.'); await prisma.$disconnect(); return; }

  await prisma.product.update({
    where: { id: wp.product.id },
    data: {
      name: NEW.name, model: NEW.model, imagenesCatalogo: [uri], rawImageUrls: [],
      lensWidth: lw, bridgeWidth: bw, templeLength: tl,
      seoTitle: `Lentes de Sol ${NEW.name} | Atelier`,
      seoDescription: `Anteojos de sol ${NEW.name} en acetato italiano Mazzucchelli, diseño unisex de silueta ${NEW.shape.toLowerCase()} en ${NEW.color}, con protección UV. Comprá online en Atelier Óptica con envío a todo el país.`,
      seoTags: `${NEW.model.toLowerCase()}, ${NEW.name.toLowerCase()}, lentes de sol, gafas de sol, anteojos de sol, optica cordoba, atelier optica, proteccion uv, unisex, premium, acetato, acetato italiano, mazzucchelli, ${NEW.shape}`,
    },
  });
  await prisma.webProduct.update({ where: { id: wp.id }, data: { name: NEW.name, imageUrl: uri, images: [uri], description, category: 'Sol', isActive: true } });

  console.log(`\n✅ Cánopo actualizado a ${NEW.name} (${NEW.model}) en ${host}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
