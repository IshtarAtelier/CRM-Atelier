const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 7);

    const results = await prisma.order.findMany({
        where: {
            orderType: 'QUOTE',
            isDeleted: false,
            createdAt: { lte: twoDaysAgo, gte: fiveDaysAgo },
            client: {
                orders: {
                    none: {
                        orderType: 'SALE',
                        isDeleted: false
                    }
                }
            },
            OR: [
                { client: { interest: { contains: 'Multifocal' } } },
                { items: { some: { product: { type: { contains: 'Multifocal' } } } } },
                { items: { some: { product: { category: 'LENS' } } } }
            ]
        },
        include: {
            client: true
        }
    });

    console.log('Suggested follow-ups counts:', results.length);
    results.forEach(r => console.log(`- ${r.client.name} (ID: ${r.id})`));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
