const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

const productsToCreate = [
    {
        name: "COMFORT - ORMA + CRIZAL 2x1",
        cost: 546769,
        price: 1312246,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.50",
        category: "Cristal"
    },
    {
        name: "COMFORT - AIRWEAR 1.59 + CRIZAL 2x1",
        cost: 595090,
        price: 1428216,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.59",
        category: "Cristal"
    },
    {
        name: "COMFORT - STYLIS 1.67 + CRIZAL 2x1",
        cost: 626000,
        price: 1502400,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.67",
        category: "Cristal"
    },
    {
        name: "COMFORT - ORMA TRANSITIONS GEN S + CRIZAL 2x1",
        cost: 743345,
        price: 1784028,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.50",
        category: "Cristal"
    },
    {
        name: "COMFORT - ORMA TRANSITIONS XTRACTIVE + CRIZAL 2x1",
        cost: 743345,
        price: 1784028,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.50",
        category: "Cristal"
    },
    {
        name: "COMFORT - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL 2x1",
        cost: 790929,
        price: 1898230,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.59",
        category: "Cristal"
    },
    {
        name: "COMFORT - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL 2x1",
        cost: 824984,
        price: 1979962,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.67",
        category: "Cristal"
    },
    {
        name: "COMFORT - ORMA XPERIO + CRIZAL 2x1",
        cost: 743345,
        price: 1784028,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.50",
        category: "Cristal"
    },
    {
        name: "COMFORT - AIRWEAR 1.59 XPERIO + CRIZAL 2x1",
        cost: 790929,
        price: 1898230,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.59",
        category: "Cristal"
    }
];

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    for (const p of productsToCreate) {
        console.log(`Creating: ${p.name}`);
        await prod.product.create({
            data: p
        });
    }

    console.log(`Successfully created ${productsToCreate.length} products.`);
    
    await prod.$disconnect();
}

main().catch(console.error);
