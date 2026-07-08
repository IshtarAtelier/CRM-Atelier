/**
 * Completa SEO + descripción de los 11 estelares (y seoTitle de niobe/maia)
 * en el estilo de la casa. Idempotente. --dry para previsualizar.
 *   PROD: DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/nuevos_metal_seo.js [--dry]
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

// forma real por modelo (del catálogo de fotos) + color de lente (solo sol)
const CFG = {
  'sirio-c1':  { shape: 'Hexagonal',  lente: 'marrón' },
  'sirio-c2':  { shape: 'Hexagonal',  lente: 'verde' },
  'vega-c1':   { shape: 'Hexagonal',  lente: 'marrón claro' },
  'vega-c2':   { shape: 'Hexagonal',  lente: 'gris ahumada' },
  'altair-c2': { shape: 'Redondo',    lente: 'gris ahumada' },
  'antares-c1':{ shape: 'Cuadrado',   lente: 'marrón claro' },
  'rigel-c1':  { shape: 'Hexagonal' },
  'rigel-c3':  { shape: 'Hexagonal' },
  'lira-c1':   { shape: 'Hexagonal' },
  'orion-c1':  { shape: 'Redondo' },
  'halley-c1': { shape: 'Hexagonal' },
};
const SHAPE_ADJ = { Hexagonal: 'hexagonal', Redondo: 'redonda', Cuadrado: 'rectangular', 'Cat-Eye': 'cat-eye' };

function build(r) {
  const q = r.product, name = r.name, model = (q.model || '').toLowerCase();
  const c = CFG[r.slug] || { shape: 'Hexagonal' };
  const shapeAdj = SHAPE_ADJ[c.shape] || 'hexagonal';
  const med = `Medidas: calibre ${q.lensWidth}mm, puente ${q.bridgeWidth}mm, patillas ${q.templeLength}mm.`;
  if (r.category === 'Sol') {
    return {
      seoTitle: `Lentes de Sol ${name} | Atelier`,
      seoDescription: `Anteojos de sol ${name} de metal, diseño unisex con lente ${c.lente} y protección UV. Comprá online en Atelier Óptica con envío a todo el país.`,
      seoTags: `${model}, ${name.toLowerCase()}, lentes de sol, gafas de sol, anteojos de sol, optica cordoba, atelier optica, proteccion uv, unisex, premium, Metal, ${c.shape}`,
      description: `Los anteojos de sol ${name} combinan un armazón de metal ultraliviano y resistente con lentes de tinte ${c.lente} y protección UV. Su silueta ${shapeAdj} de diseño unisex aporta un aire contemporáneo y atemporal, con terminales de acetato para un calce cómodo y seguro. Una pieza premium de Atelier. ${med}`,
    };
  }
  return {
    seoTitle: `Lentes de Receta ${name} | Atelier`,
    seoDescription: `Armazón de receta ${name} de metal, diseño unisex de silueta ${shapeAdj}. Comprá online en Atelier Óptica Córdoba con envío a todo el país.`,
    seoTags: `${model}, ${name.toLowerCase()}, lentes de receta, armazones de receta, anteojos de receta, lentes graduados, optica cordoba, atelier optica, unisex, premium, Metal, ${c.shape}`,
    description: `El armazón de receta ${name} está construido en metal ultraliviano y de alta resistencia, con almohadillas nasales ajustables y terminales de acetato que garantizan un calce ergonómico y sin presiones. Su silueta ${shapeAdj} de diseño unisex combina elegancia atemporal y comodidad, listo para montar tus cristales graduados. Una pieza premium de Atelier. ${med}`,
  };
}

async function main() {
  const host = (process.env.DATABASE_URL || '').replace(/.*@/, '').replace(/\/.*/, '');
  console.log(`\n🎯 ${host} ${DRY ? '· DRY-RUN' : ''}\n`);
  const slugs = Object.keys(CFG);
  const rows = await prisma.webProduct.findMany({ where: { slug: { in: slugs } }, include: { product: true } });
  rows.sort((a, b) => a.slug.localeCompare(b.slug));

  for (const r of rows) {
    const g = build(r);
    console.log(`■ ${r.slug} (${r.category})`);
    console.log(`  seoTitle: ${g.seoTitle}`);
    console.log(`  seoDesc : ${g.seoDescription}  [${g.seoDescription.length}c]`);
    console.log(`  seoTags : ${g.seoTags}`);
    console.log(`  desc    : ${g.description}\n`);
    if (DRY) continue;
    await prisma.product.update({ where: { id: r.productId }, data: { seoTitle: g.seoTitle, seoDescription: g.seoDescription, seoTags: g.seoTags } });
    await prisma.webProduct.update({ where: { slug: r.slug }, data: { description: g.description } });
  }

  // niobe/maia: solo falta seoTitle (mantener su seoTags/desc)
  for (const slug of ['niobe-c4', 'maia-c4']) {
    const r = await prisma.webProduct.findUnique({ where: { slug }, include: { product: true } });
    if (!r) continue;
    const title = `Lentes de Receta ${r.name} | Atelier`;
    console.log(`■ ${slug}: seoTitle → ${title}`);
    if (!DRY) await prisma.product.update({ where: { id: r.productId }, data: { seoTitle: title } });
  }

  console.log(DRY ? '\nDRY-RUN: nada escrito.' : '\n✅ SEO + descripciones completas.');
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
