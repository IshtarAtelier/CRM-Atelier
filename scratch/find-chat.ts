import { prisma } from '../src/lib/db';

async function run() {
  const chats = await prisma.whatsAppChat.findMany({
    where: {
      OR: [
        { waId: { contains: '3525448504' } },
        { realPhone: { contains: '3525448504' } }
      ]
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' }
      },
      client: {
        include: {
          prescriptions: true,
          orders: true
        }
      }
    }
  });

  console.log('CHATS FOUND:', JSON.stringify(chats, null, 2));
}

run().catch(console.error).finally(async () => {
  await prisma.$disconnect();
});
