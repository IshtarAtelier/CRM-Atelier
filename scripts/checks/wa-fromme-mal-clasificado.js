// El waMessageId de whatsapp-web.js empieza con "true_" si el mensaje es NUESTRO (fromMe).
// Si hay filas INBOUND con waMessageId true_..., estamos guardando salientes como entrantes.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });
(async () => {
  const fmt = (rows) => console.table(rows.map(r => {
    const o = {};
    for (const k of Object.keys(r)) o[k] = r[k] instanceof Date ? r[k].toISOString().slice(0, 16) : r[k];
    return o;
  }));

  console.log('--- direction vs prefijo del waMessageId (30 dias) ---');
  fmt(await p.$queryRawUnsafe(`
    SELECT date_trunc('day',"createdAt") AS dia, direction,
           count(*) FILTER (WHERE "waMessageId" LIKE 'true_%')::int AS id_true_nuestro,
           count(*) FILTER (WHERE "waMessageId" LIKE 'false_%')::int AS id_false_cliente,
           count(*) FILTER (WHERE "waMessageId" IS NULL)::int AS sin_id
    FROM "WhatsAppMessage" WHERE "createdAt" > now() - interval '30 days'
    GROUP BY 1,2 ORDER BY 1 DESC, 2
  `));

  console.log('--- muestra de INBOUND con id true_ (serian salientes) ---');
  fmt(await p.$queryRawUnsafe(`
    SELECT "createdAt", left("waMessageId",30) AS wid, "senderName", left(content,45) AS c
    FROM "WhatsAppMessage"
    WHERE direction='INBOUND' AND "waMessageId" LIKE 'true_%'
    ORDER BY "createdAt" DESC LIMIT 10
  `));

  await p.$disconnect();
})();
