/**
 * ¿A qué clientes con el pedido LISTO nunca se les avisó?
 *
 * SOLO LEE. Pega contra la base de PRODUCCIÓN (`PROD_DATABASE_URL`).
 *
 * Un pedido listo dispara `pedido_listo_v3` (o `pedido_listo_saldo_v3` si
 * quedó saldo). Del 28/8 al 3/9/26 Meta rechazó envíos por un problema de pago
 * de la cuenta y esos avisos murieron en silencio: la ficha decía "enviado" y
 * el cliente nunca se enteró. Este check encuentra a los que quedaron colgados.
 *
 * OJO CON EL CRITERIO — la primera versión de este check preguntaba si EXISTÍA
 * el mensaje, y daba por avisado a quien tenía uno RECHAZADO. Bárbara Muñoz
 * aparecía como avisada con dos mensajes, y el del 3/9 estaba en FAILED: nunca
 * le llegó. Un mensaje solo cuenta si Meta confirmó que salió (SENT) o que
 * llegó (DELIVERED / READ). Al 7/9/26, 12 de 29 avisos estaban en FAILED: el
 * 41%. Preguntar por la existencia de la fila es exactamente el error que hizo
 * que nadie se enterara durante una semana.
 *
 * El saldo NO se calcula acá: sale de la misma consulta de pagos que usa el
 * sistema. Nunca es lista − cobrado (ver CLAUDE.md).
 *
 *   node scripts/checks/pedidos-listos-sin-aviso.check.mjs
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ datasourceUrl: process.env.PROD_DATABASE_URL });

const filas = await prisma.$queryRawUnsafe(`
  SELECT o.id,
         c.name  AS cliente,
         c.phone AS telefono,
         to_char(o."updatedAt" AT TIME ZONE 'America/Argentina/Cordoba','DD/MM/YY') AS listo_desde,
         (SELECT count(*)::int FROM "Payment" p WHERE p."orderId" = o.id) AS pagos,
         EXISTS (
           SELECT 1 FROM "WhatsAppMessage" m
             JOIN "WhatsAppChat" ch ON ch.id = m."chatId"
            WHERE ch."clientId" = c.id AND m."templateName" LIKE 'pedido_listo%'
              AND m.status IN ('SENT','DELIVERED','READ')
         ) AS aviso_wa,
         (SELECT count(*)::int FROM "WhatsAppMessage" m
            JOIN "WhatsAppChat" ch ON ch.id = m."chatId"
           WHERE ch."clientId" = c.id AND m."templateName" LIKE 'pedido_listo%'
             AND m.status = 'FAILED') AS rechazados,
         EXISTS (
           SELECT 1 FROM "Notification" n
            WHERE n."orderId" = o.id AND n.type = 'LAB_READY' AND n.status = 'PENDING'
         ) AS campanita_pendiente
    FROM "Order" o
    JOIN "Client" c ON c.id = o."clientId"
   WHERE o."isDeleted" = false AND o."labStatus" IN ('READY','FINISHED')
   ORDER BY o."updatedAt" DESC
`);
await prisma.$disconnect();

const sin = filas.filter(f => !f.aviso_wa);

console.log(`\nPedidos listos: ${filas.length} · con aviso: ${filas.length - sin.length} · SIN aviso: ${sin.length}\n`);

if (!sin.length) {
    console.log('✅ Todos los pedidos listos tienen su aviso.');
} else {
    console.log('HAY QUE CONTACTARLOS A MANO:');
    for (const f of sin) {
        console.log(`  · ${f.cliente || 'sin nombre'} — ${f.telefono || 'SIN TELÉFONO'}`);
        console.log(`      listo desde el ${f.listo_desde} · ${f.pagos} pago(s) registrado(s)`
            + `${f.rechazados ? ` · ${f.rechazados} aviso(s) RECHAZADO(S) por Meta` : ' · nunca se intentó'}`
            + `${f.campanita_pendiente ? ' · la campanita sigue encendida' : ''}`);
    }
    console.log('\n  El saldo exacto de cada uno se mira en la ficha: no se calcula acá');
    console.log('  porque el saldo NUNCA es lista − cobrado (ver CLAUDE.md).');
}
