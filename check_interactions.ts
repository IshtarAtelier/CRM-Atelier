import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const interactions = await prisma.interaction.findMany({
        where: {
            clientId: "cmoj4wv4c004pl6ew28ea4x28"
        },
        orderBy: { createdAt: 'asc' }
    });
    console.log(JSON.stringify(interactions, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
