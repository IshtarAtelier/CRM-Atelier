require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();

    const prods = await prod.product.findMany({
        where: { name: { contains: 'VARILUX', mode: 'insensitive' } }
    });
    
    console.log("Found products:");
    for (const p of prods) {
        console.log(`- ID: ${p.id}, Name: ${p.name}`);
    }

    await prod.$disconnect();
}

main().catch(console.error);
