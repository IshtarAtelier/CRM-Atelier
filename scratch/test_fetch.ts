import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Fetching contacts...");
    const contacts = await prisma.client.findMany({ take: 1 });
    console.log("Contact found:", contacts[0]?.id);
    
    // Simulate what ContactService handles
    const contact = await prisma.client.findUnique({
        where: { id: contacts[0]?.id },
        include: {
            interactions: { orderBy: { createdAt: 'desc' } },
            prescriptions: { orderBy: { date: 'desc' } },
            tasks: { orderBy: { createdAt: 'desc' } },
            orders: {
                where: { isDeleted: false },
                orderBy: { createdAt: 'desc' },
                include: { 
                    payments: true,
                    items: { include: { product: true } }
                }
            },
            tags: true,
            whatsappChats: { include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } } }
        }
    });

    console.log("Fetch success");
}

main().catch(console.error).finally(() => prisma.$disconnect());
