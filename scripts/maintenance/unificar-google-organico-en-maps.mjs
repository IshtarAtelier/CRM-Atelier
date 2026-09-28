// ────────────────────────────────────────────────────────────────────────────
// ESCRIBE EN LA BASE. Pasa las fichas con origen "Google orgánico" a
// "Google Maps" (unificados el 28/9/2026, pedido de Ishtar: en el mostrador no
// hay forma de saber si nos buscaron en Google o en Maps). Resincroniza la
// etiqueta de canal, deja una nota firmada en la ficha y un registro de
// auditoría. Idempotente: una segunda corrida no encuentra nada.
//
// Uso (sin --aplicar solo muestra qué haría):
//   node --env-file=.env --experimental-strip-types --import ./scripts/checks/_alias.mjs \
//     scripts/maintenance/unificar-google-organico-en-maps.mjs [--prod] [--aplicar]
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const usarProd = process.argv.includes('--prod');
const aplicar = process.argv.includes('--aplicar');
const url = usarProd ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error('Falta la URL de la base en el entorno.'); process.exit(1); }
globalThis.prisma = new PrismaClient({ datasourceUrl: url });
const prisma = globalThis.prisma;

const { syncContactTags } = await import('../../src/services/contact.service.ts');
const { logAudit } = await import('../../src/lib/audit.ts');
const { SYSTEM_ACTOR } = await import('../../src/lib/actor.ts');

const fichas = await prisma.client.findMany({
  where: { contactSource: 'Google orgánico' },
  select: { id: true, name: true },
});
console.log(`Base: ${usarProd ? 'PRODUCCIÓN' : 'local'} · ${fichas.length} ficha(s) con "Google orgánico"${aplicar ? '' : ' (modo prueba, no escribe)'}`);

for (const f of fichas) {
  console.log(`  ${f.name} → Google Maps`);
  if (!aplicar) continue;
  await prisma.client.update({ where: { id: f.id }, data: { contactSource: 'Google Maps' }, select: { id: true } });
  await prisma.interaction.create({
    data: {
      clientId: f.id,
      type: 'NOTE',
      content: `${SYSTEM_ACTOR.name}: origen "Google orgánico" pasado a "Google Maps" (se unificaron las dos opciones el 28/9/2026).`,
      userId: SYSTEM_ACTOR.id,
      userName: SYSTEM_ACTOR.name,
    },
    select: { id: true },
  });
  const tags = await syncContactTags(f.id, { audit: true });
  await logAudit({
    userId: SYSTEM_ACTOR.id,
    userName: SYSTEM_ACTOR.name,
    action: 'UPDATE',
    entityType: 'CONTACT',
    entityId: f.id,
    details: { contactSource: { antes: 'Google orgánico', despues: 'Google Maps' }, etiquetas: tags },
  });
  console.log(`    etiquetas: +${tags.conectadas.join(', ') || '—'} / −${tags.desconectadas.join(', ') || '—'}`);
}

await prisma.$disconnect();
