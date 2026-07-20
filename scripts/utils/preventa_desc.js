/**
 * Antepone (o quita) una línea de PREVENTA al inicio de la descripción de CADA WebProduct.
 * Idempotente. Reversible con `off`.
 *   node scripts/utils/preventa_desc.js on  [--dry]
 *   node scripts/utils/preventa_desc.js off [--dry]
 *   PROD: DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/preventa_desc.js on
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const MODE = process.argv[2];
const DRY = process.argv.includes('--dry');

const MARK = '⏳ PREVENTA · Entrega estimada en ~1 semana (hasta que llegue el stock).';
const SEP = '\n\n';

async function main() {
  const host = (process.env.DATABASE_URL || '').replace(/.*@/, '').replace(/\/.*/, '');
  const isProd = !/localhost|127\.0\.0\.1/.test(host);
  console.log(`\n🎯 DB: ${host || '(sin URL)'} ${isProd ? '⚠️  PROD' : '· local'} ${DRY ? '· DRY' : ''}  MODE=${MODE}\n`);
  if (MODE !== 'on' && MODE !== 'off') { console.log('Uso: node preventa_desc.js on|off [--dry]'); await prisma.$disconnect(); return; }

  const wps = await prisma.webProduct.findMany({ select: { id: true, slug: true, description: true } });
  let toChange = 0, already = 0;
  for (const wp of wps) {
    const d = wp.description || '';
    const has = d.startsWith(MARK);
    if (MODE === 'on') {
      if (has) { already++; continue; }
      toChange++;
      if (!DRY) await prisma.webProduct.update({ where: { id: wp.id }, data: { description: `${MARK}${SEP}${d}` } });
    } else { // off
      if (!has) continue;
      toChange++;
      const clean = d.slice(MARK.length).replace(/^\s+/, '');
      if (!DRY) await prisma.webProduct.update({ where: { id: wp.id }, data: { description: clean } });
    }
  }
  console.log(`Total WebProducts: ${wps.length}`);
  console.log(MODE === 'on'
    ? `Con preventa ya puesta: ${already} | A agregar: ${toChange}`
    : `A quitar preventa: ${toChange}`);
  console.log(DRY ? '\nDRY: nada escrito.' : `\n✅ ${MODE === 'on' ? 'Preventa agregada' : 'Preventa quitada'} en ${toChange} productos (${host}).`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
