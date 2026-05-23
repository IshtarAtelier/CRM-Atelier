const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    const products = await prod.product.findMany({
        where: {
            name: {
                contains: 'physio',
                mode: 'insensitive'
            }
        },
        select: {
            id: true,
            name: true,
            laboratory: true,
            price: true,
            cost: true,
            is2x1: true
        },
        orderBy: {
            name: 'asc'
        }
    });
    
    console.log(JSON.stringify(products, null, 2));
    await prod.$disconnect();
}
main().catch(console.error);
