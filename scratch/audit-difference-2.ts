import { PrismaClient } from '@prisma/client';
import fs from 'fs';

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

  // 1. Facturado
  const salesThisMonth = await prisma.order.findMany({
    where: { orderType: 'SALE', isDeleted: false, createdAt: { gte: monthStart } },
    select: { id: true, total: true, subtotalWithMarkup: true, createdAt: true, client: { select: { name: true } } },
  });

  // 2. Recaudado
  const paymentsThisMonth = await prisma.payment.findMany({
    where: { date: { gte: monthStart }, order: { isDeleted: false } },
    select: { id: true, amount: true, date: true, method: true, orderId: true, order: { select: { orderType: true, total: true, subtotalWithMarkup: true, createdAt: true, client: { select: { name: true } } } } },
  });

  let facturado = 0;
  salesThisMonth.forEach(s => facturado += (s.total || s.subtotalWithMarkup || 0));

  let recaudado = 0;
  paymentsThisMonth.forEach(p => recaudado += p.amount);

  console.log(`Facturado: $${facturado}`);
  console.log(`Recaudado: $${recaudado}`);
  console.log(`Diferencia Real (Recaudado - Facturado): $${recaudado - facturado}`);
  console.log('--------------------------------------------------');

  let recaudado_explicado_por_quotes = 0;
  let recaudado_explicado_por_ventas_viejas = 0;
  let recaudado_explicado_por_ventas_nuevas = 0;

  paymentsThisMonth.forEach(p => {
    if (p.order.orderType === 'QUOTE') {
      recaudado_explicado_por_quotes += p.amount;
      console.log(`[PAGO EN QUOTE] +$${p.amount} | Cliente: ${p.order.client?.name} | Fecha Quote: ${p.order.createdAt.toISOString().slice(0, 10)}`);
    } else if (p.order.orderType === 'SALE' && p.order.createdAt < monthStart) {
      recaudado_explicado_por_ventas_viejas += p.amount;
      console.log(`[PAGO EN VENTA VIEJA] +$${p.amount} | Cliente: ${p.order.client?.name} | Fecha Venta: ${p.order.createdAt.toISOString().slice(0, 10)}`);
    } else if (p.order.orderType === 'SALE' && p.order.createdAt >= monthStart) {
      recaudado_explicado_por_ventas_nuevas += p.amount;
    } else {
      console.log(`[PAGO OTRO TIPO] +$${p.amount} | Tipo: ${p.order.orderType}`);
    }
  });

  console.log(`\n--- Desglose del Recaudado ---`);
  console.log(`En Quotes: $${recaudado_explicado_por_quotes}`);
  console.log(`En Ventas Viejas: $${recaudado_explicado_por_ventas_viejas}`);
  console.log(`En Ventas del Mes: $${recaudado_explicado_por_ventas_nuevas}`);
  console.log(`Suma (debe ser igual a Recaudado): $${recaudado_explicado_por_quotes + recaudado_explicado_por_ventas_viejas + recaudado_explicado_por_ventas_nuevas}`);

  console.log('\n--------------------------------------------------');

  // We need to compare "Ventas del Mes" with "Facturado"
  // Facturado is the TOTAL price of all sales this month.
  // "En Ventas del Mes" is the sum of payments made THIS MONTH towards those sales.
  // Facturado - En Ventas del Mes = Lo que falta cobrar de las ventas de este mes (si no hay pagos viejos hacia ventas de este mes).

  let facturado_no_cobrado_este_mes = 0;
  let ventas_con_sobrepago = 0;
  let ventas_detalles = [];

  // Let's get payments made BEFORE this month for sales created THIS month (edge case)
  // Or just sum all payments for the sales of this month to see the balance.
  const allPaymentsForSalesThisMonth = await prisma.payment.findMany({
    where: { orderId: { in: salesThisMonth.map(s => s.id) } }
  });

  salesThisMonth.forEach(sale => {
    const totalVenta = sale.total || sale.subtotalWithMarkup || 0;
    const pagosEsteMes = paymentsThisMonth.filter(p => p.orderId === sale.id).reduce((a, b) => a + b.amount, 0);
    const pagosAntesEsteMes = allPaymentsForSalesThisMonth.filter(p => p.orderId === sale.id && p.date < monthStart).reduce((a, b) => a + b.amount, 0);
    
    if (totalVenta > pagosEsteMes + pagosAntesEsteMes) {
      facturado_no_cobrado_este_mes += (totalVenta - (pagosEsteMes + pagosAntesEsteMes));
      ventas_detalles.push(`[FALTA COBRAR] Venta a ${sale.client?.name} por $${totalVenta}. Pagos este mes: $${pagosEsteMes}. Pagos previos: $${pagosAntesEsteMes}. Falta: $${totalVenta - (pagosEsteMes + pagosAntesEsteMes)}`);
    } else if (totalVenta < pagosEsteMes + pagosAntesEsteMes) {
      ventas_con_sobrepago += ((pagosEsteMes + pagosAntesEsteMes) - totalVenta);
      ventas_detalles.push(`[SOBREPAGO / DIFERENCIA] Venta a ${sale.client?.name} por $${totalVenta}. Pagos este mes: $${pagosEsteMes}. Pagos previos: $${pagosAntesEsteMes}. Exceso de pago: $${(pagosEsteMes + pagosAntesEsteMes) - totalVenta}`);
    }
  });

  console.log(`\n--- Desglose del Facturado vs Pagos de esas ventas ---`);
  console.log(`Falta cobrar de las ventas del mes: $${facturado_no_cobrado_este_mes}`);
  console.log(`Exceso de pago en ventas del mes: $${ventas_con_sobrepago}`);
  ventas_detalles.forEach(d => console.log(d));

  console.log('\n--- Calculo Final Exacto ---');
  console.log(`Recaudado = Pagos en Quotes ($${recaudado_explicado_por_quotes}) + Pagos en Ventas Viejas ($${recaudado_explicado_por_ventas_viejas}) + Pagos en Ventas Nuevas ($${recaudado_explicado_por_ventas_nuevas})`);
  console.log(`Facturado = Pagos en Ventas Nuevas ($${recaudado_explicado_por_ventas_nuevas}) + Falta cobrar ($${facturado_no_cobrado_este_mes}) - Exceso de pago ($${ventas_con_sobrepago}) + Pagos Anteriores al mes ($${allPaymentsForSalesThisMonth.filter(p => p.date < monthStart).reduce((a,b)=>a+b.amount,0)})`);
  
  console.log(`\nDiferencia = Recaudado - Facturado`);
  console.log(`Diferencia = ($${recaudado_explicado_por_quotes} + $${recaudado_explicado_por_ventas_viejas}) - $${facturado_no_cobrado_este_mes} + $${ventas_con_sobrepago} - Pagos previos al mes`);
  
  const diff_calculada = (recaudado_explicado_por_quotes + recaudado_explicado_por_ventas_viejas) - facturado_no_cobrado_este_mes + ventas_con_sobrepago - allPaymentsForSalesThisMonth.filter(p => p.date < monthStart).reduce((a,b)=>a+b.amount,0);
  console.log(`Diferencia Calculada: $${diff_calculada}`);
  console.log(`Coincide con la realidad: ${diff_calculada === (recaudado - facturado) ? 'SÍ' : 'NO'}`);

  await prisma.$disconnect();
}

main().catch(console.error);
