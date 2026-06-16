const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.client.findMany({
    where: { name: { contains: 'patoc', mode: 'insensitive' } },
    include: { whatsappChats: true }
}).then(c => console.log(JSON.stringify(c, null, 2))).catch(console.error).finally(() => prisma.$disconnect());
