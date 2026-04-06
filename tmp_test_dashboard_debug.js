const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Testing dashboard API logic...');
    
    const now = new Date();
    const dateFilter = {
      gte: new Date(now.getFullYear(), now.getMonth(), 1)
    };

    console.log('1. Fetching currentMonthOrders...');
    const currentMonthOrders = await prisma.order.findMany({
      where: {
        createdAt: dateFilter,
        orderType: 'SALE',
        isDeleted: false,
      },
      include: {
        items: { include: { product: true } },
        tags: true,
      },
    });
    console.log('   Found:', currentMonthOrders.length);

    console.log('2. Fetching allOrders...');
    const allOrders = await prisma.order.findMany({
      where: { orderType: 'SALE', isDeleted: false },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    console.log('   Found:', allOrders.length);

    console.log('3. Fetching openQuotes...');
    const openQuotes = await prisma.order.findMany({
      where: {
        createdAt: dateFilter,
        orderType: 'QUOTE',
        isDeleted: false,
      },
      select: { total: true }
    });
    console.log('   Found:', openQuotes.length);

    console.log('4. Suggested Follow-ups...');
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 7);
    
    const suggestedFollowUps = await prisma.order.findMany({
      where: {
        orderType: 'QUOTE',
        isDeleted: false,
        createdAt: { lte: twoDaysAgo, gte: fiveDaysAgo },
        OR: [
          { client: { interest: { contains: 'Multifocal' } } },
          { items: { some: { product: { type: { contains: 'Multifocal' } } } } },
          { items: { some: { product: { category: 'LENS' } } } }
        ]
      },
      include: {
        client: true,
        items: { include: { product: true } }
      },
      take: 5
    });
    console.log('   Found:', suggestedFollowUps.length);

    console.log('5. Funnel...');
    const contactsCreated = await prisma.client.count({ where: { createdAt: dateFilter } });
    console.log('   Contacts:', contactsCreated);

    console.log('6. Targets...');
    try {
      // Trying to see if this crashes
      const targetMonth = now.getMonth() + 1;
      const targetYear = now.getFullYear();
      const targets = await prisma.monthlyTarget.findUnique({
        where: { month_year: { month: targetMonth, year: targetYear } }
      });
      console.log('   Targets:', targets);
    } catch (e) {
      console.error('   Targets failed:', e.message);
    }

    console.log('Success!');
  } catch (error) {
    console.error('FAILED:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
