const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const zeroOrders = await prisma.order.findMany({
    where: {
      OR: [
        { total: 0 },
        { subtotalWithMarkup: 0 }
      ],
      isDeleted: false
    },
    include: { items: true }
  });

  console.log(`Found ${zeroOrders.length} orders with zero totals.`);
  
  for (const order of zeroOrders) {
    if (order.items.length > 0) {
      const subtotal = order.items.reduce((s, i) => s + (Number(i.price) * i.quantity), 0);
      const markupVal = order.markup || 0;
      const subtotalWithMarkup = Math.round(subtotal * (1 + markupVal / 100));
      const total = Math.round(subtotalWithMarkup * (1 - (order.discountCash || 0) / 100));
      
      console.log(`Fixing Order ${order.id}: Subtotal ${subtotal} -> Total ${total}`);
      
      /* 
      await prisma.order.update({
        where: { id: order.id },
        data: { total, subtotalWithMarkup }
      });
      */
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
