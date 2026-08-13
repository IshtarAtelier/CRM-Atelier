/**
 * Los últimos 7 días contra el MISMO tramo de los dos meses anteriores — SOLO LECTURA.
 *
 * Pega contra PRODUCCIÓN (PROD_DATABASE_URL del .env). No escribe nada:
 * un único findMany con select explícito y las sumas en memoria.
 *
 * Misma definición que el dashboard (src/app/api/dashboard/route.ts):
 *   - orderType 'SALE', isDeleted false
 *   - la venta se fecha por labSentAt; si nunca se envió a fábrica, por createdAt
 *   - el valor de la venta es subtotalWithMarkup || total
 *   - los cortes de día son en hora argentina (UTC-3), no UTC
 *
 * El tramo son los mismos días del mes (ej. 06→12) en cada mes. El mes en curso
 * está cortado a la hora actual, así que los meses anteriores se cortan a la
 * MISMA hora del día 12: comparar un tramo a medias contra uno completo
 * inventaría una caída que no existe. El total del tramo cerrado se muestra
 * aparte, como referencia.
 *
 * Uso:  node scripts/checks/ventas-semana-vs-meses-anteriores.check.mjs
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
const DIA = 86400000;
const now = new Date();
const artNow = new Date(now.getTime() - ART);
const artY = artNow.getUTCFullYear();
const artM = artNow.getUTCMonth();
const artD = artNow.getUTCDate();
const artH = artNow.getUTCHours();
const artMin = artNow.getUTCMinutes();

// Tramo del mes en curso: los últimos 7 días (hoy incluido) → días `desdeD`..`artD`
const finDeDia = new Date(Date.UTC(artY, artM, artD) + ART);
const inicioTramo = new Date(finDeDia.getTime() - 6 * DIA);
const desdeD = new Date(inicioTramo.getTime() - ART).getUTCDate();

// Un tramo por mes: 0 = mes en curso, -1 = mes anterior, -2 = el anterior
const tramos = [0, -1, -2].map((delta) => {
  const inicio = new Date(Date.UTC(artY, artM + delta, desdeD) + ART);
  const corte = new Date(Date.UTC(artY, artM + delta, artD, artH, artMin) + ART);
  const finDelTramo = new Date(Date.UTC(artY, artM + delta, artD + 1) + ART);
  return { delta, inicio, corte, finDelTramo };
});

const ventana = tramos[2].inicio;

const diaART = (d) => new Date(d.getTime() - ART).toISOString().slice(0, 10);
const fmt = (n) =>
  '$' + Math.round(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombreMes = (d) => MESES[new Date(d.getTime() - ART).getUTCMonth()];
const pct = (a, b) => (b === 0 ? '—' : `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%`);

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
    total: true,
    subtotalWithMarkup: true,
    createdAt: true,
    labSentAt: true,
  },
});

const ventas = orders.map((o) => ({
  fecha: o.labSentAt ?? o.createdAt,
  enviada: Boolean(o.labSentAt),
  valor: o.subtotalWithMarkup || o.total || 0,
}));

const sumar = (desde, hasta) => {
  const sel = ventas.filter((v) => v.fecha >= desde && v.fecha < hasta);
  return { n: sel.length, monto: sel.reduce((a, v) => a + v.valor, 0), sel };
};

console.log(`\nTRAMO COMPARADO: del ${desdeD} al ${artD} de cada mes`);
console.log(`Cortado a las ${String(artH).padStart(2, '0')}:${String(artMin).padStart(2, '0')} ART del día ${artD} en los tres meses.\n`);

const filas = tramos.map((t) => {
  const eq = sumar(t.inicio, t.corte);
  const full = sumar(t.inicio, t.finDelTramo);
  return { ...t, eq, full };
});

const base = filas[0];
console.log('MES        VENTAS        MONTO        vs mes en curso   TICKET PROM.');
for (const f of filas) {
  const etiqueta = `${nombreMes(f.inicio)} ${new Date(f.inicio.getTime() - ART).getUTCFullYear()}`;
  const comp = f.delta === 0 ? '—' : pct(base.eq.monto, f.eq.monto);
  const ticket = f.eq.n ? fmt(f.eq.monto / f.eq.n) : '—';
  console.log(
    `${etiqueta.padEnd(10)} ${String(f.eq.n).padStart(3)}   ${fmt(f.eq.monto).padStart(14)}   ${comp.padStart(14)}   ${ticket.padStart(12)}`
  );
}

console.log('\nTRAMO COMPLETO (día ' + artD + ' entero — solo aplica a los meses cerrados)');
for (const f of filas) {
  if (f.delta === 0) continue;
  const etiqueta = `${nombreMes(f.inicio)}`;
  console.log(
    `  ${etiqueta.padEnd(6)} ${String(f.full.n).padStart(3)} ventas  ${fmt(f.full.monto).padStart(14)}`
  );
}

console.log('\nDÍA POR DÍA DEL TRAMO');
console.log('DÍA     ' + filas.map((f) => nombreMes(f.inicio).padStart(16)).join(''));
for (let i = 0; i < 7; i++) {
  const celdas = filas.map((f) => {
    const d0 = new Date(f.inicio.getTime() + i * DIA);
    const d1 = new Date(d0.getTime() + DIA);
    const hasta = d1 > f.corte ? f.corte : d1;
    const r = sumar(d0, hasta);
    return (r.n ? `${r.n}× ${fmt(r.monto)}` : '—').padStart(16);
  });
  console.log(String(desdeD + i).padStart(3).padEnd(8) + celdas.join(''));
}

console.log('\nVENTAS DEL TRAMO TODAVÍA NO ENVIADAS A FÁBRICA (se fechan por createdAt)');
for (const f of filas) {
  const sinEnviar = f.eq.sel.filter((v) => !v.enviada);
  const monto = sinEnviar.reduce((a, v) => a + v.valor, 0);
  console.log(`  ${nombreMes(f.inicio).padEnd(6)} ${String(sinEnviar.length).padStart(2)} ventas  ${fmt(monto)}`);
}

await prisma.$disconnect();
