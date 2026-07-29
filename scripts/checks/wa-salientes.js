// Diagnóstico: ¿se están guardando los mensajes SALIENTES de WhatsApp?
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });
(async () => {
  const fmt = (rows) => console.table(rows.map(r => {
    const o = {};
    for (const k of Object.keys(r)) o[k] = r[k] instanceof Date ? r[k].toISOString().slice(0, 16) : r[k];
    return o;
  }));

  console.log('--- formato de waId por actividad reciente ---');
  fmt(await p.$queryRawUnsafe(`
    SELECT CASE WHEN "waId" LIKE '%@lid' THEN 'lid' WHEN "waId" LIKE '%@c.us' THEN 'c.us' ELSE 'otro' END AS formato,
           count(*)::int AS chats,
           count(*) FILTER (WHERE "lastMessageAt" > now() - interval '7 days')::int AS activos_7d,
           max("createdAt") AS ultimo_alta
    FROM "WhatsAppChat" GROUP BY 1 ORDER BY 2 DESC
  `));

  console.log('--- ultimo OUTBOUND por formato de waId ---');
  fmt(await p.$queryRawUnsafe(`
    SELECT CASE WHEN c."waId" LIKE '%@lid' THEN 'lid' ELSE 'c.us' END AS formato,
           max(m."createdAt") AS ultimo_outbound, count(*)::int AS total_outbound
    FROM "WhatsAppMessage" m JOIN "WhatsAppChat" c ON c.id = m."chatId"
    WHERE m.direction = 'OUTBOUND' GROUP BY 1
  `));

  console.log('--- altas de chat por dia (10d) ---');
  fmt(await p.$queryRawUnsafe(`
    SELECT date_trunc('day',"createdAt") AS dia,
           count(*) FILTER (WHERE "waId" LIKE '%@lid')::int AS lid,
           count(*) FILTER (WHERE "waId" LIKE '%@c.us')::int AS cus
    FROM "WhatsAppChat" WHERE "createdAt" > now() - interval '10 days' GROUP BY 1 ORDER BY 1 DESC
  `));

  await p.$disconnect();
})();
