// Repara los 2 nombres de tienda que syncToWebProduct pisó el 19/8 con
// "marca + código" (regla: nombre estelar + color; la marca va en su campo).
// Solo toca webProduct.name de los 2 IDs listados, nada más.
//
// Uso:  DATABASE_URL="$PROD_DATABASE_URL" node scripts/maintenance/reparar-nombres-dionisio.mjs --aplicar
//       (sin --aplicar solo muestra qué haría)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');

// IDs de la reversa del 27/7 (reversa-nombres-tienda-20260727-223031.json)
const FIXES = [
  { id: 'cmqwmgydv00031446ul77sr8v', nombre: 'Dionisio C4' },
  { id: 'cmqwmgwzo00011446r02vlcbm', nombre: 'Dionisio C2' },
];

for (const f of FIXES) {
  const wp = await prisma.webProduct.findUnique({
    where: { id: f.id },
    select: { id: true, name: true, slug: true },
  });
  if (!wp) { console.log(`NO EXISTE ${f.id}`); continue; }
  if (wp.name === f.nombre) { console.log(`OK ya está: ${wp.slug} = "${wp.name}"`); continue; }
  console.log(`${wp.slug}: "${wp.name}" -> "${f.nombre}"${APLICAR ? '' : '  (dry-run)'}`);
  if (APLICAR) {
    await prisma.webProduct.update({
      where: { id: f.id },
      data: { name: f.nombre },
      select: { id: true },
    });
  }
}
await prisma.$disconnect();
