// Carga masiva de precios mayoristas por tier + publishToWholesale para todo
// el catálogo web (excepto cristales).
//
// Tiers (definidos con el usuario el 17/7/2026, "mejor precio que los mayoristas
// públicos" — referencia Loveli: acetato $37-45k, sol $30-40k, clip-on $50.8k):
//   Clip-on ......... $45.000   (categoría/nombre contiene "clip")
//   Estelares ....... $45.000   (modelo empieza con G7/GS7)
//   Sol ............. $32.000   (subido de 29k a pedido del usuario, 17/7)
//   Receta (resto) .. $32.000   (bajado de 35k a pedido del usuario, 17/7)
//
// Uso:
//   node scripts/set_wholesale_prices.js            → corre contra DATABASE_URL (local)
//   node scripts/set_wholesale_prices.js --prod --yes → corre contra PROD_DATABASE_URL
// Contra prod exige AMBOS flags; sin --yes solo muestra qué haría (dry run).

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const TIERS = { CLIP_ON: 45000, ESTELARES: 45000, SOL: 32000, RECETA: 32000 };

const isProd = process.argv.includes('--prod');
const confirmed = process.argv.includes('--yes');
const dbUrl = isProd ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;

if (!dbUrl) {
  console.error(isProd ? 'Falta PROD_DATABASE_URL en .env' : 'Falta DATABASE_URL en .env');
  process.exit(1);
}
if (!isProd && !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
  console.error('DATABASE_URL no apunta a localhost. Si querés correr contra prod usá --prod --yes.');
  process.exit(1);
}

const dryRun = isProd && !confirmed;
console.log(`Base: ${isProd ? 'PRODUCCIÓN' : 'local'}${dryRun ? ' (DRY RUN — agregá --yes para escribir)' : ''}`);

function tierFor(product, webProduct) {
  const model = (product.model || '').toUpperCase();
  const name = (webProduct.name || '').toLowerCase();
  const cat = (webProduct.category || product.category || '').toLowerCase();
  if (cat.includes('clip') || name.includes('clip')) return ['Clip-on', TIERS.CLIP_ON];
  if (model.startsWith('G7') || model.startsWith('GS7')) return ['Estelares', TIERS.ESTELARES];
  if (cat.includes('sol')) return ['Sol', TIERS.SOL];
  return ['Receta', TIERS.RECETA];
}

(async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  // select mínimo: sin imágenes base64 (pesan MB y acá no sirven)
  const wps = await prisma.webProduct.findMany({
    where: { isActive: true, product: { category: { not: 'Cristal' } } },
    select: {
      name: true, category: true,
      product: { select: { id: true, brand: true, model: true, category: true, price: true } },
    },
  });
  const counts = {};
  const idsByTier = {}; // tier -> { ws, ids: [] }
  for (const wp of wps) {
    const p = wp.product;
    if (!(p.price > 0)) continue;
    const [tier, ws] = tierFor(p, wp);
    counts[tier] = (counts[tier] || 0) + 1;
    (idsByTier[tier] = idsByTier[tier] || { ws, ids: [] }).ids.push(p.id);
    if (dryRun && counts[tier] <= 3) {
      console.log(`  [dry] ${p.brand} ${wp.name || p.model} → ${tier} $${ws.toLocaleString('es-AR')}`);
    }
  }
  if (!dryRun) {
    // Un updateMany por tier dentro de una transacción: atómico y rápido
    // (4 queries en vez de una por producto — clave contra prod en Singapur).
    await prisma.$transaction(
      Object.values(idsByTier).map(({ ws, ids }) =>
        prisma.product.updateMany({
          where: { id: { in: ids } },
          data: { publishToWholesale: true, wholesalePrice: ws },
        })
      )
    );
  }
  console.log(dryRun ? 'Se cargarían:' : 'Cargados:');
  for (const [t, n] of Object.entries(counts)) console.log(`- ${t}: ${n} productos`);
  await prisma.$disconnect();
})();
