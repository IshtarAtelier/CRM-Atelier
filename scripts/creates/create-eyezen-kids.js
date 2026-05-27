require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    // 1. Create Eyezen Kids
    const kidsProducts = [
        {
            name: "EYEZEN KIDS - AIRWEAR 1.59 + CRIZAL 2x1",
            cost: 237644,
            price: 570346,
            laboratory: "OPTOVISION",
            is2x1: true,
            lensIndex: "1.59",
            category: "Cristal",
            type: "Cristal Monofocal"
        },
        {
            name: "EYEZEN KIDS - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL 2x1",
            cost: 421576,
            price: 1011782,
            laboratory: "OPTOVISION",
            is2x1: true,
            lensIndex: "1.59",
            category: "Cristal",
            type: "Cristal Monofocal"
        }
    ];

    for (const p of kidsProducts) {
        console.log(`Creating: ${p.name}`);
        await prod.product.create({ data: p });
    }

    // 2. Update the recently created Eyezen Start/Boost to also have type "Cristal Monofocal"
    console.log("\nUpdating existing Eyezen Start/Boost to have type='Cristal Monofocal'...");
    const updateResult = await prod.product.updateMany({
        where: {
            OR: [
                { name: { startsWith: 'EYEZEN START' } },
                { name: { startsWith: 'EYEZEN BOOST' } }
            ]
        },
        data: {
            type: "Cristal Monofocal"
        }
    });
    
    console.log(`Updated ${updateResult.count} Eyezen Start/Boost products with type='Cristal Monofocal'.`);

    console.log("Process complete.");
    await prod.$disconnect();
}

main().catch(console.error);
