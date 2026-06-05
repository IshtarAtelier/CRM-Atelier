import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Buscar TODAS las órdenes de Gaspar (activas y eliminadas)
  const client = await prisma.client.findFirst({
    where: { name: { contains: 'Corvalan', mode: 'insensitive' } },
    select: {
      id: true, name: true, createdAt: true, updatedAt: true,
      orders: {
        select: {
          id: true, orderType: true, total: true, subtotalWithMarkup: true,
          paid: true, isDeleted: true, createdAt: true, updatedAt: true,
          items: {
            select: {
              productNameSnapshot: true, price: true, quantity: true,
              product: { select: { name: true } }
            }
          },
          payments: {
            select: { amount: true, method: true, date: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!client) {
    console.log('Cliente no encontrado');
    return;
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  CLIENTE: ${client.name}`);
  console.log(`  ID: ${client.id}`);
  console.log(`═══════════════════════════════════════════\n`);

  for (const o of client.orders) {
    console.log(`  ┌─ ORDEN ${o.id}`);
    console.log(`  │  Tipo: ${o.orderType}`);
    console.log(`  │  Eliminada: ${o.isDeleted ? '🚨 SÍ' : '✅ No'}`);
    console.log(`  │  Creada: ${o.createdAt.toISOString()}`);
    console.log(`  │  Última modificación: ${o.updatedAt.toISOString()}`);
    console.log(`  │  Total: $${(o.total||0).toLocaleString()}`);
    console.log(`  │  SubtotalWithMarkup: $${(o.subtotalWithMarkup||0).toLocaleString()}`);
    console.log(`  │  Paid: $${(o.paid||0).toLocaleString()}`);
    console.log(`  │  Items:`);
    for (const item of o.items) {
      console.log(`  │    - ${item.product?.name || item.productNameSnapshot}: $${item.price.toLocaleString()} x${item.quantity}`);
    }
    console.log(`  │  Pagos:`);
    for (const p of o.payments) {
      console.log(`  │    💰 ${p.method}: $${p.amount.toLocaleString()} (${p.date ? new Date(p.date).toISOString().substring(0,10) : '?'})`);
    }
    console.log(`  └─────────────────────────────\n`);
  }

  // Buscar en audit log si existe
  try {
    const auditLogs = await (prisma as any).auditLog?.findMany?.({
      where: { entityId: { in: client.orders.map(o => o.id) } },
      orderBy: { createdAt: 'desc' }
    });
    if (auditLogs && auditLogs.length > 0) {
      console.log(`\n  AUDIT LOGS:`);
      for (const log of auditLogs) {
        console.log(`  ${log.createdAt.toISOString()} | ${log.action} | ${log.userId || 'SIN_USUARIO'} | ${log.details || ''}`);
      }
    }
  } catch (e) {
    console.log(`  ℹ️  No hay tabla de audit log en el sistema.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
