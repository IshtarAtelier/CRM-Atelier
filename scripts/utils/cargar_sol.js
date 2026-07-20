/**
 * Carga 5 anteojos de SOL (acetato italiano Mazzucchelli, Kazwini) al catálogo.
 * Modelado sobre deneb_db.js. Idempotente (upsert por slug/name). --dry para previsualizar.
 * Imágenes: webp ~1000px embebidas como data URI (no requiere deploy de assets).
 *
 *   LOCAL: node scripts/utils/cargar_sol.js --dry
 *   LOCAL: node scripts/utils/cargar_sol.js
 *   PROD : DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/cargar_sol.js --dry
 *   PROD : DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/cargar_sol.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const RATE = 1515;          // USD -> ARS (misma que deneb_db.js)
const COST_USD = 15;        // "15 USD promedio" (usuario)
const PRICE = 200000;       // precio de lista confirmado por el usuario
const IMG_DIR = '/private/tmp/claude-501/-Users-ishtarpissano-proyectos/84ad0938-e35f-4a4d-aaf3-b4065b675e6d/scratchpad/sol-fotos';

// slug, nombre estelar unisex, model = código+color (Kazwini), color de armazón, forma, medidas, stock, archivo
const ITEMS = [
  { slug: 'fenix-c1',   name: 'Fénix C1',   model: 'J853T19 C1', color: 'negro',       shape: 'Cuadrado', med: { lw: 51, bw: 26, tl: 145 }, stock: 3, img: 'fenix-c1.png' },
  { slug: 'mizar-c2',   name: 'Mizar C2',   model: 'YD1335 C2',  color: 'carey',       shape: 'Redondo',  med: { lw: 53, bw: 17, tl: 145 }, stock: 3, img: 'mizar-c2.png' },
  { slug: 'adhara-c4',  name: 'Adhara C4',  model: 'YD1330 C4',  color: 'azul marino', shape: 'Cuadrado', med: { lw: 50, bw: 21, tl: 145 }, stock: 3, img: 'adhara-c4.png' },
  { slug: 'canopo-c4',  name: 'Cánopo C4',  model: 'YD1331 C4',  color: 'gris',        shape: 'Redondo',  med: { lw: 51, bw: 23, tl: 145 }, stock: 3, img: 'canopo-c4.png' },
  { slug: 'nashira-c3', name: 'Nashira C3', model: 'FG1596 C3',  color: 'bordó',       shape: 'Cat-Eye',  med: { lw: 54, bw: 17, tl: 145 }, stock: 2, img: 'nashira-c3.png' },
];

async function toDataUri(file) {
  const buf = await sharp(path.join(IMG_DIR, file))
    .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  return { uri: `data:image/webp;base64,${buf.toString('base64')}`, kb: Math.round(buf.length / 1024) };
}

async function main() {
  const host = (process.env.DATABASE_URL || '').replace(/.*@/, '').replace(/\/.*/, '');
  const isProd = !/localhost|127\.0\.0\.1/.test(host);
  console.log(`\n🎯 DB: ${host || '(sin DATABASE_URL)'} ${isProd ? '⚠️  PROD' : '· local'} ${DRY ? '· DRY' : ''}\n`);

  const cost = Math.round(COST_USD * RATE);

  for (const e of ITEMS) {
    const { lw, bw, tl } = e.med;
    const { uri, kb } = await toDataUri(e.img);
    const med = `Medidas: calibre ${lw}mm, puente ${bw}mm, patillas ${tl}mm.`;
    const description = `Los ${e.name} son anteojos de sol confeccionados en acetato italiano Mazzucchelli, con una silueta ${e.shape.toLowerCase()} de diseño unisex en tono ${e.color}. Livianos, resistentes y con protección UV. Una pieza premium de Atelier. ${med}`;

    const productData = {
      name: e.name, model: e.model, brand: 'Atelier', category: 'Lentes de Sol', type: 'Armazón',
      gender: 'Unisex', stock: e.stock, price: PRICE, cost, wholesalePrice: 0, publishToWeb: true, origin: 'STOCK',
      imagenesCatalogo: [uri], rawImageUrls: [], lensWidth: lw, bridgeWidth: bw, templeLength: tl,
      seoTitle: `Lentes de Sol ${e.name} | Atelier`,
      seoDescription: `Anteojos de sol ${e.name} en acetato italiano Mazzucchelli, diseño unisex de silueta ${e.shape.toLowerCase()} en ${e.color}, con protección UV. Comprá online en Atelier Óptica con envío a todo el país.`,
      seoTags: `${e.model.toLowerCase()}, ${e.name.toLowerCase()}, lentes de sol, gafas de sol, anteojos de sol, optica cordoba, atelier optica, proteccion uv, unisex, premium, acetato, acetato italiano, mazzucchelli, ${e.shape}`,
    };
    const webData = { name: e.name, slug: e.slug, category: 'Sol', isActive: true, imageUrl: uri, images: [uri], description };

    console.log(`• ${e.slug.padEnd(11)} ${e.name.padEnd(11)} ${e.model.padEnd(12)} stock=${e.stock} med=${lw}-${bw}-${tl} img=${kb}KB`);
    if (DRY) continue;

    let product = await prisma.product.findFirst({ where: { name: e.name } });
    product = product
      ? await prisma.product.update({ where: { id: product.id }, data: productData })
      : await prisma.product.create({ data: productData });
    const ex = await prisma.webProduct.findUnique({ where: { slug: e.slug } });
    if (ex) await prisma.webProduct.update({ where: { slug: e.slug }, data: { productId: product.id, ...webData } });
    else await prisma.webProduct.create({ data: { productId: product.id, ...webData } });
  }

  console.log(DRY ? '\nDRY: nada escrito.' : `\n✅ ${ITEMS.length} armazones de sol en ${host}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
