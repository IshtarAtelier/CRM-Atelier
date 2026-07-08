/**
 * Fase B v2 — renombre estelar + corrección de fotos.
 * - Upsert de las 11 variantes nuevas (nombres estelares) desde el manifest.
 * - Borra los 11 registros viejos (Eros/Apolo/Ares/Febo/Atlas/Jano/Néstor). Orión queda.
 * Idempotente. Imprime host antes de escribir.
 *   PROD: DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/nuevos_metal_v2_db.js [--dry]
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const MANIFEST = path.join(__dirname, '../../scratch/nuevos_metal_manifest.json');
const RATE = 1515; // USD→ARS (venta oficial/blue) 2026-07-07 · dolarapi.com
const DRY = process.argv.includes('--dry');

// Registros con nombres VIEJOS a eliminar (Orión NO está: se mantiene)
const OLD = [
  { slug: 'eros-c1', name: 'Eros C1' }, { slug: 'eros-c2', name: 'Eros C2' },
  { slug: 'apolo-c1', name: 'Apolo C1' }, { slug: 'apolo-c2', name: 'Apolo C2' },
  { slug: 'ares-c2', name: 'Ares C2' },
  { slug: 'febo-c1', name: 'Febo C1' },
  { slug: 'atlas-c1', name: 'Atlas C1' }, { slug: 'atlas-c2', name: 'Atlas C2' }, { slug: 'atlas-c3', name: 'Atlas C3' },
  { slug: 'jano-c1', name: 'Jano C1' },
  { slug: 'nestor-c1', name: 'Néstor C1' },
];

const prisma = new PrismaClient();
const hostOf = (u) => { try { return new URL(u).host; } catch { return '??'; } };

async function main() {
  const host = hostOf(process.env.DATABASE_URL || '');
  const isProd = !/localhost|127\.0\.0\.1/.test(host);
  console.log(`\n🎯 Base destino: ${host}  ${isProd ? '⚠️  (PRODUCCIÓN)' : '(local)'}   ${DRY ? '· DRY-RUN' : ''}\n`);

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  console.log(`— UPSERT ${manifest.length} variantes nuevas —`);
  for (const e of manifest) {
    const cost = Math.round(e.costUSD * RATE);
    console.log(`• ${e.slug.padEnd(11)} ${e.name.padEnd(11)} ${e.webCat.padEnd(7)} cost=$${cost} med=${e.measurements.lensWidth}-${e.measurements.bridgeWidth}-${e.measurements.templeLength} imgs=${e.images.length}`);
    if (DRY) continue;
    const productData = {
      name: e.name, model: e.productModel, brand: 'Atelier', category: e.prodCat, type: e.type,
      gender: 'Unisex', seoTags: 'Metal', stock: 5, price: 200000, cost, wholesalePrice: 0,
      publishToWeb: true, origin: 'STOCK', imagenesCatalogo: e.images, rawImageUrls: e.images,
      lensWidth: e.measurements.lensWidth, bridgeWidth: e.measurements.bridgeWidth, templeLength: e.measurements.templeLength,
    };
    const webData = { name: e.name, slug: e.slug, category: e.webCat, isActive: true, imageUrl: e.images[0], images: e.images };

    let product = await prisma.product.findFirst({ where: { name: e.name } });
    product = product
      ? await prisma.product.update({ where: { id: product.id }, data: productData })
      : await prisma.product.create({ data: productData });

    const existing = await prisma.webProduct.findUnique({ where: { slug: e.slug } });
    if (existing) await prisma.webProduct.update({ where: { slug: e.slug }, data: { productId: product.id, ...webData } });
    else await prisma.webProduct.create({ data: { productId: product.id, ...webData } });
  }

  console.log(`\n— BORRAR ${OLD.length} registros viejos —`);
  for (const o of OLD) {
    const wp = await prisma.webProduct.findUnique({ where: { slug: o.slug } });
    const pr = await prisma.product.findFirst({ where: { name: o.name } });
    console.log(`• ${o.slug.padEnd(11)} ${o.name.padEnd(11)} web=${wp ? 'sí' : 'no'} prod=${pr ? 'sí' : 'no'}`);
    if (DRY) continue;
    if (wp) await prisma.webProduct.delete({ where: { slug: o.slug } });
    if (pr) await prisma.product.delete({ where: { id: pr.id } }); // cascada borra webProduct restante
  }

  console.log(`\n${DRY ? 'DRY-RUN: no se escribió nada.' : '✅ Renombre + limpieza completos en ' + host}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
