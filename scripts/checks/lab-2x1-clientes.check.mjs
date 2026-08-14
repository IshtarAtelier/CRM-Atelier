// SOLO LECTURA — pega contra PROD_DATABASE_URL.
//
// Barre todas las ventas que llevan MÁS DE UN número de pedido de laboratorio
// (los 2x1: un solo par vendido, dos pedidos al lab) y las cruza con lo que el
// lab efectivamente facturó (LabCostEntry) para separar:
//
//   AMBOS      → el lab cobró los dos pedidos. Es el caso a reclamar.
//   UNO        → el lab cobró uno solo. No hay doble cobro.
//   NINGUNO    → todavía no llegó factura del lab por esos pedidos.
//   EXTRA      → a la venta le colgaron más números de los que dice su campo
//                (rehacer, garantía u otra venta mal imputada). Revisar a mano.
//
// Ojo con el campo `Order.labOrderNumber`: guarda los dos números en una sola
// cadena y con separadores irregulares ('80513681 - 80513687', '80536716- 80536720',
// '80491606 / 80491607'), por eso se parsea con regex y nunca por igualdad.
//
// Uso: node scripts/checks/lab-2x1-clientes.check.mjs
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const url = process.env.PROD_DATABASE_URL;
if (!url) throw new Error('Falta PROD_DATABASE_URL en el .env');
const prisma = new PrismaClient({ datasources: { db: { url } } });

const filas = await prisma.$queryRaw`
  SELECT o.id, c."name" AS cliente, o."labOrderNumber" AS campo,
         o."appliedPromoName" AS promo, o."isDeleted" AS borrada, o."labSentAt" AS enviada,
         -- número|neto|total|esReproceso por cada pedido facturado contra esta venta.
         -- El portal del lab marca REPROCESO al segundo pedido del par; eso queda
         -- escrito en las notas del scraper y es el único rastro que tenemos.
         string_agg(DISTINCT e."labOrderNumber" || '|' || coalesce(e."billedNet"::text, '') ||
                             '|' || coalesce(e."billedTotal"::text, '') ||
                             '|' || (case when e.notes ILIKE '%REPROCESO%' then 'R' else '' end), ',') AS facturados
  FROM "Order" o
  JOIN "Client" c ON c."id" = o."clientId"
  LEFT JOIN "LabCostEntry" e ON e."orderId" = o."id"
  WHERE o."labOrderNumber" ~ '[0-9]{5,}[^0-9]+[0-9]{5,}'
     OR o."id" IN (SELECT "orderId" FROM "LabCostEntry" WHERE "orderId" IS NOT NULL
                   GROUP BY "orderId" HAVING count(DISTINCT "labOrderNumber") > 1)
  GROUP BY o.id, c."name", o."labOrderNumber", o."appliedPromoName", o."isDeleted", o."labSentAt"
  ORDER BY o."labSentAt" DESC NULLS LAST`;

const nums = (s) => [...new Set((s || '').match(/\d{5,}/g) || [])];

// facturados llega como "num|neto|total,num|neto|total"
const montos = (s) => {
  const m = new Map();
  for (const t of (s || '').split(',').filter(Boolean)) {
    const [num, neto, total, rep] = t.split('|');
    m.set(num, { neto: neto ? Number(neto) : null, total: total ? Number(total) : null, reproceso: rep === 'R' });
  }
  return m;
};

// En el 2x1 el par bonificado igual paga la MANO DE OBRA (calibrado, teñido):
// se factura, pero por una fracción del par real. Si el menor no llega a la
// mitad del mayor, el 2x1 se respetó; si los dos montos son comparables, el
// lab cobró dos pares completos y ahí sí hay doble cobro.
const UMBRAL = 0.5;

