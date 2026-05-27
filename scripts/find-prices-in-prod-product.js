require("dotenv").config();
const { PrismaClient } = require('@prisma/client');

const PROD_URL = process.env.PROD_DATABASE_URL;
const LOCAL_URL = "postgresql://postgres:localpassword@localhost:5432/atelier?schema=public";

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } });

    await prod.$connect();
    await local.$connect();

    const localServices = await local.servicePricing.findMany({ where: { active: true } });
    const prodProducts = await prod.product.findMany({});

    console.log('Searching for exact matches by name in production Product table:');
    for (const service of localServices) {
        const exactMatch = prodProducts.find(p => p.name === service.name || (p.brand + ' ' + p.name).trim() === service.name);
        if (exactMatch) {
            console.log(`[EXACT] ${service.name}: Local Service=$${service.priceCash} vs Prod Product=$${exactMatch.price}`);
        } else {
            // Try fuzzy matching or contains
            const matches = prodProducts.filter(p => p.name && (p.name.includes(service.name) || service.name.includes(p.name)));
            if (matches.length > 0) {
                console.log(`[PARTIAL] ${service.name} ($${service.priceCash}):`);
                for (const m of matches) {
                    console.log(`   -> Prod Product: "${m.name}" | Price: $${m.price}`);
                }
            } else {
                console.log(`[NONE] ${service.name}`);
            }
        }
    }

    await local.$disconnect();
    await prod.$disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
