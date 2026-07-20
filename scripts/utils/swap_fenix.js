/**
 * Swap del Fénix: J853T19 C1 (negro) -> J853T19 C2 (carey/havana). Mismo modelo, otro color.
 * Actualiza EN SU LUGAR el producto existente (no duplica). Idempotente. --dry para previsualizar.
 *   LOCAL: DATABASE_URL="postgresql://postgres:localpassword@localhost:5432/atelier" node scripts/utils/swap_fenix.js [--dry]
 *   PROD : DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/swap_fenix.js [--dry]
 */
const path = require('path');
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const IMG = '/private/tmp/claude-501/-Users-ishtarpissano-proyectos/84ad0938-e35f-4a4d-aaf3-b4065b675e6d/scratchpad/sol-fotos/j853t19-c2.png';

const OLD_SLUG = 'fenix-c1';           // registro existente a actualizar
const NEW = {
  name: 'Fénix C2', model: 'J853T19 C2', slug: 'fenix-c2',
  color: 'carey con varillas ámbar', shape: 'Cuadrado',
  med: { lw: 51, bw: 26, tl: 145 },     // J853T19 (igual en todos los colores)
};

async function main() {
  const host = (process.env.DATABASE_URL || '').replace(/.*@/, '').replace(/\/.*/, '');
  const isProd = !/localhost|127\.0\.0\.1/.test(host);
  console.log(`\n🎯 DB: ${host || '(sin URL)'} ${isProd ? '⚠️  PROD' : '· local'} ${DRY ? '· DRY' : ''}\n`);

  const wp = await prisma.webProduct.findUnique({ where: { slug: OLD_SLUG }, include: { product: true } });
  if (!wp) { console.log(`❌ No existe WebProduct slug="${OLD_SLUG}". Nada que cambiar.`); await prisma.$disconnect(); return; }
  console.log(`Encontrado: ${wp.product.name} (${wp.product.model}) slug=${wp.slug} id=${wp.product.id}`);

  const { lw, bw, tl } = NEW.med;
  const buf = await sharp(IMG).resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const uri = `data:image/webp;base64,${buf.toString('base64')}`;
  const med = `Medidas: calibre ${lw}mm, puente ${bw}mm, patillas ${tl}mm.`;
  const description = `Los ${NEW.name} son anteojos de sol confeccionados en acetato italiano Mazzucchelli, con una silueta ${NEW.shape.toLowerCase()} de diseño unisex en tono ${NEW.color}. Livianos, resistentes y con protección UV. Una pieza premium de Atelier. ${med}`;

  console.log(`→ ${NEW.name} (${NEW.model}) slug=${NEW.slug} color=${NEW.color} med=${lw}-${bw}-${tl} img=${Math.round(buf.length/1024)}KB`);
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
  await prisma.webProduct.update({
    where: { id: wp.id },
    data: { name: NEW.name, slug: NEW.slug, imageUrl: uri, images: [uri], description, category: 'Sol', isActive: true },
  });

  console.log(`\n✅ Swap hecho: ${OLD_SLUG} → ${NEW.slug} en ${host}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
