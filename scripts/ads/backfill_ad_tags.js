#!/usr/bin/env node
/**
 * Backfill de WhatsAppChat.adTag / Client.adTag para chats anteriores a la
 * columna: parsea el primer mensaje entrante con corchete "[meta...]" de cada
 * chat sin etiqueta, graba la etiqueta normalizada ([metaFlor] → "flor") y
 * después copia al cliente vinculado (primer toque: el chat más viejo gana,
 * nunca pisa un adTag ya grabado).
 *
 * Solo corchetes — las etiquetas deducidas por producto (myolens, clip…) son
 * conjeturas de análisis y NO se persisten como origen del cliente.
 *
 * Uso:
 *   node scripts/ads/backfill_ad_tags.js            (dry-run contra la DB local)
 *   node scripts/ads/backfill_ad_tags.js --aplicar  (escribe en la DB local)
 *   node scripts/ads/backfill_ad_tags.js --prod --aplicar   (escribe en PRODUCCIÓN)
 */

const { PrismaClient, Prisma } = require('@prisma/client');

const usarProd = process.argv.includes('--prod');
const aplicar = process.argv.includes('--aplicar');

/** "[metaFlor]" → "flor" — misma normalización que la ingestión del wa-service. */
function etiquetaPrefill(txt) {
  if (!txt) return null;
  const m = String(txt).match(/\[\s*meta([^\]]*?)\s*\]/i);
  if (!m) return null;
  const tag = m[1].trim().toLowerCase().replace(/\s+/g, '');
  return tag || null;
}

async function main() {
  if (usarProd && !process.env.PROD_DATABASE_URL) {
    console.error('Falta PROD_DATABASE_URL en el entorno.');
    process.exit(1);
  }
  const prisma = usarProd
    ? new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } })
    : new PrismaClient();

  console.log(`Base: ${usarProd ? 'PRODUCCIÓN' : 'local'} — ${aplicar ? 'APLICANDO' : 'dry-run (sin escribir)'}\n`);

  // 1. Chats sin etiqueta cuyo primer mensaje entrante con "[meta" la trae.
  //    $queryRaw con select angosto: el schema local puede estar adelantado a prod.
  const candidatos = await prisma.$queryRaw`
    SELECT c.id, c."clientId", m.content
    FROM "WhatsAppChat" c
    JOIN LATERAL (
      SELECT content FROM "WhatsAppMessage"
      WHERE "chatId" = c.id AND direction = 'INBOUND' AND content ILIKE '%[meta%'
      ORDER BY "createdAt" ASC LIMIT 1
    ) m ON true
    WHERE c."adTag" IS NULL`;

  const pares = [];
  const porTag = {};
  for (const c of candidatos) {
    const tag = etiquetaPrefill(c.content);
    if (!tag) continue;
    pares.push({ id: c.id, tag });
    porTag[tag] = (porTag[tag] || 0) + 1;
  }

  console.log(`Chats con etiqueta en el primer mensaje y adTag vacío: ${pares.length}`);
  for (const [tag, n] of Object.entries(porTag).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tag.padEnd(20)} ${n}`);
  }

  // Un solo UPDATE por lote (VALUES) en vez de un round-trip por chat: contra
  // Railway/Singapur, 353 llamadas secuenciales agotan la conexión a mitad de
  // camino (P1017, "server has closed the connection"). adTag IS NULL hace que
  // retomar un backfill cortado sea seguro: los lotes ya aplicados se saltean.
  if (aplicar && pares.length) {
    const LOTE = 100;
    for (let i = 0; i < pares.length; i += LOTE) {
      const lote = pares.slice(i, i + LOTE);
      const values = Prisma.join(
        lote.map((p) => Prisma.sql`(${p.id}::text, ${p.tag}::text)`),
        ', '
      );
      await prisma.$executeRaw`
        UPDATE "WhatsAppChat" AS c SET "adTag" = v.tag
        FROM (VALUES ${values}) AS v(id, tag)
        WHERE c.id = v.id AND c."adTag" IS NULL`;
      console.log(`  lote ${Math.floor(i / LOTE) + 1}: ${lote.length} chats grabados`);
    }
  }

  // 2. Copia a los clientes vinculados (solo los que no tienen adTag).
  if (aplicar) {
    const filas = await prisma.$executeRaw`
      UPDATE "Client" c SET "adTag" = t."adTag"
      FROM (
        SELECT DISTINCT ON ("clientId") "clientId", "adTag"
        FROM "WhatsAppChat"
        WHERE "clientId" IS NOT NULL AND "adTag" IS NOT NULL
        ORDER BY "clientId", "createdAt" ASC
      ) t
      WHERE c.id = t."clientId" AND c."adTag" IS NULL`;
    console.log(`\nClientes que recibieron adTag: ${filas}`);
  } else {
    const [{ n }] = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT c."clientId")::int AS n
      FROM "WhatsAppChat" c
      JOIN "Client" cl ON cl.id = c."clientId"
      JOIN LATERAL (
        SELECT content FROM "WhatsAppMessage"
        WHERE "chatId" = c.id AND direction = 'INBOUND' AND content ILIKE '%[meta%'
        ORDER BY "createdAt" ASC LIMIT 1
      ) m ON true
      WHERE cl."adTag" IS NULL`;
    console.log(`\nClientes vinculados que recibirían adTag (aprox): ${n}`);
    console.log('Dry-run: nada escrito. Correr con --aplicar para grabar.');
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
