import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const invoices = await prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: {
            order: {
                select: {
                    id: true,
                    client: { select: { name: true } }
                }
            }
        }
    });
    console.log(JSON.stringify(invoices, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
