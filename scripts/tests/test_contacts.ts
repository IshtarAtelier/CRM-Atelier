import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  try {
    const clients = await prisma.client.findMany({ take: 1 });
    console.log("Clients fetched successfully:", clients.length);
    if (clients.length > 0) {
      const contact = await prisma.client.findUnique({
        where: { id: clients[0].id },
        include: {
          orders: {
            select: {
              id: true, labType: true,
            }
          }
        }
      });
      console.log("Contact fetched successfully with order labType");
    }
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
