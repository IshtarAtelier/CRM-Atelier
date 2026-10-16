/**
 * Corrige en la tabla BlogPost los datos del local que no coinciden con
 * src/lib/business-info.ts (auditoría de consistencia NAP del 16/10/2026).
 * Google penaliza que el teléfono / dirección / reseñas digan cosas distintas
 * según la página.
 *
 * Hallazgos en producción (solo lectura, 16/10/2026):
 *   - lentes-eyezen-fatiga-visual-pantallas-essilor-cordoba: WhatsApp
 *     "+54 9 3513 44-7219" — no es el del local (+54 9 351 868-5644).
 *   - lentes-multifocales-cordoba-69ccf4016c8d: "más de 400 reseñas con 5
 *     estrellas" — número tipeado a mano y viejo (Google hoy dice 739). Las
 *     cantidades salen de getGoogleReviews(); en texto fijo, sin número.
 *
 *   node scripts/maintenance/blog-consistencia-datos-del-local.mjs                  → LOCAL, sin escribir
 *   node scripts/maintenance/blog-consistencia-datos-del-local.mjs --apply          → LOCAL, escribe
 *   node scripts/maintenance/blog-consistencia-datos-del-local.mjs --prod           → PRODUCCIÓN, sin escribir
 *   node scripts/maintenance/blog-consistencia-datos-del-local.mjs --prod --apply   → PRODUCCIÓN, escribe (pedir OK)
 *
 * Reemplazo de string exacto; si no matchea, no toca nada y lo dice.
 * Contra prod: select explícito (el schema local está adelantado).
 * Las páginas del blog son ISR: el cambio se ve tras la próxima regeneración.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const PROD = process.argv.includes('--prod');
const APPLY = process.argv.includes('--apply');
const url = PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) throw new Error(PROD ? 'Falta PROD_DATABASE_URL' : 'Falta DATABASE_URL');
const prisma = new PrismaClient({ datasources: { db: { url } } });

// [slug, buscar, reemplazar] — buscar tiene que estar EXACTO en content.
const FIXES = [
  ['lentes-eyezen-fatiga-visual-pantallas-essilor-cordoba',
    'Escribinos directamente a nuestro WhatsApp (+54 9 3513 44-7219)',
    'Escribinos directamente a nuestro WhatsApp (+54 9 351 868-5644)'],
  ['lentes-multifocales-cordoba-69ccf4016c8d',
    '💬 Tenemos más de 400 reseñas con 5 estrellas en Google.',
    '💬 Cientos de reseñas de 5 estrellas en Google.'],
];

console.log(`\n═══ ${PROD ? 'PRODUCCIÓN' : 'LOCAL'} — ${APPLY ? 'ESCRIBIENDO' : 'PRUEBA (no escribe)'} ═══\n`);
let aplicadas = 0, sinMatch = 0;
for (const [slug, from, to] of FIXES) {
  const post = await prisma.blogPost.findUnique({ where: { slug }, select: { content: true } });
  if (!post) { console.log(`— ${slug}: no está en esta base`); continue; }
  if (!post.content.includes(from)) {
    const yaEsta = post.content.includes(to);
    console.log(`${yaEsta ? '✓' : '✗'} ${slug}: ${yaEsta ? 'ya corregido' : 'SIN MATCH'}`);
    if (!yaEsta) sinMatch++;
    continue;
  }
  const content = post.content.split(from).join(to);
  if (APPLY) await prisma.blogPost.update({ where: { slug }, data: { content }, select: { slug: true } });
  aplicadas++;
  console.log(`✅ ${slug}\n   - ${from}\n   + ${to}`);
}
console.log(`\nTotal: ${aplicadas} ${APPLY ? 'aplicadas' : 'a aplicar (simulado)'}, ${sinMatch} sin match.`);
await prisma.$disconnect();
