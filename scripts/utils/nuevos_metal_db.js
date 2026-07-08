/**
 * Fase B — escribe los 12 productos (8 modelos × colores) en la base.
 * Lee scratch/nuevos_metal_manifest.json. Idempotente (upsert por slug/nombre).
 *
 * Apunta a la base que indique DATABASE_URL. Imprime el host antes de escribir.
 *   LOCAL:  node scripts/utils/nuevos_metal_db.js --dry     (o sin --dry para escribir)
 *   PROD :  DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/nuevos_metal_db.js
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const MANIFEST = path.join(__dirname, '../../scratch/nuevos_metal_manifest.json');
const RATE = 1515; // USD→ARS (venta oficial/blue) 2026-07-07 · dolarapi.com
const DRY = process.argv.includes('--dry');

const prisma = new PrismaClient();

function hostOf(url) {
  try { return new URL(url).host; } catch { return '??'; }
}

async function main() {
  const url = process.env.DATABASE_URL || '';
  const host = hostOf(url);
  const isProd = !/localhost|127\.0\.0\.1/.test(host);
  console.log(`\n🎯 Base destino: ${host}  ${isProd ? '⚠️  (PRODUCCIÓN)' : '(local)'}   ${DRY ? '· DRY-RUN' : ''}\n`);

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  for (const e of manifest) {
    const cost = Math.round(e.costUSD * RATE);
    const productData = {
      name: e.name,
      model: e.productModel,
      brand: 'Atelier',
      category: e.prodCat,
      type: e.type,
      gender: 'Unisex',
      seoTags: 'Metal',
      stock: 5,
      price: 200000,
      cost,
      wholesalePrice: 0,
      publishToWeb: true,
      origin: 'STOCK',
      imagenesCatalogo: e.images,
      rawImageUrls: e.images,
      lensWidth: e.measurements.lensWidth,
      bridgeWidth: e.measurements.bridgeWidth,
      templeLength: e.measurements.templeLength,
    };
    const webData = {
      name: e.name,
      slug: e.slug,
      category: e.webCat,
      isActive: true,
      imageUrl: e.images[0],
      images: e.images,
    };

    console.log(`• ${e.slug.padEnd(12)} ${e.name.padEnd(10)} ${e.webCat.padEnd(7)} cost=$${cost} med=${e.measurements.lensWidth || '?'}-${e.measurements.bridgeWidth || '?'}-${e.measurements.templeLength || '?'} imgs=${e.images.length}`);
    if (DRY) continue;

    // Product: buscar por nombre (único a nivel catálogo)
    let product = await prisma.product.findFirst({ where: { name: e.name } });
    if (product) {
      product = await prisma.product.update({ where: { id: product.id }, data: productData });
    } else {
      product = await prisma.product.create({ data: productData });
    }

    // WebProduct: upsert por slug
    const existing = await prisma.webProduct.findUnique({ where: { slug: e.slug } });
    if (existing) {
      await prisma.webProduct.update({ where: { slug: e.slug }, data: { productId: product.id, ...webData } });
    } else {
      await prisma.webProduct.create({ data: { productId: product.id, ...webData } });
    }
  }

  console.log(`\n${DRY ? 'DRY-RUN: no se escribió nada.' : '✅ Listo: ' + manifest.length + ' variantes escritas en ' + host}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
