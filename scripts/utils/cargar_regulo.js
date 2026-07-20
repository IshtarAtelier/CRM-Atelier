/**
 * Carga el 6º sol: Régulo C2 = BC3063 C2 (acetato FANGSHI, NO italiano). Idempotente.
 * Medidas por parámetro (las de Kazwini): <calibre> <puente> <varilla>.
 *   LOCAL: node scripts/utils/cargar_regulo.js 50 22 145 --dry
 *   PROD : DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/cargar_regulo.js 50 22 145
 */
const path = require('path');
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const nums = process.argv.slice(2).filter(a => !a.startsWith('--')).map(Number);
const [LW, BW, TL] = nums;

const RATE = 1515, COST_USD = 15, PRICE = 200000;
const IMG_DIR = '/private/tmp/claude-501/-Users-ishtarpissano-proyectos/84ad0938-e35f-4a4d-aaf3-b4065b675e6d/scratchpad/sol-fotos';
// BC3063 C2: negro, redondo, lente transparente, acetato FANGSHI. Ajustar si Kazwini dice otra cosa.
const E = { slug: 'regulo-c2', name: 'Régulo C2', model: 'BC3063 C2', color: 'negro', shape: 'Redondo', stock: 3, img: 'fenix-bc3063-c2.png' };

async function toDataUri(file) {
  const buf = await sharp(path.join(IMG_DIR, file)).resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  return { uri: `data:image/webp;base64,${buf.toString('base64')}`, kb: Math.round(buf.length / 1024) };
}

async function main() {
  const host = (process.env.DATABASE_URL || '').replace(/.*@/, '').replace(/\/.*/, '');
  const isProd = !/localhost|127\.0\.0\.1/.test(host);
  console.log(`\n🎯 DB: ${host || '(sin DATABASE_URL)'} ${isProd ? '⚠️  PROD' : '· local'} ${DRY ? '· DRY' : ''}\n`);
  if (!LW || !BW || !TL) { console.log('Faltan medidas: node cargar_regulo.js <calibre> <puente> <varilla> [--dry]'); await prisma.$disconnect(); return; }

  const cost = Math.round(COST_USD * RATE);
  const { uri, kb } = await toDataUri(E.img);
  const med = `Medidas: calibre ${LW}mm, puente ${BW}mm, patillas ${TL}mm.`;
  // OJO: acetato FANGSHI -> sin claim "italiano" (a diferencia de los otros 5, que son Mazzucchelli)
  const description = `Los ${E.name} son anteojos de sol confeccionados en acetato premium, con una silueta ${E.shape.toLowerCase()} de diseño unisex en tono ${E.color}. Livianos, resistentes y con protección UV. Una pieza premium de Atelier. ${med}`;

  const productData = {
    name: E.name, model: E.model, brand: 'Atelier', category: 'Lentes de Sol', type: 'Armazón',
    gender: 'Unisex', stock: E.stock, price: PRICE, cost, wholesalePrice: 0, publishToWeb: true, origin: 'STOCK',
    imagenesCatalogo: [uri], rawImageUrls: [], lensWidth: LW, bridgeWidth: BW, templeLength: TL,
    seoTitle: `Lentes de Sol ${E.name} | Atelier`,
    seoDescription: `Anteojos de sol ${E.name} en acetato premium, diseño unisex de silueta ${E.shape.toLowerCase()} en ${E.color}, con protección UV. Comprá online en Atelier Óptica con envío a todo el país.`,
    seoTags: `${E.model.toLowerCase()}, ${E.name.toLowerCase()}, lentes de sol, gafas de sol, anteojos de sol, optica cordoba, atelier optica, proteccion uv, unisex, premium, acetato, ${E.shape}`,
  };
  const webData = { name: E.name, slug: E.slug, category: 'Sol', isActive: true, imageUrl: uri, images: [uri], description };

  console.log(`• ${E.slug.padEnd(11)} ${E.name.padEnd(11)} ${E.model.padEnd(12)} stock=${E.stock} med=${LW}-${BW}-${TL} img=${kb}KB (acetato FANGSHI, sin claim italiano)`);
  if (DRY) { console.log('\nDRY: nada escrito.'); await prisma.$disconnect(); return; }

  let product = await prisma.product.findFirst({ where: { name: E.name } });
  product = product
    ? await prisma.product.update({ where: { id: product.id }, data: productData })
    : await prisma.product.create({ data: productData });
  const ex = await prisma.webProduct.findUnique({ where: { slug: E.slug } });
  if (ex) await prisma.webProduct.update({ where: { slug: E.slug }, data: { productId: product.id, ...webData } });
  else await prisma.webProduct.create({ data: { productId: product.id, ...webData } });

  console.log(`\n✅ Régulo C2 cargado en ${host}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
