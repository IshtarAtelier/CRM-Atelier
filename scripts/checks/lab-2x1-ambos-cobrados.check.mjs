// SOLO LECTURA — pega contra PROD_DATABASE_URL.
//
// La lista para reclamarle al laboratorio: todas las ventas de 2x1 donde el lab
// facturó LOS DOS pedidos, sin importar por cuánto. Marca aparte cuáles vinieron
// los dos a precio de par completo ([DOBLE COBRO], el menor es >=50% del mayor) y
// cuáles respetaron el 2x1 cobrando solo mano de obra en el segundo.
//
// El segundo pedido del par entra al portal del lab marcado REPROCESO (®); ahí
// debería facturarse solo el calibrado/teñido, no el cristal de nuevo.
//
// Uso: node scripts/checks/lab-2x1-ambos-cobrados.check.mjs
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

if (!process.env.PROD_DATABASE_URL) throw new Error('Falta PROD_DATABASE_URL en el .env');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });

// Orden pedido por el usuario: primero sus 12, después el resto de los doble cobro.
const PRIMEROS = ['80513687','80525166','80510210','80525843','80499730','80499715',
                  '80536028','80535525','80535514','80535481','80535469','80530914'];

const filas = await prisma.$queryRaw`
  SELECT o.id, c."name" AS cliente, o."labOrderNumber" AS campo, o."labSentAt" AS enviada,
         string_agg(DISTINCT e."labOrderNumber" || '|' || coalesce(e."billedNet"::text,'') || '|' ||
                    coalesce(e."billedTotal"::text,'') || '|' ||
                    (case when e.notes ILIKE '%REPROCESO%' then 'R' else '' end), ',') AS fact
  FROM "Order" o JOIN "Client" c ON c."id" = o."clientId"
  LEFT JOIN "LabCostEntry" e ON e."orderId" = o."id"
  WHERE (o."labOrderNumber" ~ '[0-9]{5,}[^0-9]+[0-9]{5,}'
     OR o."id" IN (SELECT "orderId" FROM "LabCostEntry" WHERE "orderId" IS NOT NULL
                   GROUP BY "orderId" HAVING count(DISTINCT "labOrderNumber") > 1))
    AND o."isDeleted" = false
  GROUP BY o.id, c."name", o."labOrderNumber", o."labSentAt"
  ORDER BY o."labSentAt" DESC NULLS LAST`;

const nums = (s) => [...new Set((s || '').match(/\d{5,}/g) || [])];
const montos = (s) => new Map((s || '').split(',').filter(Boolean).map((t) => {
  const [n, neto, total, r] = t.split('|');
  return [n, { neto: neto ? Number(neto) : null, total: total ? Number(total) : null, rep: r === 'R' }];
}));

const casos = filas.map((f) => {
  const pedidos = nums(f.campo);
  const cobros = montos(f.fact);
  const todos = [...new Set([...pedidos, ...cobros.keys()])];
  const imp = todos.map((n) => cobros.get(n)?.neto).filter((v) => v != null && v > 0).sort((a, b) => b - a);
  const ratio = imp.length >= 2 ? imp[1] / imp[0] : null;
  return { ...f, todos, cobros, imp, ratio, extra: [...cobros.keys()].filter((n) => !pedidos.includes(n)) };
});

const esDoble = (c) => c.ratio != null && c.ratio >= 0.5;
const idx = (c) => PRIMEROS.findIndex((p) => c.todos.includes(p));
const mios = PRIMEROS.map((p) => casos.find((c) => c.todos.includes(p))).filter(Boolean);
// Criterio del usuario: alcanza con que los DOS números tengan cobro, sin importar
// que el segundo venga por un importe mínimo.
const resto = casos.filter((c) => idx(c) === -1 && c.imp.length >= 2);
const lista = [...new Set([...mios, ...resto])];

const plata = (n) => (n == null ? 's/d' : '$' + Math.round(n).toLocaleString('es-AR'));
const REF = 3724; // mano de obra de referencia (mediana del 2x1 respetado)

let totalExceso = 0;
lista.forEach((c, i) => {
  const dobles = esDoble(c);
  const exceso = dobles ? c.imp.slice(1).reduce((a, v) => a + Math.max(0, v - REF), 0) : 0;
  totalExceso += exceso;
  const estado = c.imp.length < 2 ? 'SIN DATOS DE FACTURA' : dobles ? 'DOBLE COBRO' : '2x1 respetado';
  console.log(`${String(i + 1).padStart(2)}) ${c.todos.join(' - ')}   ${c.cliente.trim()}   [${estado}]`);
  for (const n of c.todos) {
    const m = c.cobros.get(n);
    console.log(`      ${n}  ${m ? plata(m.neto) : 'sin factura'}${m?.rep ? '  [REPROCESO]' : ''}${c.extra.includes(n) ? '  ← fuera del campo de la venta' : ''}`);
  }
  console.log(`      total facturado ${plata(c.imp.reduce((a, v) => a + v, 0))}` + (exceso ? `   ·   cobrado de más ${plata(exceso)}` : ''));
});
console.log(`\nCasos en la lista: ${lista.length}`);
console.log(`Cobrado de más (solo los marcados DOBLE COBRO): ${plata(totalExceso)} neto`);
await prisma.$disconnect();
