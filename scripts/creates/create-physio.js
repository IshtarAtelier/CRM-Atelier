require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

const productsToCreate = [
    {
        name: "PHYSIO - ORMA + CRIZAL 2x1",
        cost: 649788,
        price: 1559491,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.50",
        category: "Cristal"
    },
    {
        name: "PHYSIO - AIRWEAR 1.59 + CRIZAL 2x1",
        cost: 698926,
        price: 1677422,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.59",
        category: "Cristal"
    },
    {
        name: "PHYSIO - STYLIS 1.67 + CRIZAL 2x1",
        cost: 732250,
        price: 1757400,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.67",
        category: "Cristal"
    },
    {
        name: "PHYSIO - ORMA TRANSITIONS GEN S + CRIZAL 2x1",
        cost: 844701,
        price: 2027282,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.50",
        category: "Cristal"
    },
    {
        name: "PHYSIO - ORMA TRANSITIONS XTRACTIVE + CRIZAL 2x1",
        cost: 844701,
        price: 2027282,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.50",
        category: "Cristal"
    },
    {
        name: "PHYSIO - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL 2x1",
        cost: 899550,
        price: 2158920,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.59",
        category: "Cristal"
    },
    {
        name: "PHYSIO - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL 2x1",
        cost: 927931,
        price: 2227034,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.67",
        category: "Cristal"
    },
    {
        name: "PHYSIO - ORMA XPERIO + CRIZAL 2x1",
        cost: 844701,
        price: 2027282,
        laboratory: "OPTOVISION",
        is2x1: true,
        lensIndex: "1.50",
        category: "Cristal"
    },
    {
        name: "PHYSIO - AIRWEAR 1.59 XPERIO + CRIZAL 2x1",
        cost: 899550,
        price: 2158920,
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
