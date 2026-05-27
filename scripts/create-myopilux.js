require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

const productsToCreate = [
    // MYOPILUX KIDS LITE
    {
        name: "MYOPILUX KIDS LITE - AIRWEAR 1.59 + CRIZAL",
        cost: 325653,
        price: 781567,
        laboratory: "OPTOVISION",
        is2x1: false,
        lensIndex: "1.59",
        category: "Cristal",
        type: "Cristal Monofocal"
    },
    {
        name: "MYOPILUX KIDS LITE - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL",
        cost: 443659,
        price: 1064782,
        laboratory: "OPTOVISION",
        is2x1: false,
        lensIndex: "1.59",
        category: "Cristal",
        type: "Cristal Monofocal"
    },
    // MYOPILUX KIDS PLUS
    {
        name: "MYOPILUX KIDS PLUS - AIRWEAR 1.59 + CRIZAL",
        cost: 325653,
        price: 781567,
        laboratory: "OPTOVISION",
        is2x1: false,
        lensIndex: "1.59",
        category: "Cristal",
        type: "Cristal Monofocal"
    },
    {
        name: "MYOPILUX KIDS PLUS - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL",
        cost: 443659,
        price: 1064782,
        laboratory: "OPTOVISION",
        is2x1: false,
        lensIndex: "1.59",
        category: "Cristal",
        type: "Cristal Monofocal"
    },
    {
        name: "MYOPILUX KIDS PLUS - STYLIS 1.67 + CRIZAL",
        cost: 385760,
        price: 925824,
        laboratory: "OPTOVISION",
        is2x1: false,
        lensIndex: "1.67",
        category: "Cristal",
        type: "Cristal Monofocal"
    },
    {
        name: "MYOPILUX KIDS PLUS - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL",
        cost: 606912,
        price: 1456589,
        laboratory: "OPTOVISION",
        is2x1: false,
        lensIndex: "1.67",
        category: "Cristal",
        type: "Cristal Monofocal"
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
