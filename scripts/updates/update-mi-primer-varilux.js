require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

const updates = [
    {
        nameMatch: "MI PRIMER VARILUX COMFORT MAX - ORMA ",
        cost: 280542,
        price: 673301
    },
    {
        nameMatch: " MI PRIMER VARILUX COMFORT MAX -  AIRWEAR 1.59 ",
        cost: 306288,
        price: 735091
    },
    {
        nameMatch: "MI PRIMER VARILUX COMFORT MAX -  STYLIS 1.67",
        cost: 320944,
        price: 770266
    },
    {
        nameMatch: "MI PRIMER VARILUX COMFORT MAX -  ORMA TRANSITIONS GEN S (Fotocromatico)  ",
        cost: 401369,
        price: 963286
    }
];

function normalizeString(str) {
    return str.replace(/\s+/g, ' ').trim().toUpperCase();
}

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    const existingProducts = await prod.product.findMany({
        where: {
            name: {
                contains: 'mi primer varilux',
                mode: 'insensitive'
            }
        }
    });

    for (const u of updates) {
        const normDbName = normalizeString(u.nameMatch);
        const existing = existingProducts.find(p => normalizeString(p.name) === normDbName);

        if (existing) {
            console.log(`Updating: ${existing.name}`);
            await prod.product.update({
                where: { id: existing.id },
                data: {
                    cost: u.cost,
                    price: u.price,
                    laboratory: 'OPTOVISION',
                    is2x1: false // Explicitly enforcing it
                }
            });
        } else {
            console.log(`WARNING: Could not find product matching ${u.nameMatch}`);
        }
    }

    console.log("Process complete.");
    await prod.$disconnect();
}

main().catch(console.error);
