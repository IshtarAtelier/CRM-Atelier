// Diagnóstico: ¿los seguimientos de venta se duplicaron, se perdieron, o nunca corrieron?
//
// Contesta tres preguntas distintas, porque el código tiene caminos para las tres:
//   DUPLICADO — dos envíos del mismo tier al mismo cliente (etiqueta que no se
//     grabó por el catch vacío de sales-followups.js, o chat equivocado por
//     whatsappChats[0] sin orderBy, o trigger manual que saltea el chequeo).
//   PERDIDO   — el envío quedaba en un setTimeout de hasta ~7 min × N tareas y el
//     proceso se reinició: la etiqueta ya estaba puesta, así que el ciclo
//     siguiente cancela la tarea y el cliente nunca recibe nada.
//   NUNCA CORRIÓ — no hay tareas FOLLOWUP en absoluto.
//
// Solo lectura. Uso: node scripts/checks/followups-duplicados.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });

const TIERS = ['DIA_1', 'DIA_4', 'DIA_15'];

(async () => {
  const fmt = (rows) => {
    if (!rows.length) return console.log('  (sin filas)');
    console.table(rows.map(r => {
      const o = {};
      for (const k of Object.keys(r)) o[k] = r[k] instanceof Date ? r[k].toISOString().slice(0, 16) : r[k];
      return o;
    }));
  };

  console.log('\n=== 1. ¿Corrieron alguna vez? Tareas FOLLOWUP por estado ===');
  fmt(await p.$queryRawUnsafe(`
    SELECT status, count(*)::int AS tareas,
           min("createdAt") AS primera, max("createdAt") AS ultima
    FROM "ClientTask" WHERE type = 'FOLLOWUP' GROUP BY 1 ORDER BY 2 DESC
  `));

  console.log('\n=== 2. DUPLICADOS: mismo cliente + mismo tier enviado más de una vez ===');
  console.log('    (tareas en DONE agrupadas por tier del description)');
  for (const tier of TIERS) {
    const rows = await p.$queryRawUnsafe(`
      SELECT c.name AS cliente, count(*)::int AS envios,
             min(t."updatedAt") AS primero, max(t."updatedAt") AS ultimo
      FROM "ClientTask" t JOIN "Client" c ON c.id = t."clientId"
      WHERE t.type = 'FOLLOWUP' AND t.status = 'DONE' AND t.description LIKE '%${tier}%'
      GROUP BY c.id, c.name HAVING count(*) > 1
      ORDER BY 2 DESC LIMIT 20
    `);
    console.log(`  -- ${tier}: ${rows.length} cliente(s) con más de un envío`);
    if (rows.length) fmt(rows);
  }

  console.log('\n=== 3. DUPLICADOS por chat: etiqueta puesta pero varios salientes del Bot ===');
  console.log('    (ráfagas de 2+ mensajes del Bot en 30 min sin entrante en medio)');
  fmt(await p.$queryRawUnsafe(`
    WITH bot AS (
      SELECT m."chatId", m."createdAt",
             lag(m."createdAt") OVER (PARTITION BY m."chatId" ORDER BY m."createdAt") AS previo
      FROM "WhatsAppMessage" m
      WHERE m.direction = 'OUTBOUND' AND m."senderName" = 'Bot'
    )
    SELECT c."waId", COALESCE(cl.name,'(sin ficha)') AS cliente,
           count(*)::int AS rafagas, max(bot."createdAt") AS ultima
    FROM bot
    JOIN "WhatsAppChat" c ON c.id = bot."chatId"
    LEFT JOIN "Client" cl ON cl.id = c."clientId"
    WHERE bot.previo IS NOT NULL
      AND bot."createdAt" - bot.previo < interval '30 minutes'
      AND EXISTS (SELECT 1 FROM unnest(c."chatLabels") l WHERE l LIKE 'SEGUIMIENTO%')
    GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20
  `));

  console.log('\n=== 4. PERDIDOS: tareas canceladas por "ya no es elegible" ===');
  console.log('    (si dice que ya tenía la etiqueta, el envío se perdió en un reinicio)');
  fmt(await p.$queryRawUnsafe(`
    SELECT left(t.description, 70) AS tarea, t.status,
           count(*)::int AS n, max(t."updatedAt") AS ultima
    FROM "ClientTask" t
    WHERE t.type = 'FOLLOWUP' AND t.status = 'CANCELLED'
    GROUP BY 1,2 ORDER BY 3 DESC LIMIT 15
  `));

  console.log('\n=== 5. PERDIDOS: tareas vencidas hace rato y todavía PENDING ===');
  fmt(await p.$queryRawUnsafe(`
    SELECT left(t.description, 50) AS tarea, t."dueDate",
           round(EXTRACT(EPOCH FROM (now() - t."dueDate")) / 86400)::int AS dias_vencida
    FROM "ClientTask" t
    WHERE t.type = 'FOLLOWUP' AND t.status = 'PENDING' AND t."dueDate" < now() - interval '1 day'
    ORDER BY t."dueDate" ASC LIMIT 20
  `));

  console.log('\n=== 6. RIESGO whatsappChats[0]: clientes con más de un chat ===');
  console.log('    (el código toma el primero sin orderBy: la etiqueta puede ir al chat equivocado)');
  fmt(await p.$queryRawUnsafe(`
    SELECT COALESCE(cl.name,'?') AS cliente, count(*)::int AS chats,
           string_agg(DISTINCT CASE WHEN c."waId" LIKE '%@lid' THEN 'lid' ELSE 'c.us' END, '+') AS formatos,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM unnest(c."chatLabels") l WHERE l LIKE 'SEGUIMIENTO%'
           ))::int AS chats_con_etiqueta
    FROM "WhatsAppChat" c JOIN "Client" cl ON cl.id = c."clientId"
    GROUP BY cl.id, cl.name HAVING count(*) > 1
    ORDER BY 2 DESC LIMIT 20
  `));

  console.log('\n=== 7. Etiquetas de seguimiento aplicadas, por tier ===');
  fmt(await p.$queryRawUnsafe(`
    SELECT l AS etiqueta, count(*)::int AS chats
    FROM "WhatsAppChat" c, unnest(c."chatLabels") l
    WHERE l LIKE 'SEGUIMIENTO%' GROUP BY 1 ORDER BY 2 DESC
  `));

  await p.$disconnect();
})().catch(async (e) => {
  console.error('Error:', e.message);
  await p.$disconnect();
  process.exit(1);
});
