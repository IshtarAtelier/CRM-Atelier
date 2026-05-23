const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    const optovision = await prod.laboratoryConfig.findUnique({
        where: { name: 'OPTOVISION' }
    });
    
    console.log("Optovision config:", optovision);
    await prod.$disconnect();
}
main().catch(console.error);
