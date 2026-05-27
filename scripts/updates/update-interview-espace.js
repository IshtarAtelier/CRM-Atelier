require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();

    // --- 1. INTERVIEW ---
    console.log("Updating Interview...");
    
    const oldInterview = await prod.product.findFirst({
        where: { name: "Essilor Ocupacional Interview ORMA" }
    });

    if (oldInterview) {
        await prod.product.update({
            where: { id: oldInterview.id },
            data: {
                name: "INTERVIEW - ORMA (DEG 0,80 Y 1,30) + CRIZAL 2x1",
                cost: 245830,
                price: 589992,
                laboratory: "OPTOVISION",
                type: "Cristal Ocupacional",
                is2x1: true,
                lensIndex: "1.50"
            }
        });
        console.log("Updated ORMA Interview.");
    } else {
        await prod.product.create({
            data: {
                name: "INTERVIEW - ORMA (DEG 0,80 Y 1,30) + CRIZAL 2x1",
                cost: 245830,
                price: 589992,
                laboratory: "OPTOVISION",
                type: "Cristal Ocupacional",
                is2x1: true,
                category: "Cristal",
                lensIndex: "1.50"
            }
        });
        console.log("Created ORMA Interview.");
    }

    const newAirwearInterview = await prod.product.findFirst({
        where: { name: "INTERVIEW - AIRWEAR 1.59 (DEG 0,80 Y 1,30) + CRIZAL 2x1" }
    });
    
    if (!newAirwearInterview) {
        await prod.product.create({
            data: {
                name: "INTERVIEW - AIRWEAR 1.59 (DEG 0,80 Y 1,30) + CRIZAL 2x1",
                cost: 330445,
                price: 793068,
                laboratory: "OPTOVISION",
                type: "Cristal Ocupacional",
                is2x1: true,
                category: "Cristal",
                lensIndex: "1.59"
            }
        });
        console.log("Created AIRWEAR Interview.");
    }

    // --- 2. ESPACE PLUS ---
    console.log("Creating Espace Plus...");
    
    const espaceProducts = [
        { name: "ESPACE PLUS DIGITAL - ORMA + CRIZAL 2x1", cost: 309887, price: 743729, lensIndex: "1.50" },
        { name: "ESPACE PLUS DIGITAL - AIRWEAR 1.59 + CRIZAL 2x1", cost: 360507, price: 865217, lensIndex: "1.59" },
        { name: "ESPACE PLUS DIGITAL - ORMA ACCLIMATES + CRIZAL 2x1", cost: 426344, price: 1023226, lensIndex: "1.50" },
        { name: "ESPACE PLUS DIGITAL - ORMA TRANSITIONS GEN S + CRIZAL 2x1", cost: 546769, price: 1312246, lensIndex: "1.50" },
        { name: "ESPACE PLUS DIGITAL - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL 2x1", cost: 593632, price: 1424717, lensIndex: "1.59" }
    ];

    for (const ep of espaceProducts) {
        const exists = await prod.product.findFirst({ where: { name: ep.name } });
        if (!exists) {
            await prod.product.create({
                data: {
                    name: ep.name,
                    cost: ep.cost,
                    price: ep.price,
                    laboratory: "OPTOVISION",
                    type: "Cristal Multifocal",
                    is2x1: true,
                    category: "Cristal",
                    lensIndex: ep.lensIndex
                }
            });
            console.log(`Created: ${ep.name}`);
        }
    }

    console.log("Process complete.");
    await prod.$disconnect();
}

main().catch(console.error);
