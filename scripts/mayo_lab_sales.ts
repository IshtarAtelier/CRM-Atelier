import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL }
  }
});

async function main() {
  const startMay = new Date(2026, 4, 1); // May 1, 2026
  const endMay = new Date(2026, 4, 31, 23, 59, 59, 999); // May 31, 2026

  // Get ALL sales (SALE type) from May - these are the "ventas laboratorio"
  const sales = await prisma.order.findMany({
    where: {
      orderType: 'SALE',
      isDeleted: false,
      createdAt: { gte: startMay, lte: endMay }
    },
    select: {
      id: true,
      total: true,
      subtotalWithMarkup: true,
      paid: true,
      createdAt: true,
      labStatus: true,
      labOrderNumber: true,
      labColor: true,
      labTreatment: true,
      discount: true,
      discountCash: true,
      markup: true,
      specialDiscount: true,
      client: { select: { name: true, phone: true } },
      user: { select: { name: true } },
      items: {
        select: {
          price: true,
          quantity: true,
          productNameSnapshot: true,
          productBrandSnapshot: true,
          productCategorySnapshot: true,
          product: { select: { name: true, brand: true, category: true, laboratory: true } }
        }
      },
      payments: {
        select: { amount: true, method: true, date: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`\n═══════════════════════════════════════════════════════════════════════`);
  console.log(`  VENTAS LABORATORIO — MAYO 2026`);
  console.log(`  Total encontradas: ${sales.length}`);
  console.log(`═══════════════════════════════════════════════════════════════════════\n`);

  // Print as JSON for easy processing
  const rows = sales.map((o, idx) => {
    const totalVenta = o.total || o.subtotalWithMarkup || 0;
    const totalPagado = o.payments.reduce((s, p) => s + p.amount, 0);
    const saldo = totalVenta - totalPagado;
    
    // Get lens info
    const cristales = o.items.filter(i => 
      i.product?.category === 'Cristal' || i.productCategorySnapshot === 'Cristal'
    );
    const armazones = o.items.filter(i => 
      i.product?.category === 'FRAME' || i.productCategorySnapshot === 'FRAME' ||
      i.product?.category === 'SUNGLASS' || i.productCategorySnapshot === 'SUNGLASS' ||
      i.product?.category === 'ATELIER' || i.productCategorySnapshot === 'ATELIER'
    );
    
    const lensInfo = cristales.map(c => 
      `${c.product?.brand || c.productBrandSnapshot || ''} ${c.product?.name || c.productNameSnapshot || ''}`.trim()
    ).join(' + ') || 'N/A';
    
    const frameInfo = armazones.map(a =>
      `${a.product?.brand || a.productBrandSnapshot || ''} ${a.product?.name || a.productNameSnapshot || ''}`.trim()
    ).join(' + ') || 'N/A';
    
    const lab = cristales.find(c => c.product?.laboratory)?.product?.laboratory || 'N/A';
    
    const paymentMethods = o.payments.map(p => p.method).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'Sin pagos';
    
    return {
      '#': idx + 1,
      fecha: o.createdAt.toISOString().substring(0, 10),
      cliente: o.client?.name || '???',
      cristal: lensInfo,
      armazon: frameInfo,
      laboratorio: lab,
      tratamiento: o.labTreatment || '-',
      color: o.labColor || '-',
      estadoLab: o.labStatus || 'NONE',
      nroLab: o.labOrderNumber || '-',
      total: totalVenta,
      pagado: totalPagado,
      saldo: saldo,
      vendedor: o.user?.name || '-',
      medioPago: paymentMethods,
      descuento: o.discountCash || o.discount || 0,
    };
  });

  // Print table
  console.log(`${'#'.padStart(3)} | ${'FECHA'.padEnd(10)} | ${'CLIENTE'.padEnd(30)} | ${'CRISTAL'.padEnd(40)} | ${'LAB'.padEnd(15)} | ${'TOTAL'.padStart(12)} | ${'PAGADO'.padStart(12)} | ${'SALDO'.padStart(12)} | ${'ESTADO'.padEnd(12)} | ${'VENDEDOR'.padEnd(12)}`);
  console.log('─'.repeat(200));
  
  let grandTotal = 0;
  let grandPagado = 0;
  
  for (const r of rows) {
    grandTotal += r.total;
    grandPagado += r.pagado;
    console.log(
      `${String(r['#']).padStart(3)} | ${r.fecha.padEnd(10)} | ${r.cliente.padEnd(30).substring(0, 30)} | ${r.cristal.padEnd(40).substring(0, 40)} | ${r.laboratorio.padEnd(15).substring(0, 15)} | $${r.total.toLocaleString().padStart(10)} | $${r.pagado.toLocaleString().padStart(10)} | $${r.saldo.toLocaleString().padStart(10)} | ${r.estadoLab.padEnd(12)} | ${r.vendedor.padEnd(12)}`
    );
  }
  
  console.log('─'.repeat(200));
  console.log(`${''.padStart(3)} | ${''.padEnd(10)} | ${'TOTALES'.padEnd(30)} | ${''.padEnd(40)} | ${''.padEnd(15)} | $${grandTotal.toLocaleString().padStart(10)} | $${grandPagado.toLocaleString().padStart(10)} | $${(grandTotal - grandPagado).toLocaleString().padStart(10)} | ${''.padEnd(12)} | `);
  
  console.log(`\n\nJSON DATA:\n`);
  console.log(JSON.stringify(rows, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
