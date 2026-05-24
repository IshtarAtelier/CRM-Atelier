const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    const types = await prod.product.findMany({
        select: {
            type: true
        },
        distinct: ['type']
    });

    console.log("Tipos de productos existentes:");
    console.table(types);
    
    await prod.$disconnect();
}

main().catch(console.error);
