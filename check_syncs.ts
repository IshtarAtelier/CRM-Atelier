import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway"
        }
    }
});

async function checkSyncs() {
    const recentSyncs = await prisma.order.findMany({
        where: {
            smartLabLastSync: { not: null }
        },
        orderBy: {
            smartLabLastSync: 'desc'
        },
        take: 5,
        select: {
            id: true,
            labOrderNumber: true,
            smartLabProgress: true,
            smartLabLastSync: true,
            client: { select: { name: true } }
        }
    });

    console.log("Recent Syncs in PROD:", recentSyncs);
}

checkSyncs()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
