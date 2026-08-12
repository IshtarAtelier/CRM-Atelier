/**
 * Ventas de la última semana — SOLO LECTURA.
 *
 * Pega contra PRODUCCIÓN (PROD_DATABASE_URL del .env). No escribe nada:
 * un único findMany con select explícito y la suma en memoria.
 *
 * Usa la MISMA definición que el dashboard (src/app/api/dashboard/route.ts):
 *   - orderType 'SALE', isDeleted false
 *   - la venta se fecha por labSentAt; si nunca se envió a fábrica, por createdAt
 *   - el valor de la venta es subtotalWithMarkup || total
 *   - los cortes de día son en hora argentina (UTC-3), no UTC
 *
 * Uso:  node scripts/checks/ventas-ultima-semana.check.mjs
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

// ── URL de producción, leída del .env sin imprimirla nunca ──
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

const ART = 3 * 60 * 60 * 1000; // UTC-3, sin horario de verano
const now = new Date();
const artNow = new Date(now.getTime() - ART);
const startOfDayART = new Date(
  Date.UTC(artNow.getUTCFullYear(), artNow.getUTCMonth(), artNow.getUTCDate()) + ART
);
const daysFromMonday = (artNow.getUTCDay() + 6) % 7; // lunes = inicio de semana
const startOfWeek = new Date(startOfDayART.getTime() - daysFromMonday * 86400000);
const start7d = new Date(startOfDayART.getTime() - 6 * 86400000);

const ventana = start7d < startOfWeek ? start7d : startOfWeek;

const diaART = (d) => new Date(d.getTime() - ART).toISOString().slice(0, 10);
const fmt = (n) =>
  '$' + Math.round(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });

const orders = await prisma.order.findMany({
  where: {
    orderType: 'SALE',
    isDeleted: false,
    OR: [
      { labSentAt: { gte: ventana } },
      { AND: [{ labSentAt: null }, { createdAt: { gte: ventana } }] },
    ],
  },
  select: {
    id: true,
    total: true,
    subtotalWithMarkup: true,
    createdAt: true,
    labSentAt: true,
    labSentBy: true,
    client: { select: { name: true } },
  },
});

const ventas = orders.map((o) => ({
  fecha: o.labSentAt ?? o.createdAt,
  enviada: Boolean(o.labSentAt),
  valor: o.subtotalWithMarkup || o.total || 0,
  vendedor: o.labSentBy || (o.labSentAt ? '(enviada, sin vendedor firmado)' : '(sin enviar a fábrica)'),
  cliente: o.client?.name || '(sin cliente)',
}));

function resumen(titulo, desde) {
  const sel = ventas.filter((v) => v.fecha >= desde);
  const total = sel.reduce((a, v) => a + v.valor, 0);
  console.log(`\n${titulo}`);
  console.log(`  desde ${diaART(desde)} 00:00 ART hasta ahora (${diaART(now)})`);
  console.log(`  ${sel.length} ventas — ${fmt(total)}`);
  if (sel.length) {
    console.log(`  ticket promedio: ${fmt(total / sel.length)}`);
    const sinEnviar = sel.filter((v) => !v.enviada);
    if (sinEnviar.length) {
      const m = sinEnviar.reduce((a, v) => a + v.valor, 0);
      console.log(
        `  (de ese total, ${sinEnviar.length} por ${fmt(m)} todavía no se enviaron a fábrica — se fechan por createdAt)`
      );
    }
  }
  return sel;
}

const sel7 = resumen('ÚLTIMOS 7 DÍAS', start7d);
resumen('SEMANA EN CURSO (desde el lunes)', startOfWeek);

// ── Detalle día por día sobre la ventana de 7 días ──
const porDia = new Map();
for (const v of sel7) {
  const d = diaART(v.fecha);
  const p = porDia.get(d) || { n: 0, monto: 0 };
  p.n += 1;
  p.monto += v.valor;
  porDia.set(d, p);
}
console.log('\nDÍA POR DÍA (últimos 7 días)');
for (let i = 6; i >= 0; i--) {
  const d = diaART(new Date(startOfDayART.getTime() - i * 86400000));
  const p = porDia.get(d) || { n: 0, monto: 0 };
  console.log(`  ${d}  ${String(p.n).padStart(2)} ventas  ${fmt(p.monto)}`);
}

// ── Por vendedor (quien la envió a fábrica) ──
const porVendedor = new Map();
for (const v of sel7) {
  const p = porVendedor.get(v.vendedor) || { n: 0, monto: 0 };
  p.n += 1;
  p.monto += v.valor;
  porVendedor.set(v.vendedor, p);
}
console.log('\nPOR VENDEDOR (últimos 7 días, según labSentBy)');
for (const [nombre, p] of [...porVendedor].sort((a, b) => b[1].monto - a[1].monto)) {
  console.log(`  ${nombre.padEnd(28)} ${String(p.n).padStart(2)} ventas  ${fmt(p.monto)}`);
}

await prisma.$disconnect();
