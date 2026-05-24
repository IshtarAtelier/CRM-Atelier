const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    console.log("Updating laboratory to OPTOVISION for all PHYSIO products...");
    const result = await prod.product.updateMany({
        where: {
            name: {
                contains: 'physio',
                mode: 'insensitive'
            }
        },
        data: {
            laboratory: 'OPTOVISION'
        }
    });

    console.log(`Successfully updated ${result.count} products.`);
    
    await prod.$disconnect();
}

main().catch(console.error);
