const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const chats = await prisma.whatsAppChat.findMany({
    orderBy: { lastMessageAt: 'desc' },
    take: 5,
    select: { profileName: true, lastMessageAt: true, clientId: true }
  });
  console.log(JSON.stringify(chats, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
