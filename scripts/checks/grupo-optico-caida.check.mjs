/**
 * QUÉ QUEDÓ SIN CRUZAR POR LA CAÍDA DE GRUPO ÓPTICO.
 *
 * SOLO LEE. Pega contra producción (`PROD_DATABASE_URL`).
 *
 * La integración con Grupo Óptico dejó de funcionar el 21/8/2026 (última
 * factura cargada) y el 24/8 (último estado de SmartLab). Desde entonces:
 * ningún pedido llega a 100%, no se crea la notificación LAB_READY que dispara
 * el aviso de "pedido listo", y no entra ningún costo para cruzar contra lo
 * facturado.
 *
 * Este check lista TODO lo que quedó en esa ventana, para poder reclamarlo o
 * cargarlo a mano. Optovision NO aparece: su circuito siguió sano.
 *
 *   node scripts/checks/grupo-optico-caida.check.mjs
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const INICIO = '2026-08-21';
const TZ = `AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Cordoba'`;
const prisma = new PrismaClient({ datasourceUrl: process.env.PROD_DATABASE_URL });
const money = (n) => '$' + Math.round(Number(n || 0)).toLocaleString('es-AR');

// ── 1. Pedidos mandados a fábrica en la ventana, sin ningún costo cargado ────
const pedidos = await prisma.$queryRawUnsafe(`
  SELECT o.id, c.name AS cliente,
         to_char(o."labSentAt" ${TZ},'DD/MM') AS enviado,
         coalesce(o."labStatus",'?') AS estado,
         coalesce(o."labOrderNumber",'—') AS nro_lab,
         o.total,
         EXISTS (SELECT 1 FROM "WhatsAppMessage" m
                   JOIN "WhatsAppChat" ch ON ch.id = m."chatId"
                  WHERE ch."clientId" = c.id AND m."templateName" LIKE 'pedido_listo%'
                    AND m.status IN ('SENT','DELIVERED','READ')) AS avisado
    FROM "Order" o JOIN "Client" c ON c.id = o."clientId"
   WHERE o."isDeleted" = false AND o."labSentAt" >= '${INICIO}'
     AND NOT EXISTS (SELECT 1 FROM "LabCostEntry" e WHERE e."orderId" = o.id)
   ORDER BY o."labSentAt"
`);

// ── 2. Facturas de Grupo Óptico sin pedido asociado ─────────────────────────
const huerfanas = await prisma.$queryRawUnsafe(`
  SELECT count(*)::int AS n, round(sum(coalesce("billedTotal",0))::numeric,0) AS total,
         to_char(min("invoiceDate") ${TZ},'DD/MM') AS desde,
         to_char(max("invoiceDate") ${TZ},'DD/MM') AS hasta
    FROM "LabCostEntry" WHERE lab='GRUPO_OPTICO' AND "orderId" IS NULL
`);

// ── 3. Estados congelados: siguen "en proceso" desde antes de la caída ───────
const congelados = await prisma.$queryRawUnsafe(`
  SELECT count(*)::int AS n, to_char(min(o."labSentAt") ${TZ},'DD/MM') AS mas_viejo
    FROM "Order" o
   WHERE o."isDeleted" = false AND o."labStatus" IN ('IN_PROGRESS','SENT')
`);

await prisma.$disconnect();

const porEstado = {};
for (const p of pedidos) porEstado[p.estado] = (porEstado[p.estado] || 0) + 1;
const sinAvisar = pedidos.filter(p => !p.avisado);

console.log(`\n═══ GRUPO ÓPTICO — lo que quedó sin cruzar desde el ${INICIO.slice(8)}/${INICIO.slice(5,7)} ═══\n`);

console.log(`PEDIDOS MANDADOS A FÁBRICA SIN COSTO CARGADO: ${pedidos.length}`);
console.log(`  Por estado: ${Object.entries(porEstado).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`  Facturado por el sistema: ${money(pedidos.reduce((t, p) => t + Number(p.total || 0), 0))}\n`);

for (const p of pedidos) {
    console.log(`  ${p.enviado}  ${String(p.cliente || '?').slice(0, 24).padEnd(26)} ${p.estado.padEnd(12)} lab ${String(p.nro_lab).padEnd(10)} ${money(p.total).padStart(12)}${p.avisado ? '' : '  ← sin avisar al cliente'}`);
}

const h = huerfanas[0];
console.log(`\nFACTURAS DE GRUPO ÓPTICO SIN PEDIDO ASOCIADO: ${h.n}`);
if (h.n > 0) console.log(`  ${money(h.total)} · del ${h.desde} al ${h.hasta}`);

console.log(`\nESTADOS CONGELADOS (siguen "en proceso"): ${congelados[0].n}`);
console.log(`  el más viejo se mandó el ${congelados[0].mas_viejo}`);

console.log(`\nDe los ${pedidos.length} pedidos, ${sinAvisar.length} nunca recibieron el aviso de "pedido listo".`);
console.log(`\nNada de esto se cruza solo hasta que el login de SmartLab vuelva a andar.\n`);
