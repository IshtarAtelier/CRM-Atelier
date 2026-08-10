/**
 * Engancha los chats de WhatsApp huérfanos con la ficha del cliente que les
 * corresponde. ESCRIBE en la base (solo con `--aplicar`).
 *
 * Por qué hace falta: el vínculo chat↔cliente se armaba en un solo sentido —al
 * crear una ficha se buscaban sus chats sueltos—, pero cuando el WhatsApp
 * entraba primero el chat quedaba con `clientId` en null para siempre. Como el
 * reporte de ROAS cruza gasto contra ventas POR clientId, las ventas de esa
 * gente eran invisibles y el retorno de cada anuncio quedaba subestimado.
 * De ahí en más el código ya lo resuelve solo (src/lib/whatsapp/vincular-chat.ts);
 * este script es para lo que quedó atrás.
 *
 * Criterio de matcheo: últimos 8 dígitos del teléfono, el mismo que usa el
 * resto del proyecto. Si más de una ficha comparte ese final, NO se vincula:
 * meter la conversación de una persona en la ficha de otra es peor que dejarla
 * suelta. Esos casos se listan aparte para resolverlos a mano.
 *
 * Uso:
 *   node scripts/maintenance/vincular-chats-huerfanos.mjs            → simula, no toca nada
 *   node scripts/maintenance/vincular-chats-huerfanos.mjs --aplicar  → escribe
 *
 * Corre contra la base LOCAL. Para producción hace falta autorización explícita
 * de la dueña y pasar PROD_DATABASE_URL como DATABASE_URL en el comando.
 */
import { PrismaClient } from '@prisma/client';

const APLICAR = process.argv.includes('--aplicar');
const prisma = new PrismaClient();

/** Dígitos del teléfono de un chat. Un @lid no es un teléfono: se descarta. */
function telefonoDeChat(chat) {
  const desdeReal = (chat.realPhone || '').replace(/\D/g, '');
  if (desdeReal.length >= 8) return desdeReal;
  const waId = chat.waId || '';
  if (!waId.includes('@c.us')) return null;
  const digitos = waId.split('@')[0].replace(/\D/g, '');
  return digitos.length >= 8 ? digitos : null;
}

const url = process.env.DATABASE_URL || '';
const esLocal = url.includes('localhost') || url.includes('127.0.0.1');
console.log(`Base: ${esLocal ? 'LOCAL' : '⚠️  NO LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'simulación'}\n`);

const huerfanos = await prisma.whatsAppChat.findMany({
  where: { clientId: null },
  select: { id: true, waId: true, realPhone: true, adTag: true },
});

const vinculables = [];
const ambiguos = [];
const sinTelefono = [];
const sinFicha = [];

for (const chat of huerfanos) {
  const telefono = telefonoDeChat(chat);
  if (!telefono) {
    sinTelefono.push(chat);
    continue;
  }
  const candidatos = await prisma.client.findMany({
    where: { isDeleted: false, phone: { contains: telefono.slice(-8) } },
    select: { id: true, name: true },
    take: 3,
  });
  if (candidatos.length === 1) vinculables.push({ chat, cliente: candidatos[0] });
  else if (candidatos.length > 1) ambiguos.push({ chat, candidatos });
  else sinFicha.push(chat);
}

console.log(`Chats sin cliente: ${huerfanos.length}`);
console.log(`  ✅ se pueden vincular : ${vinculables.length}`);
console.log(`  ⚠️  ficha ambigua      : ${ambiguos.length}  (comparten los últimos 8 dígitos)`);
console.log(`  ·  sin ficha           : ${sinFicha.length}  (nunca se cargaron como contacto)`);
console.log(`  ·  sin teléfono usable : ${sinTelefono.length}  (@lid, sin realPhone)`);

const conAnuncio = vinculables.filter((v) => v.chat.adTag);
if (conAnuncio.length) {
  console.log(`\n  De los vinculables, ${conAnuncio.length} vienen de un anuncio:`);
  for (const v of conAnuncio) console.log(`     ${v.chat.adTag}  →  ${v.cliente.name}`);
}

if (ambiguos.length) {
  console.log('\n  Ambiguos (resolver a mano):');
  for (const a of ambiguos.slice(0, 10)) {
    console.log(`     ${a.chat.waId}  →  ${a.candidatos.map((c) => c.name).join(' | ')}`);
  }
  if (ambiguos.length > 10) console.log(`     … y ${ambiguos.length - 10} más`);
}

if (!APLICAR) {
  console.log('\nSimulación: no se escribió nada. Agregar --aplicar para vincular.');
  await prisma.$disconnect();
  process.exit(0);
}

let hechos = 0;
for (const { chat, cliente } of vinculables) {
  // `clientId: null` en el where: si algo lo vinculó mientras corría, no se pisa.
  const r = await prisma.whatsAppChat.updateMany({
    where: { id: chat.id, clientId: null },
    data: { clientId: cliente.id },
  });
  hechos += r.count;
}
console.log(`\n✅ ${hechos} chats vinculados.`);
await prisma.$disconnect();
