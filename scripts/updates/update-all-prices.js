require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

function calculate(pelado) {
    const costo = Math.round((pelado + 46000) * 1.21);
    const precio = Math.round(costo * 2.4);
    return { cost: costo, price: precio };
}

const updates = [
    // --- VARILUX XR DESIGN ---
    { nameMatch: "XR DESIGN - AIRWEAR 1.59 + CRIZAL 2x1", ...calculate(593640) },
    { nameMatch: "XR DESIGN - AIRWEAR 1.59 TRANSITIONS GEN S  + CRIZAL  (fotocromaticos 8) 2x1", ...calculate(804165) },
    { nameMatch: "XR DESIGN - AIRWEAR 1.59 XPERIO  + CRIZAL  2x1", ...calculate(804165) },
    { nameMatch: "XR DESIGN -  ORMA   + CRIZAL  2x1", ...calculate(551765) },
    { nameMatch: "XR DESIGN - ORMA TRANSITIONS GEN S  + CRIZAL Prevencia   (fotocromaticos 8)  2x1", ...calculate(759475) },
    { nameMatch: "XR DESIGN - ORMA XPERIO  + CRIZAL  2x1", ...calculate(759475) },
    { nameMatch: "XR DESIGN - STYLIS 1.67  + CRIZAL  2x1", ...calculate(620625) },
    { nameMatch: "XR DESIGN - STYLIS 1.67 TRANSITIONS GEN S  + CRIZAL  (fotocromaticos 8)  2x1", ...calculate(825675) },

    // --- PHYSIO 3.0 ---
    { nameMatch: "PHYSIO 3.0 - AIRWEAR 1.59 + CRIZAL 2x1", ...calculate(553885) },
    { nameMatch: "PHYSIO 3.0 - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL (fotocromaticos 2) 2x1", ...calculate(752945) },
    { nameMatch: "PHYSIO 3.0 - AIRWEAR 1.59 XPERIO + CRIZAL 2x1", ...calculate(752945) },
    { nameMatch: "PHYSIO 3.0 - ORMA + CRIZAL 2x1", ...calculate(513305) },
    { nameMatch: "PHYSIO 3.0 - ORMA TRANSITIONS GEN S + CRIZAL (fotocromaticos 8) 2x1", ...calculate(712440) },
    { nameMatch: "PHYSIO 3.0 - ORMA TRANSITIONS XTRACTIVE + CRIZAL (fotocromatico Gris) 2x1", ...calculate(712440) },
    { nameMatch: "PHYSIO 3.0 - ORMA XPERIO + CRIZAL 2x1", ...calculate(712440) },
    { nameMatch: "PHYSIO 3.0 - STYLIS 1.67 + CRIZAL 2x1", ...calculate(577485) },
    { nameMatch: "PHYSIO 3.0 - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL (fotocromaticos 2) 2x1", ...calculate(780505) }
];

function normalizeString(str) {
    return str.replace(/\s+/g, ' ').trim().toUpperCase();
}

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    // Fetch all products that contain either XR DESIGN or PHYSIO
    const existingProducts = await prod.product.findMany({
        where: {
            OR: [
                { name: { contains: 'xr design', mode: 'insensitive' } },
                { name: { contains: 'physio', mode: 'insensitive' } }
            ]
        }
    });

    for (const p of existingProducts) {
        const normDbName = normalizeString(p.name);
        const match = updates.find(u => normalizeString(u.nameMatch) === normDbName);

        if (match) {
            console.log(`Updating: ${p.name}`);
            console.log(`  -> New Cost: ${match.cost}, New Price: ${match.price}`);
            await prod.product.update({
                where: { id: p.id },
                data: {
                    cost: match.cost,
                    price: match.price
                }
            });
        }
    }

    console.log("Process complete.");
    await prod.$disconnect();
}

main().catch(console.error);
