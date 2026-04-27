import { PrismaClient } from '@prisma/client';
import fs from 'fs';

// Load .env manually
const envFile = fs.readFileSync('.env', 'utf-8');
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL=')) {
    process.env.DATABASE_URL = trimmed.substring('DATABASE_URL='.length).replace(/^"|"$/g, '');
  }
}

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  AUDITORÍA EXACTA: Diferencia Recaudado vs Facturado`);
  console.log(`  Período: ${monthStart.toISOString().slice(0,10)} → HOY`);
  console.log(`${'='.repeat(70)}\n`);

  // ── A. TOTAL FACTURADO (como /api/dashboard) ──
  const salesThisMonth = await prisma.order.findMany({
    where: {
      orderType: 'SALE',
      isDeleted: false,
      createdAt: { gte: monthStart },
    },
    select: {
      id: true, total: true, subtotalWithMarkup: true, createdAt: true,
      client: { select: { name: true } },
      payments: { select: { amount: true, date: true, method: true } },
    },
  });
  const totalFacturado = salesThisMonth.reduce((acc, o) => acc + (o.total || o.subtotalWithMarkup || 0), 0);

  // ── B. TOTAL RECAUDADO (como /api/payments) ──
  const allPaymentsThisMonth = await prisma.payment.findMany({
    where: {
      date: { gte: monthStart },
      order: { isDeleted: false },
    },
    select: {
      id: true, amount: true, date: true, method: true, orderId: true,
      order: {
        select: {
          id: true, orderType: true, total: true, createdAt: true,
          client: { select: { name: true } },
        },
      },
    },
  });
  const totalRecaudado = allPaymentsThisMonth.reduce((acc, p) => acc + p.amount, 0);

  const diff = totalRecaudado - totalFacturado;

  console.log(`📊 TOTAL FACTURADO (Dashboard):  $${totalFacturado.toLocaleString('es-AR')}`);
  console.log(`💰 TOTAL RECAUDADO (Pagos):      $${totalRecaudado.toLocaleString('es-AR')}`);
  console.log(`📐 DIFERENCIA:                   $${diff.toLocaleString('es-AR')}`);
  console.log();

  // ── CLASIFICACIÓN DE PAGOS ──
  const paymentsOnQuotes = allPaymentsThisMonth.filter(p => p.order.orderType === 'QUOTE');
  const paymentsOnOldSales = allPaymentsThisMonth.filter(p => p.order.orderType === 'SALE' && p.order.createdAt < monthStart);
  const paymentsOnCurrentSales = allPaymentsThisMonth.filter(p => p.order.orderType === 'SALE' && p.order.createdAt >= monthStart);

  const sumQuotes = paymentsOnQuotes.reduce((a, p) => a + p.amount, 0);
  const sumOldSales = paymentsOnOldSales.reduce((a, p) => a + p.amount, 0);
  const sumCurrentSales = paymentsOnCurrentSales.reduce((a, p) => a + p.amount, 0);

  // ── DETALLE 1: Pagos de QUOTEs ──
  console.log(`${'─'.repeat(70)}`);
  console.log(`  🔶 PAGOS SOBRE PRESUPUESTOS (QUOTE) — SUMA AL RECAUDADO, NO AL FACTURADO`);
  console.log(`${'─'.repeat(70)}`);
  console.log(`  ${paymentsOnQuotes.length} pagos → $${sumQuotes.toLocaleString('es-AR')}`);
  paymentsOnQuotes.forEach(p => {
    console.log(`    • $${p.amount.toLocaleString('es-AR')} — ${p.order.client?.name || '?'} — ${p.method} — Quote creada: ${p.order.createdAt.toISOString().slice(0,10)} — Pago: ${p.date.toISOString().slice(0,10)}`);
  });
  console.log();

  // ── DETALLE 2: Pagos de ventas de otros meses ──
  console.log(`${'─'.repeat(70)}`);
  console.log(`  🔶 PAGOS SOBRE VENTAS DE MESES ANTERIORES — SUMA AL RECAUDADO, NO AL FACTURADO`);
  console.log(`${'─'.repeat(70)}`);
  console.log(`  ${paymentsOnOldSales.length} pagos → $${sumOldSales.toLocaleString('es-AR')}`);
  paymentsOnOldSales.forEach(p => {
    console.log(`    • $${p.amount.toLocaleString('es-AR')} — ${p.order.client?.name || '?'} — ${p.method} — Venta: ${p.order.createdAt.toISOString().slice(0,10)} — Pago: ${p.date.toISOString().slice(0,10)}`);
  });
  console.log();

  // ── DETALLE 3: Pagos de ventas de este mes ──
  console.log(`${'─'.repeat(70)}`);
  console.log(`  ✅ PAGOS SOBRE VENTAS DE ESTE MES — SUMA A AMBOS`);
  console.log(`${'─'.repeat(70)}`);
  console.log(`  ${paymentsOnCurrentSales.length} pagos → $${sumCurrentSales.toLocaleString('es-AR')}`);
  console.log();

  // ── DETALLE 4: Ventas facturadas sin cobrar / parcialmente cobradas ──
  // Esto explica la parte del facturado que NO está en recaudado
  let totalFacturadoNoCobrado = 0;
  const salesNotFullyPaid: any[] = [];
  for (const sale of salesThisMonth) {
    const totalPaidThisMonth = sale.payments
      .filter(p => p.date >= monthStart)
      .reduce((a, p) => a + p.amount, 0);
    const orderTotal = sale.total || sale.subtotalWithMarkup || 0;
    if (totalPaidThisMonth < orderTotal) {
      const gap = orderTotal - totalPaidThisMonth;
      totalFacturadoNoCobrado += gap;
      salesNotFullyPaid.push({
        name: sale.client?.name || '?',
        total: orderTotal,
        paid: totalPaidThisMonth,
        gap,
        date: sale.createdAt.toISOString().slice(0,10),
      });
    }
  }
  
  console.log(`${'─'.repeat(70)}`);
  console.log(`  🔴 VENTAS DE ESTE MES NO COBRADAS (TOTAL o PARCIAL) — SUMA AL FACTURADO, NO AL RECAUDADO`);
  console.log(`${'─'.repeat(70)}`);
  console.log(`  ${salesNotFullyPaid.length} ventas con saldo → $${totalFacturadoNoCobrado.toLocaleString('es-AR')}`);
  salesNotFullyPaid.forEach(s => {
    console.log(`    • ${s.name} — Total: $${s.total.toLocaleString('es-AR')} — Cobrado este mes: $${s.paid.toLocaleString('es-AR')} — Sin cobrar: $${s.gap.toLocaleString('es-AR')} — Creada: ${s.date}`);
  });
  console.log();

  // ── CONCILIACIÓN EXACTA ──
  // Recaudado = sumCurrentSales + sumOldSales + sumQuotes
  // Facturado = sumCurrentSales + (ventasNoCobradas)
  // Diff = Recaudado - Facturado
  //       = (sumCurrentSales + sumOldSales + sumQuotes) - (sumCurrentSales + totalFacturadoNoCobrado)
  //       =  sumOldSales + sumQuotes - totalFacturadoNoCobrado
  // Pero sumCurrentSales incluye solo los pagos de ventas del mes, 
  // y totalFacturado = sumCurrentSales + totalFacturadoNoCobrado
  // Entonces: Facturado = sumCurrentSales + totalFacturadoNoCobrado
  // Verificamos:
  const checkFacturado = sumCurrentSales + totalFacturadoNoCobrado;

  console.log(`${'='.repeat(70)}`);
  console.log(`  CONCILIACIÓN EXACTA`);
  console.log(`${'='.repeat(70)}`);
  console.log();
  console.log(`  Recaudado se compone de:`);
  console.log(`    Pagos de ventas este mes:       $${sumCurrentSales.toLocaleString('es-AR')}`);
  console.log(`    Pagos de ventas viejas:          $${sumOldSales.toLocaleString('es-AR')}`);
  console.log(`    Pagos sobre presupuestos:         $${sumQuotes.toLocaleString('es-AR')}`);
  console.log(`    ───────────────────────────────────────────`);
  console.log(`    TOTAL RECAUDADO:                 $${totalRecaudado.toLocaleString('es-AR')} ✓`);
  console.log();
  console.log(`  Facturado se compone de:`);
  console.log(`    Pagos cobrados de ventas del mes: $${sumCurrentSales.toLocaleString('es-AR')}`);
  console.log(`    Saldos pendientes del mes:        $${totalFacturadoNoCobrado.toLocaleString('es-AR')}`);
  console.log(`    ───────────────────────────────────────────`);
  console.log(`    CHECK:                            $${checkFacturado.toLocaleString('es-AR')} (real: $${totalFacturado.toLocaleString('es-AR')})`);
  console.log();
  console.log(`  DIFERENCIA = (+QUOTEs) + (+Ventas viejas) - (Saldos pendientes del mes)`);
  console.log(`             = $${sumQuotes.toLocaleString('es-AR')} + $${sumOldSales.toLocaleString('es-AR')} - $${totalFacturadoNoCobrado.toLocaleString('es-AR')}`);
  const calculatedDiff = sumQuotes + sumOldSales - totalFacturadoNoCobrado;
  console.log(`             = $${calculatedDiff.toLocaleString('es-AR')}`);
  console.log(`  (diferencia real: $${diff.toLocaleString('es-AR')})`);

  // Check for other order types
  const otherTypes = allPaymentsThisMonth.filter(p => p.order.orderType !== 'SALE' && p.order.orderType !== 'QUOTE');
  if (otherTypes.length > 0) {
    console.log(`\n  ⚠️ Pagos con orderType desconocido: ${otherTypes.length}`);
    otherTypes.forEach(p => console.log(`    • ${p.order.orderType} — $${p.amount}`));
  }

  // Residual check
  const residual = diff - calculatedDiff;
  if (Math.abs(residual) > 1) {
    console.log(`\n  ⚠️ RESIDUAL NO EXPLICADO: $${residual.toLocaleString('es-AR')}`);
    console.log(`  Esto puede deberse a pagos de ventas del mes donde el pago tiene fecha anterior al mes (edge case).`);
    
    // Check: payments on current month sales that have date BEFORE month start
    const earlyPayments = salesThisMonth.flatMap(o => 
      o.payments
        .filter(p => p.date < monthStart)
        .map(p => ({ ...p, clientName: o.client?.name, orderTotal: o.total }))
    );
    if (earlyPayments.length > 0) {
      console.log(`  Pagos con fecha anterior al mes, sobre ventas del mes:`);
      earlyPayments.forEach(p => {
        console.log(`    • $${p.amount.toLocaleString('es-AR')} — ${p.clientName} — Fecha pago: ${p.date.toISOString().slice(0,10)}`);
      });
    }
  }
  
  console.log();
  await prisma.$disconnect();
}

main().catch(err => { console.error('ERROR:', err); process.exit(1); });
