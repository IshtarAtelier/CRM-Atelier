/**
 * Ventas mes por mes — SOLO LECTURA.
 *
 * Pega contra PRODUCCIÓN (PROD_DATABASE_URL del .env). No escribe nada.
 *
 * Misma definición que el dashboard (src/app/api/dashboard/route.ts):
 *   - orderType 'SALE', isDeleted false
 *   - la venta se fecha por labSentAt; si nunca se envió a fábrica, por createdAt
 *   - el valor de la venta es subtotalWithMarkup || total
 *   - los meses se cortan en hora argentina (UTC-3), no UTC
 *
 * El mes en curso va marcado como incompleto: compararlo de igual a igual
 * contra meses cerrados siempre muestra una caída falsa.
 *
 * Uso:  node scripts/checks/ventas-por-mes.check.mjs
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const envRaw = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
const prodUrl = envRaw
  .split('\n')
  .find((l) => l.startsWith('PROD_DATABASE_URL='))
  ?.slice('PROD_DATABASE_URL='.length)
  .trim()
  .replace(/^["']|["']$/g, '');

if (!prodUrl) {
  console.error('No encontré PROD_DATABASE_URL en .env');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: prodUrl } } });

const ART = 3 * 60 * 60 * 1000;
const now = new Date();
const artNow = new Date(now.getTime() - ART);
const mesActual = `${artNow.getUTCFullYear()}-${String(artNow.getUTCMonth() + 1).padStart(2, '0')}`;

const fmt = (n) =>
  '$' + Math.round(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const orders = await prisma.order.findMany({
  where: { orderType: 'SALE', isDeleted: false },
  select: {
    total: true,
    subtotalWithMarkup: true,
    createdAt: true,
    labSentAt: true,
  },
});

const porMes = new Map();
for (const o of orders) {
  const fecha = o.labSentAt ?? o.createdAt;
  const art = new Date(fecha.getTime() - ART);
  const clave = `${art.getUTCFullYear()}-${String(art.getUTCMonth() + 1).padStart(2, '0')}`;
  const p = porMes.get(clave) || { n: 0, monto: 0 };
  p.n += 1;
  p.monto += o.subtotalWithMarkup || o.total || 0;
  porMes.set(clave, p);
}

const claves = [...porMes.keys()].sort();
const maxMonto = Math.max(...claves.map((k) => porMes.get(k).monto));

console.log('\nVENTAS MES POR MES (hora argentina)\n');
console.log('MES            VENTAS            MONTO   TICKET PROM.');
for (const k of claves) {
  const p = porMes.get(k);
  const [y, m] = k.split('-');
  const etiqueta = `${MESES[Number(m) - 1]} ${y}`;
  const barra = '█'.repeat(Math.max(1, Math.round((p.monto / maxMonto) * 24)));
  const marca = k === mesActual ? '  ← mes en curso, incompleto' : '';
  console.log(
    `${etiqueta.padEnd(10)} ${String(p.n).padStart(6)}   ${fmt(p.monto).padStart(14)}   ${fmt(p.monto / p.n).padStart(12)}  ${barra}${marca}`
  );
}

// ── Mismos días de cada mes que lleva el mes en curso ──
// Un mes a medias contra meses enteros siempre "cae". Esta tabla compara
// el 1→N de todos los meses, con N = el día de hoy.
const hoyD = artNow.getUTCDate();
const porMesParcial = new Map();
for (const o of orders) {
  const fecha = o.labSentAt ?? o.createdAt;
  const art = new Date(fecha.getTime() - ART);
  if (art.getUTCDate() > hoyD) continue;
  const clave = `${art.getUTCFullYear()}-${String(art.getUTCMonth() + 1).padStart(2, '0')}`;
  const p = porMesParcial.get(clave) || { n: 0, monto: 0 };
  p.n += 1;
  p.monto += o.subtotalWithMarkup || o.total || 0;
  porMesParcial.set(clave, p);
}

console.log(`\nSOLO DEL 1 AL ${hoyD} DE CADA MES (lo mismo que lleva agosto)\n`);
console.log('MES            VENTAS            MONTO');
const maxParcial = Math.max(...[...porMesParcial.values()].map((p) => p.monto));
for (const k of claves) {
  const p = porMesParcial.get(k);
  if (!p) continue;
  const [y, m] = k.split('-');
  const barra = '█'.repeat(Math.max(1, Math.round((p.monto / maxParcial) * 24)));
  console.log(
    `${`${MESES[Number(m) - 1]} ${y}`.padEnd(10)} ${String(p.n).padStart(6)}   ${fmt(p.monto).padStart(14)}  ${barra}`
  );
}

await prisma.$disconnect();
