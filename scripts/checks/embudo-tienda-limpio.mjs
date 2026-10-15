// ────────────────────────────────────────────────────────────────────────────
// Embudo LIMPIO de la tienda: la foto semanal.
//
// SOLO LEE. Imprime, a 30 y a 7 días:
//   - el embudo por dispositivo y por fuente (sesiones distintas):
//     page_view → view_content → add_to_cart → begin_checkout → add_contact → purchase
//   - los pasos del configurador de lentes (lens_config_*), celular / compu
//   - los clics a WhatsApp por página
//
// "Limpio" quiere decir con la MISMA regla que /admin/analitica y /api/web/track
// (src/lib/analitica/ruido.ts): sin el robot de Google Merchant, sin las
// pruebas internas del 25/9/2026 y sin el producto `prueba-compra-un-peso`.
// Si este script y el panel difieren, el bug es del panel o de acá, nunca de la
// regla: hay una sola.
//
// Uso:
//   npm run check:embudo-tienda              (base del .env)
//   npm run check:embudo-tienda -- --prod    (producción, solo lectura)
//   (node --experimental-strip-types --import ./scripts/checks/_alias.mjs
//    scripts/checks/embudo-tienda-limpio.mjs)
// ────────────────────────────────────────────────────────────────────────────
import { Prisma, PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { sqlSinRuido, sqlSesionesRobot } from '../../src/lib/analitica/ruido.ts';

const usarProd = process.argv.includes('--prod');

// El .env no se parsea con dotenv a propósito: solo se saca la URL que hace
// falta y nunca se imprime. Si la variable ya viene en el entorno
// (`node --env-file=…`), se usa esa.
function leerEnv() {
  const ruta = new URL('../../.env', import.meta.url);
  if (!existsSync(ruta)) return {};
  return Object.fromEntries(
    readFileSync(ruta, 'utf8')
      .split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
  );
}
const env = { ...leerEnv(), ...process.env };
const url = usarProd ? env.PROD_DATABASE_URL : env.DATABASE_URL;
if (!url) {
  console.error(`No encontré ${usarProd ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} (ni en .env ni en el entorno)`);
  process.exit(1);
}
console.log(`Base: ${usarProd ? 'PRODUCCIÓN (solo lectura)' : 'la del .env'} (${url.replace(/:\/\/[^@]*@/, '://***@').split('?')[0]})`);

const prisma = new PrismaClient({ datasourceUrl: url });
const n = (v) => Number(v ?? 0);
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1).replace('.', ',')} %` : '—');
const ETAPAS = ['page_view', 'view_content', 'add_to_cart', 'begin_checkout', 'add_contact', 'purchase'];
const PASOS = ['lens_config_start', 'lens_config_type', 'lens_config_treatment', 'lens_config_prescription', 'lens_config_prescription_whatsapp', 'lens_config_complete'];

function tabla(filas, columnas) {
  const anchos = columnas.map((c) => Math.max(c.length, ...filas.map((f) => String(f[c] ?? '').length)));
  const linea = (f) => columnas.map((c, i) => String(f[c] ?? '').padEnd(anchos[i])).join('  ');
  console.log('  ' + linea(Object.fromEntries(columnas.map((c) => [c, c]))));
  console.log('  ' + anchos.map((a) => '─'.repeat(a)).join('  '));
  for (const f of filas) console.log('  ' + linea(f));
}

/** Una fila por sesión con su dispositivo, fuente y hasta qué etapa llegó. */
function sqlSesiones(desde) {
  return Prisma.sql`
    SELECT "sessionId",
           COALESCE(MIN(device), 'desconocido')                          AS dispositivo,
           COALESCE(MAX(NULLIF("utmSource", '')), 'directo/orgánico')    AS fuente,
           ${Prisma.join(ETAPAS.map((t) => Prisma.sql`bool_or(type = ${t}) AS ${Prisma.raw('"' + t + '"')}`))}
    FROM "AnalyticsEvent"
    WHERE "createdAt" >= ${desde} AND ${sqlSinRuido()}
    GROUP BY "sessionId"`;
}

async function embudoPor(campo, desde) {
  const filas = await prisma.$queryRaw(Prisma.sql`
    SELECT ${Prisma.raw(campo)} AS grupo,
           ${Prisma.join(ETAPAS.map((t) => Prisma.sql`count(*) FILTER (WHERE ${Prisma.raw('"' + t + '"')}) AS ${Prisma.raw('"' + t + '"')}`))}
    FROM (${sqlSesiones(desde)}) s
    GROUP BY 1 ORDER BY 2 DESC`);
  return filas.map((f) => {
    const o = { grupo: f.grupo };
    for (const t of ETAPAS) o[t] = n(f[t]);
    o['ficha→carrito'] = pct(o.add_to_cart, o.view_content);
    o['carrito→checkout'] = pct(o.begin_checkout, o.add_to_cart);
    o['checkout→contacto'] = pct(o.add_contact, o.begin_checkout);
    return o;
  });
}

async function configurador(desde) {
  const filas = await prisma.$queryRaw(Prisma.sql`
    SELECT COALESCE(device, 'desconocido') AS dispositivo, type, count(DISTINCT "sessionId") AS sesiones
    FROM "AnalyticsEvent"
    WHERE "createdAt" >= ${desde} AND type IN (${Prisma.join(PASOS)}) AND ${sqlSinRuido()}
    GROUP BY 1, 2`);
  const dispositivos = [...new Set(filas.map((f) => f.dispositivo))].sort();
  return dispositivos.map((d) => {
    const o = { dispositivo: d };
    for (const p of PASOS) o[p.replace('lens_config_', '')] = n(filas.find((f) => f.dispositivo === d && f.type === p)?.sesiones);
    o['inicio→receta'] = pct(o.prescription, o.start);
    o['inicio→completo'] = pct(o.complete, o.start);
    return o;
  });
}

async function whatsappPorPagina(desde) {
  const filas = await prisma.$queryRaw(Prisma.sql`
    SELECT COALESCE(meta->>'location', path, '(sin página)') AS pagina,
           count(*) AS clics, count(DISTINCT "sessionId") AS sesiones
    FROM "AnalyticsEvent"
    WHERE "createdAt" >= ${desde} AND type IN ('whatsapp_click', 'lens_config_prescription_whatsapp') AND ${sqlSinRuido()}
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15`);
  return filas.map((f) => ({ pagina: f.pagina, clics: n(f.clics), sesiones: n(f.sesiones) }));
}

try {
  const robot = await prisma.$queryRaw(sqlSesionesRobot());
  const [ruidoProducto] = await prisma.$queryRaw(Prisma.sql`
    SELECT count(*) AS filas FROM "AnalyticsEvent"
    WHERE NOT ${sqlSinRuido()} AND "sessionId" NOT IN (${sqlSesionesRobot()})`);
  console.log(`Ruido descontado: ${robot.length} sesiones del robot de Merchant · ${n(ruidoProducto.filas)} eventos de pruebas internas / producto de prueba\n`);

  for (const dias of [30, 7]) {
    const desde = new Date(Date.now() - dias * 24 * 3600 * 1000);
    console.log(`\n══════════ ÚLTIMOS ${dias} DÍAS (desde ${desde.toISOString().slice(0, 10)}) ══════════`);

    console.log('\nEmbudo por dispositivo (sesiones distintas)');
    tabla(await embudoPor('dispositivo', desde), ['grupo', ...ETAPAS, 'ficha→carrito', 'carrito→checkout', 'checkout→contacto']);

    console.log('\nEmbudo por fuente (sesiones distintas)');
    tabla(await embudoPor('fuente', desde), ['grupo', ...ETAPAS, 'ficha→carrito', 'carrito→checkout', 'checkout→contacto']);

    console.log('\nConfigurador de lentes (sesiones distintas por paso)');
    const conf = await configurador(desde);
    if (conf.length) tabla(conf, ['dispositivo', ...PASOS.map((p) => p.replace('lens_config_', '')), 'inicio→receta', 'inicio→completo']);
    else console.log('  (sin eventos del configurador en la ventana)');

    console.log('\nClics a WhatsApp por página');
    const wa = await whatsappPorPagina(desde);
    if (wa.length) tabla(wa, ['pagina', 'clics', 'sesiones']);
    else console.log('  (sin clics a WhatsApp en la ventana)');
  }
  console.log('\nRegla de limpieza: src/lib/analitica/ruido.ts (la misma que /admin/analitica).');
} finally {
  await prisma.$disconnect();
}
