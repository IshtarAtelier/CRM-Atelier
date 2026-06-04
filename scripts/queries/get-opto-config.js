require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

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
