/**
 * GS7016S → Deneb C1/C2 (sol). Inserta con TODOS los campos (incl. SEO + descripción).
 * Idempotente. --dry para previsualizar.
 *   PROD: DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/deneb_db.js [--dry]
 */
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const RATE = 1515;

const LENTE = { 'deneb-c1': 'verde', 'deneb-c2': 'marrón' };
const SHAPE = 'Redondo';

async function main() {
  const host = (process.env.DATABASE_URL || '').replace(/.*@/, '').replace(/\/.*/, '');
  console.log(`\n🎯 ${host} ${!/localhost/.test(host) ? '⚠️ PROD' : ''} ${DRY ? '· DRY' : ''}\n`);
  const manifest = JSON.parse(fs.readFileSync('scratch/deneb_manifest.json', 'utf8'));

  for (const e of manifest) {
    const { lw, bw, tl } = e.med;
    const cost = Math.round(10.78 * RATE);
    const lente = LENTE[e.slug];
    const med = `Medidas: calibre ${lw}mm, puente ${bw}mm, patillas ${tl}mm.`;
    const productData = {
      name: e.name, model: e.productModel, brand: 'Atelier', category: 'Lentes de Sol', type: 'Armazón',
      gender: 'Unisex', stock: 5, price: 200000, cost, wholesalePrice: 0, publishToWeb: true, origin: 'STOCK',
      imagenesCatalogo: e.images, rawImageUrls: e.images, lensWidth: lw, bridgeWidth: bw, templeLength: tl,
      seoTitle: `Lentes de Sol ${e.name} | Atelier`,
      seoDescription: `Anteojos de sol ${e.name} de metal, diseño unisex con lente ${lente} y protección UV. Comprá online en Atelier Óptica con envío a todo el país.`,
      seoTags: `${e.productModel.toLowerCase()}, ${e.name.toLowerCase()}, lentes de sol, gafas de sol, anteojos de sol, optica cordoba, atelier optica, proteccion uv, unisex, premium, Metal, ${SHAPE}`,
    };
    const description = `Los anteojos de sol ${e.name} combinan un armazón de metal ultraliviano y resistente con lentes de tinte ${lente} y protección UV. Su silueta redonda de diseño unisex aporta un aire contemporáneo y atemporal, con terminales de acetato para un calce cómodo y seguro. Una pieza premium de Atelier. ${med}`;
    const webData = { name: e.name, slug: e.slug, category: 'Sol', isActive: true, imageUrl: e.images[0], images: e.images, description };

    console.log(`• ${e.slug} → ${e.name} | cost=$${cost} med=${lw}-${bw}-${tl} lente=${lente} imgs=${e.images.length}`);
    console.log(`   seoTitle: ${productData.seoTitle}`);
    console.log(`   desc: ${description.slice(0, 90)}…`);
    if (DRY) continue;

    let product = await prisma.product.findFirst({ where: { name: e.name } });
    product = product
      ? await prisma.product.update({ where: { id: product.id }, data: productData })
      : await prisma.product.create({ data: productData });
    const ex = await prisma.webProduct.findUnique({ where: { slug: e.slug } });
    if (ex) await prisma.webProduct.update({ where: { slug: e.slug }, data: { productId: product.id, ...webData } });
    else await prisma.webProduct.create({ data: { productId: product.id, ...webData } });
  }
  console.log(DRY ? '\nDRY: nada escrito.' : '\n✅ Deneb C1/C2 en ' + host);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
