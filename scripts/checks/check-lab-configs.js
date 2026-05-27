require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    const configs = await prod.laboratoryConfig.findMany();
    
    console.log(JSON.stringify(configs, null, 2));
    await prod.$disconnect();
}
main().catch(console.error);
