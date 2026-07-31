// Diagnóstico: ¿cuántas fotos que manda el cliente se están perdiendo?
//
// La foto que llega por WhatsApp es, muchas veces, LA RECETA. Si el bot no logra
// bajarla y subirla al CRM, el mensaje se guarda sin archivo y en el buzón queda
// como "Imagen de WhatsApp" en gris — y WhatsApp ya borró el original, así que
// hay que volver a pedírsela al cliente.
//
// Este check responde tres cosas:
//   1. Cuánto se pierde HOY, por mes (para ver si el arreglo del 30/7 sirvió).
//   2. Si el que falla es un tipo de archivo puntual o son todos.
//   3. Qué conversaciones recientes quedaron sin la foto, para ir a pedirla.
//
// Solo lectura. Uso: node scripts/checks/wa-fotos-perdidas.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });

const fmt = (rows) => {
  if (!rows.length) return console.log('  (sin filas)');
  console.table(rows.map(r => {
    const o = {};
    for (const k of Object.keys(r)) o[k] = r[k] instanceof Date ? r[k].toISOString().slice(0, 16) : r[k];
    return o;
  }));
};

(async () => {
  console.log('\n=== 1. Fotos recibidas por mes: cuántas quedaron SIN archivo ===');
  fmt(await p.$queryRawUnsafe(`
    SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS mes,
           count(*)::int                                        AS recibidas,
           count("mediaUrl")::int                               AS con_archivo,
           (count(*) - count("mediaUrl"))::int                  AS PERDIDAS,
           round(100.0 * count("mediaUrl") / count(*))::int      AS pct_ok
    FROM "WhatsAppMessage"
    WHERE type = 'IMAGE' AND direction = 'INBOUND'
    GROUP BY 1 ORDER BY 1 DESC LIMIT 8
  `));

  console.log('\n=== 2. ¿Falla sólo con imágenes o con todo tipo de archivo? ===');
  fmt(await p.$queryRawUnsafe(`
    SELECT type,
           count(*)::int                                   AS total,
           count("mediaUrl")::int                          AS con_archivo,
           round(100.0 * count("mediaUrl") / count(*))::int AS pct_ok
    FROM "WhatsAppMessage"
    WHERE type <> 'TEXT' AND direction = 'INBOUND'
      AND "createdAt" > now() - interval '60 days'
    GROUP BY 1 ORDER BY 2 DESC
  `));

  console.log('\n=== 3. Últimos 30 días: fotos perdidas por hora del día ===');
  console.log('    (si se concentran en un horario, apunta a saturación o a que el bot estaba caído)');
  fmt(await p.$queryRawUnsafe(`
    SELECT EXTRACT(hour FROM "createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires')::int AS hora_arg,
           count(*)::int AS perdidas
    FROM "WhatsAppMessage"
    WHERE type = 'IMAGE' AND direction = 'INBOUND' AND "mediaUrl" IS NULL
      AND "createdAt" > now() - interval '30 days'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  `));

  console.log('\n=== 4. Conversaciones con foto perdida en los últimos 14 días ===');
  console.log('    (a estas personas hay que volver a pedirles la receta)');
  fmt(await p.$queryRawUnsafe(`
    SELECT m."createdAt",
           COALESCE(cl.name, c."profileName", c."waId") AS cliente,
           COALESCE(c."realPhone", c."waId")            AS telefono
    FROM "WhatsAppMessage" m
    JOIN "WhatsAppChat" c  ON c.id = m."chatId"
    LEFT JOIN "Client"   cl ON cl.id = c."clientId"
    WHERE m.type = 'IMAGE' AND m.direction = 'INBOUND' AND m."mediaUrl" IS NULL
      AND m."createdAt" > now() - interval '14 days'
    ORDER BY m."createdAt" DESC LIMIT 25
  `));

  await p.$disconnect();
})().catch(async (e) => {
  console.error('Error:', e.message);
  await p.$disconnect();
  process.exit(1);
});
