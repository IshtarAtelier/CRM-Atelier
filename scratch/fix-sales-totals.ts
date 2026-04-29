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
  console.log("Starting fix script...");

  // 1. Fix Juan Mario Allasino
  const saleJuan = await prisma.order.findUnique({ where: { id: "cmntf1xqi000rd87gnd94275o" } });
  const quoteJuan = await prisma.order.findUnique({ where: { id: "cmnrz2jrb002mpp7tip94oqan" } });
  const paymentJuan = await prisma.payment.findUnique({ where: { id: "cmnrz53nv0030pp7t92sc53nr" } });

  if (saleJuan && quoteJuan && paymentJuan) {
    console.log(`Fixing Juan Mario Allasino...`);
    // Move payment to SALE
    await prisma.payment.update({
      where: { id: paymentJuan.id },
      data: { orderId: saleJuan.id }
    });
    // Update SALE total and paid
    await prisma.order.update({
      where: { id: saleJuan.id },
      data: { total: 830000, paid: 830000, subtotalWithMarkup: 830000 }
    });
    // Reset QUOTE paid
    await prisma.order.update({
      where: { id: quoteJuan.id },
      data: { paid: 0 }
    });
    console.log(`✅ Fixed Juan Mario Allasino`);
  }

  // 2. Fix other overpaid sales
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const salesThisMonth = await prisma.order.findMany({
    where: { orderType: 'SALE', isDeleted: false, createdAt: { gte: monthStart } },
    include: { payments: true, client: true }
  });

  for (const sale of salesThisMonth) {
    if (sale.id === "cmntf1xqi000rd87gnd94275o") continue; // Already fixed Juan

    const totalPagos = sale.payments.reduce((a, p) => a + p.amount, 0);
    const orderTotal = sale.total || sale.subtotalWithMarkup || 0;

    if (totalPagos > orderTotal) {
      console.log(`Fixing overpayment for ${sale.client?.name}...`);
      console.log(`  Current Total: ${orderTotal} | Payments: ${totalPagos}`);
      
      await prisma.order.update({
        where: { id: sale.id },
        data: {
          total: totalPagos,
          paid: totalPagos,
          subtotalWithMarkup: totalPagos
        }
      });
      console.log(`✅ Fixed ${sale.client?.name} (New total: ${totalPagos})`);
    }
  }

  console.log("All fixes applied successfully.");
  await prisma.$disconnect();
}

main().catch(console.error);
