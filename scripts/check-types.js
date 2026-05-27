require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

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
