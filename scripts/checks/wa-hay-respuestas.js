// ¿El silencio de salientes es "no se guarda" o "nadie contesta"?
// Señal: mensajes entrantes que solo tienen sentido como respuesta a algo nuestro.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });
(async () => {
  const fmt = (rows) => console.table(rows.map(r => {
    const o = {};
    for (const k of Object.keys(r)) o[k] = r[k] instanceof Date ? r[k].toISOString().slice(0, 16) : r[k];
    return o;
  }));

  console.log('--- entrantes que suenan a respuesta (por dia) ---');
  fmt(await p.$queryRawUnsafe(`
    SELECT date_trunc('day',"createdAt") AS dia, count(*)::int AS n
    FROM "WhatsAppMessage"
    WHERE direction='INBOUND' AND "createdAt" > now() - interval '20 days'
      AND content ~* '(gracias|dale|perfecto|ok listo|de acuerdo|barbaro|genial|buenisimo)'
    GROUP BY 1 ORDER BY 1 DESC
  `));

  console.log('--- chats con inbound reciente: unreadCount (0 = alguien los lee en el celu) ---');
  fmt(await p.$queryRawUnsafe(`
    SELECT count(*)::int AS chats_activos_7d,
           count(*) FILTER (WHERE "unreadCount" = 0)::int AS leidos,
           count(*) FILTER (WHERE "unreadCount" > 0)::int AS sin_leer
    FROM "WhatsAppChat" WHERE "lastMessageAt" > now() - interval '7 days'
  `));

  console.log('--- ejemplo: ultimos 15 mensajes de un chat activo de hoy ---');
  const chat = await p.$queryRawUnsafe(`
    SELECT c.id, c."profileName" FROM "WhatsAppChat" c
    WHERE c."lastMessageAt" > now() - interval '2 days'
    ORDER BY (SELECT count(*) FROM "WhatsAppMessage" m WHERE m."chatId"=c.id) DESC LIMIT 1
  `);
  if (chat[0]) {
    console.log('chat:', chat[0].profileName);
    fmt(await p.$queryRawUnsafe(`
      SELECT "createdAt", direction, "senderName", left(content,50) AS c
      FROM "WhatsAppMessage" WHERE "chatId"=$1 ORDER BY "createdAt" DESC LIMIT 15
    `, chat[0].id));
  }

  await p.$disconnect();
})();
