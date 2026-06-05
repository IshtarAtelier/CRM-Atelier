import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const startMay = new Date(2026, 4, 1);
  const endMay = new Date(2026, 5, 0, 23, 59, 59, 999);

  // 1. TODAS las ventas de Mayo — sin excepción
  const allSalesMay = await prisma.order.findMany({
    where: {
      orderType: 'SALE',
      createdAt: { gte: startMay, lte: endMay }
    },
    select: {
      id: true, total: true, subtotalWithMarkup: true, paid: true, 
      createdAt: true, isDeleted: true,
      client: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const activas = allSalesMay.filter(o => !o.isDeleted);
  const eliminadas = allSalesMay.filter(o => o.isDeleted);

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  MAYO 2026 — VENTAS TOTALES`);
  console.log(`═══════════════════════════════════════════`);
  console.log(`  Total registros SALE en Mayo: ${allSalesMay.length}`);
  console.log(`  Activas (isDeleted=false): ${activas.length}`);
  console.log(`  Eliminadas (isDeleted=true): ${eliminadas.length}\n`);

  // 2. Sumar con order.total vs subtotalWithMarkup
  let sumaTotal = 0, sumaSubtotal = 0, sumaPaid = 0, sumaMayor = 0;
  for (const o of activas) {
    sumaTotal += o.total || 0;
    sumaSubtotal += o.subtotalWithMarkup || 0;
    sumaPaid += o.paid || 0;
    sumaMayor += Math.max(o.total || 0, o.subtotalWithMarkup || 0);
  }

  console.log(`  Suma usando order.total:              $${sumaTotal.toLocaleString()}`);
  console.log(`  Suma usando order.subtotalWithMarkup:  $${sumaSubtotal.toLocaleString()}`);
  console.log(`  Suma usando MAX(total, subtotal):      $${sumaMayor.toLocaleString()}`);
  console.log(`  Suma usando order.paid:                $${sumaPaid.toLocaleString()}`);
  console.log(`  Dashboard usa: total || subtotalWithMarkup || 0`);
  
  let sumaDashboard = 0;
  for (const o of activas) {
    sumaDashboard += o.total || o.subtotalWithMarkup || 0;
  }
  console.log(`  Suma con lógica dashboard:             $${sumaDashboard.toLocaleString()}\n`);

  // 3. Ahora sumar PAGOS REALES (payments) de Mayo
  const allPaymentsMay = await prisma.payment.findMany({
    where: {
      date: { gte: startMay, lte: endMay }
    },
    select: {
      id: true, amount: true, method: true, date: true,
      order: {
        select: {
          id: true, orderType: true, isDeleted: true, createdAt: true,
          client: { select: { name: true } }
        }
      }
    }
  });

  let totalPagosEnMayo = 0;
  for (const p of allPaymentsMay) {
    totalPagosEnMayo += p.amount || 0;
  }
  console.log(`═══════════════════════════════════════════`);
  console.log(`  PAGOS registrados CON FECHA en Mayo: ${allPaymentsMay.length}`);
  console.log(`  Suma de esos pagos: $${totalPagosEnMayo.toLocaleString()}`);
  console.log(`═══════════════════════════════════════════\n`);

  // 4. Pagos de ventas de mayo vs pagos de ventas de OTROS meses
  let pagosDeVentasMayo = 0, pagosDeVentasOtrosMeses = 0;
  for (const p of allPaymentsMay) {
    const orderDate = p.order?.createdAt;
    if (orderDate && orderDate >= startMay && orderDate <= endMay) {
      pagosDeVentasMayo += p.amount;
    } else {
      pagosDeVentasOtrosMeses += p.amount;
    }
  }
  console.log(`  De esos pagos:`);
  console.log(`    - De ventas creadas EN Mayo: $${pagosDeVentasMayo.toLocaleString()}`);
  console.log(`    - De ventas de OTROS meses: $${pagosDeVentasOtrosMeses.toLocaleString()}\n`);

  // 5. Detalle pedido por pedido
  console.log(`═══════════════════════════════════════════`);
  console.log(`  DETALLE POR PEDIDO (Activos)`);
  console.log(`═══════════════════════════════════════════\n`);
  
  for (const o of activas) {
    const f = o.total || o.subtotalWithMarkup || 0;
    const diff = (o.total || 0) !== (o.subtotalWithMarkup || 0);
    console.log(`  ${o.createdAt.toISOString().substring(0,10)} | ${(o.client?.name || '???').padEnd(35)} | total=$${(o.total||0).toLocaleString().padStart(10)} | subtotal=$${(o.subtotalWithMarkup||0).toLocaleString().padStart(10)} | paid=$${(o.paid||0).toLocaleString().padStart(10)} ${diff ? '⚠️ DIFF' : ''}`);
  }

  // 6. Eliminadas
  if (eliminadas.length > 0) {
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`  VENTAS ELIMINADAS EN MAYO`);
    console.log(`═══════════════════════════════════════════\n`);
    let sumaEliminadas = 0;
    for (const o of eliminadas) {
      const f = o.total || o.subtotalWithMarkup || 0;
      sumaEliminadas += f;
      console.log(`  ${o.createdAt.toISOString().substring(0,10)} | ${(o.client?.name || '???').padEnd(35)} | $${f.toLocaleString()} | ELIMINADA`);
    }
    console.log(`\n  Total eliminadas: $${sumaEliminadas.toLocaleString()}`);
    console.log(`  Total activas + eliminadas: $${(sumaDashboard + sumaEliminadas).toLocaleString()}`);
  }

  // 7. Verificar QUOTES de mayo también
  const quotesMay = await prisma.order.findMany({
    where: {
      orderType: 'QUOTE',
      isDeleted: false,
      createdAt: { gte: startMay, lte: endMay }
    },
    select: {
      id: true, total: true, subtotalWithMarkup: true,
      client: { select: { name: true } }
    }
  });
  let sumaQuotes = 0;
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  PRESUPUESTOS (QUOTES) DE MAYO: ${quotesMay.length}`);
  console.log(`═══════════════════════════════════════════\n`);
  for (const q of quotesMay) {
    const f = q.total || q.subtotalWithMarkup || 0;
    sumaQuotes += f;
    console.log(`  ${(q.client?.name || '???').padEnd(35)} | $${f.toLocaleString()}`);
  }
  console.log(`\n  Total Presupuestos: $${sumaQuotes.toLocaleString()}`);
  console.log(`  Ventas + Presupuestos: $${(sumaDashboard + sumaQuotes).toLocaleString()}\n`);

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  RESUMEN FINAL`);
  console.log(`═══════════════════════════════════════════`);
  console.log(`  Ventas activas (lógica dashboard):  $${sumaDashboard.toLocaleString()}`);
  console.log(`  + Ventas eliminadas:                $${eliminadas.reduce((a,o) => a + (o.total||o.subtotalWithMarkup||0), 0).toLocaleString()}`);
  console.log(`  + Presupuestos:                     $${sumaQuotes.toLocaleString()}`);
  console.log(`  = TOTAL ABSOLUTO:                   $${(sumaDashboard + eliminadas.reduce((a,o) => a + (o.total||o.subtotalWithMarkup||0), 0) + sumaQuotes).toLocaleString()}`);
  console.log(`  Pagos reales en Mayo:               $${totalPagosEnMayo.toLocaleString()}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