const grupos = { DOBLE: [], SERVICIO: [], EXTRA: [], UNO: [], NINGUNO: [] };
for (const f of filas) {
  const pedidos = nums(f.campo);
  const cobros = montos(f.facturados);
  const facturados = [...cobros.keys()];
  const cobrados = pedidos.filter((n) => facturados.includes(n));
  const sobrantes = facturados.filter((n) => !pedidos.includes(n));
  const importes = cobrados.map((n) => cobros.get(n)?.neto).filter((v) => v != null && v > 0);
  const mayor = Math.max(...importes, 0);
  const menor = Math.min(...importes, Infinity);
  const ratio = importes.length >= 2 && mayor > 0 ? menor / mayor : null;

  const clave = sobrantes.length
    ? 'EXTRA'
    : cobrados.length < 2 || !importes.length
      ? cobrados.length === 1 || importes.length === 1
        ? 'UNO'
        : 'NINGUNO'
      : importes.length < 2
        ? 'UNO'
        : ratio >= UMBRAL
          ? 'DOBLE'
          : 'SERVICIO';
  grupos[clave].push({ ...f, pedidos, facturados, cobrados, sobrantes, cobros, ratio });
}

const fecha = (d) => (d ? d.toISOString().slice(0, 10) : '    -     ');
const plata = (n) => (n == null ? 's/d' : '$' + Math.round(n).toLocaleString('es-AR'));
// El neto es lo comparable contra el costo de lista del CRM; el total lleva IVA.
const conMonto = (n, cobros) => {
  const c = cobros.get(n);
  return (
    `${n} ${c ? `(${plata(c.neto)} neto · ${plata(c.total)} c/IVA)` : '(sin factura)'}` +
    (c?.reproceso ? ' [REPROCESO]' : '')
  );
};
const suma = (ns, cobros, campo) =>
  ns.reduce((a, n) => a + (cobros.get(n)?.[campo] ?? 0), 0);

const linea = (f) => {
  const lista = f.pedidos.length ? f.pedidos : ['(campo vacío)'];
  const cabeza = `  ${fecha(f.enviada)}  ${f.cliente.trim()}${f.borrada ? ' [BORRADA]' : ''}${f.promo ? `  [${f.promo.trim()}]` : ''}`;
  const detalle = lista.map((n) => `              ${conMonto(n, f.cobros)}`);
  for (const n of f.sobrantes) detalle.push(`              ${conMonto(n, f.cobros)}  ← fuera del campo de la venta`);
  const todos = [...f.pedidos, ...f.sobrantes];
  const tot =
    `              TOTAL facturado: ${plata(suma(todos, f.cobros, 'neto'))} neto · ${plata(suma(todos, f.cobros, 'total'))} c/IVA` +
    (f.ratio != null ? `   (el menor es el ${Math.round(f.ratio * 100)}% del mayor)` : '');
  return [cabeza, ...detalle, tot].join('\n');
};

const titulos = {
  DOBLE: 'DOBLE COBRO — los dos pedidos vinieron por importe comparable',
  SERVICIO: '2x1 respetado — el segundo pedido solo pagó mano de obra (calibrado/teñido)',
  EXTRA: 'REVISAR — el lab facturó números que no están en el campo de la venta',
  UNO: 'el lab facturó uno solo (sin doble cobro)',
  NINGUNO: 'sin factura del lab todavía',
};
for (const [k, v] of Object.entries(grupos)) {
  console.log(`\n=== ${titulos[k]}: ${v.length}`);
  for (const f of v) console.log(linea(f));
}
// Qué hay en juego: en el 2x1 el segundo pedido debería pagar solo mano de obra.
// La referencia de mano de obra es la mediana de lo que cobró el lab en los casos
// donde SÍ respetó el 2x1; el exceso es lo facturado de más por encima de eso.
const manoDeObra = grupos.SERVICIO.map((f) => Math.min(...f.cobrados.map((n) => f.cobros.get(n)?.neto ?? Infinity)))
  .filter((v) => Number.isFinite(v))
  .sort((a, b) => a - b);
const ref = manoDeObra.length ? manoDeObra[Math.floor(manoDeObra.length / 2)] : 0;
const exceso = grupos.DOBLE.reduce((a, f) => {
  const imp = f.cobrados.map((n) => f.cobros.get(n)?.neto ?? 0).sort((x, y) => y - x);
  return a + imp.slice(1).reduce((s, v) => s + Math.max(0, v - ref), 0);
}, 0);

console.log(`\nTotal ventas con más de un pedido de lab: ${filas.length}`);
console.log(`Mano de obra de referencia (mediana del 2x1 respetado): ${plata(ref)} neto`);
console.log(`Facturado de más en los ${grupos.DOBLE.length} casos de doble cobro: ${plata(exceso)} neto`);

await prisma.$disconnect();
