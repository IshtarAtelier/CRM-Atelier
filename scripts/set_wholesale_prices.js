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

// Tiers revisados 22/7/2026 contra la referencia de mercado que pasó un
// proveedor (Hanover: receta $33.000 / clip-on $36.000) y contra el margen
// real sobre costo: receta y clip-on bajan para entrar en precio, sol sube
// (a $32.000 el margen era 1,41x) y estelares quedan en $45.000 — el escalón
// alto de la colección frente a la receta común de $29.000.
const TIERS = { CLIP_ON: 34000, ESTELARES: 45000, SOL: 36000, RECETA: 29000 };

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
      product: { select: { id: true, brand: true, model: true, category: true, price: true, cost: true } },
    },
  });
  const counts = {};
  const idsByTier = {}; // tier -> { ws, ids: [] }
  // Productos cuyo costo NO deja margen al precio del tier. El tier se asigna
  // por categoría/modelo, así que una pieza cara (ej. Wicue electrocrómico,
  // costo $100.000) caía en "Sol" a $32.000 y se vendía a pérdida. Se excluyen
  // del canal y se listan para decidirlos a mano.
  const sinMargen = [];
  const MARGEN_MINIMO = 1.2; // el precio debe ser al menos 1,2x el costo
  for (const wp of wps) {
    const p = wp.product;
    if (!(p.price > 0)) continue;
    const [tier, ws] = tierFor(p, wp);
    if (p.cost > 0 && ws < p.cost * MARGEN_MINIMO) {
      sinMargen.push({ nombre: wp.name || p.model, marca: p.brand, costo: p.cost, tier, precioTier: ws });
      continue;
    }
    counts[tier] = (counts[tier] || 0) + 1;
    (idsByTier[tier] = idsByTier[tier] || { ws, ids: [] }).ids.push(p.id);
    if (dryRun && counts[tier] <= 3) {
      console.log(`  [dry] ${p.brand} ${wp.name || p.model} → ${tier} $${ws.toLocaleString('es-AR')}`);
    }
  }
  if (sinMargen.length) {
    console.log(`\n⚠️  EXCLUIDOS por no cubrir el costo (margen mínimo ${MARGEN_MINIMO}x):`);
    for (const s of sinMargen) {
      console.log(`   - ${s.marca} ${s.nombre}: costo $${s.costo.toLocaleString('es-AR')} vs ${s.tier} $${s.precioTier.toLocaleString('es-AR')}`);
    }
    console.log('   → quedan FUERA del canal mayorista (publishToWholesale=false).\n');
  }
  if (!dryRun) {
    // Un updateMany por tier dentro de una transacción: atómico y rápido
    // (4 queries en vez de una por producto — clave contra prod en Singapur).
    // Los sinMargen se despublican en la MISMA transacción: si ya estaban en
    // el canal (como pasó con el Wicue), esto los saca.
    const idsSinMargen = wps
      .filter((wp) => sinMargen.some((s) => (s.nombre === (wp.name || wp.product.model)) && s.marca === wp.product.brand))
      .map((wp) => wp.product.id);
    await prisma.$transaction([
      ...Object.values(idsByTier).map(({ ws, ids }) =>
        prisma.product.updateMany({
          where: { id: { in: ids } },
          data: { publishToWholesale: true, wholesalePrice: ws },
        })
      ),
      ...(idsSinMargen.length
        ? [prisma.product.updateMany({ where: { id: { in: idsSinMargen } }, data: { publishToWholesale: false } })]
        : []),
    ]);
  }
  console.log(dryRun ? 'Se cargarían:' : 'Cargados:');
  for (const [t, n] of Object.entries(counts)) console.log(`- ${t}: ${n} productos`);
  await prisma.$disconnect();
})();
