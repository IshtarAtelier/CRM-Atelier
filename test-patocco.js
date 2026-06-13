const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findPatocco() {
    const clients = await prisma.client.findMany({
        where: {
            name: {
                contains: 'patoc',
                mode: 'insensitive'
            }
        },
        include: {
            whatsAppChats: { select: { id: true, createdAt: true, status: true, waId: true, realPhone: true } },
            orders: { select: { id: true, createdAt: true, status: true } }
        }
    });

    console.log(JSON.stringify(clients, null, 2));
    await prisma.$disconnect();
}

findPatocco().catch(console.error);
