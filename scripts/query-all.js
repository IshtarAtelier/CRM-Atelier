const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();

    const prods = await prod.product.findMany({
        where: { category: 'Cristal' }
    });
    
    console.log("All Crystals:");
    for (const p of prods) {
        console.log(`- ID: ${p.id}, Name: ${p.name}`);
    }

    await prod.$disconnect();
}

main().catch(console.error);
