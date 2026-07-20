/**
 * Activa/desactiva el aviso de PREVENTA en el banner de anuncio (web_announcement_text).
 * Guarda el texto original en web_announcement_text_backup para restaurar en 1 semana.
 *   node scripts/utils/set_preventa.js on   [--dry]   -> pone el aviso de preventa
 *   node scripts/utils/set_preventa.js off  [--dry]   -> restaura el texto original
 *   PROD: DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/set_preventa.js on
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const MODE = process.argv[2];              // 'on' | 'off'
const DRY = process.argv.includes('--dry');

const PREVENTA = 'PREVENTA · Entrega en ~1 semana (hasta que llegue el stock) • 6 Cuotas Sin Interés • 15% OFF Efectivo/Transferencia • Envío Gratis';

async function get(key) { const s = await prisma.systemSetting.findUnique({ where: { key } }); if (!s) return undefined; try { return JSON.parse(s.value); } catch { return s.value; } }
async function set(key, value) { await prisma.systemSetting.upsert({ where: { key }, update: { value: JSON.stringify(value) }, create: { key, value: JSON.stringify(value) } }); }

async function main() {
  const host = (process.env.DATABASE_URL || '').replace(/.*@/, '').replace(/\/.*/, '');
  const isProd = !/localhost|127\.0\.0\.1/.test(host);
  console.log(`\n🎯 DB: ${host || '(sin URL)'} ${isProd ? '⚠️  PROD' : '· local'} ${DRY ? '· DRY' : ''}  MODE=${MODE}\n`);
  if (MODE !== 'on' && MODE !== 'off') { console.log('Uso: node set_preventa.js on|off [--dry]'); await prisma.$disconnect(); return; }

  const current = await get('web_announcement_text');
  const backup = await get('web_announcement_text_backup');
  console.log(`actual : ${current}`);
  console.log(`backup : ${backup ?? '(no hay)'}`);

  if (MODE === 'on') {
    const original = backup ?? current;  // no pisar backup si ya existe
    console.log(`\n→ backup = "${original}"`);
    console.log(`→ banner = "${PREVENTA}"`);
    if (DRY) { console.log('\nDRY: nada escrito.'); await prisma.$disconnect(); return; }
    if (backup === undefined) await set('web_announcement_text_backup', original);
    await set('web_announcement_text', PREVENTA);
    await set('web_announcement_active', true);
    console.log('\n✅ Preventa ACTIVADA en el banner.');
  } else {
    if (backup === undefined) { console.log('\n⚠️ No hay backup guardado; no restauro para no romper. Revisá manualmente.'); await prisma.$disconnect(); return; }
    console.log(`\n→ restauro banner = "${backup}"`);
    if (DRY) { console.log('\nDRY: nada escrito.'); await prisma.$disconnect(); return; }
    await set('web_announcement_text', backup);
    console.log('\n✅ Banner restaurado al texto original.');
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
