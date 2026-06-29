const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== Auditing Month Sales Calculations ===");

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  console.log(`Start of month date (UTC): ${startOfMonth.toISOString()}`);

  // Fetch all orders matching the dashboard criteria for this month
  const orders = await prisma.order.findMany({
    where: {
      orderType: 'SALE',
      isDeleted: false,
      OR: [
        { labSentAt: { gte: startOfMonth } },
        {
          AND: [
            { labSentAt: null },
            { createdAt: { gte: startOfMonth } }
          ]
        }
      ]
    },
    select: {
      id: true,
      total: true,
      subtotalWithMarkup: true,
      createdAt: true,
      labSentAt: true,
      client: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  console.log(`\nFound ${orders.length} active sales in the database for the current month.`);

  // Check for duplicate order IDs
  const orderIds = orders.map(o => o.id);
  const uniqueOrderIds = new Set(orderIds);
  console.log(`- Unique Order IDs check: ${orderIds.length === uniqueOrderIds.size ? "OK (No duplicates)" : "WARNING: Duplicates found!"}`);
  if (orderIds.length !== uniqueOrderIds.size) {
    const counts = {};
    orderIds.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    Object.entries(counts).forEach(([id, c]) => {
      if (c > 1) console.log(`  * Duplicate Order ID: ${id} (occurs ${c} times)`);
    });
  }

  // Calculate total sales sum
  let calculatedTotal = 0;
  orders.forEach((o, index) => {
    const price = o.subtotalWithMarkup || o.total || 0;
    calculatedTotal += price;
    console.log(`[${index + 1}] Order: ${o.id.substring(0,8)} | Client: "${o.client?.name || 'Unknown'}" | Created: ${o.createdAt.toISOString().split('T')[0]} | LabSent: ${o.labSentAt ? o.labSentAt.toISOString().split('T')[0] : 'None'} | Value: $${price.toLocaleString()}`);
  });

  console.log(`\nTotal Sales Calculated: $${calculatedTotal.toLocaleString()}`);

  // Check if any order is registered both as QUOTE and SALE under the same ID
  const quoteWithSaleIds = await prisma.order.findMany({
    where: {
      id: { in: orderIds },
      orderType: 'QUOTE'
    }
  });
  console.log(`- Overlapping QUOTE/SALE IDs check: ${quoteWithSaleIds.length === 0 ? "OK (No overlap)" : "WARNING: Order exists as both quote and sale!"}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
