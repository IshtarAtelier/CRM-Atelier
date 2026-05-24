const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

function calculate(pelado) {
    const costo = Math.round((pelado + 46000) * 1.21);
    const precio = Math.round(costo * 2.4);
    return { cost: costo, price: precio };
}

const updates = [
    { nameMatch: "COMFORT MAX - AIRWEAR 1.59 + CRIZAL 2x1", ...calculate(460260), lensIndex: "1.59" },
    { nameMatch: "COMFORT MAX - AIRWEAR 1.59 TRANSITIONS GEN S+CRIZAL (fotocromaticos 2)  2x1", ...calculate(660050), lensIndex: "1.59" },
    { nameMatch: "COMFORT MAX - AIRWEAR 1.59 XPERIO  + CRIZAL  2x1", ...calculate(660050), lensIndex: "1.59" },
    { nameMatch: "COMFORT MAX - ORMA  + CRIZAL  2x1", ...calculate(417705), lensIndex: "1.50" },
    { nameMatch: "COMFORT MAX - ORMA TRANSITIONS GEN S  + CRIZAL (fotocromaticos 8)  2x1", ...calculate(617420), lensIndex: "1.50" },
    { nameMatch: "COMFORT MAX - ORMA TRANSITIONS XTRACTIVE  + CRIZAL(fotocromatico Gris)  2x1", ...calculate(617420), lensIndex: "1.50" },
    { nameMatch: "COMFORT MAX - STYLIS 1.67  + CRIZAL 2x1", ...calculate(484485), lensIndex: "1.67" },
    { nameMatch: "COMFORT MAX - STYLIS 1.67 TRANSITIONS GEN S+CRIZAL (fotocromaticos 2)  2x1", ...calculate(684920), lensIndex: "1.67" },
    { nameMatch: "COMFORT MAX - ORMA XPERIO + CRIZAL 2x1", ...calculate(617420), lensIndex: "1.50", createMissing: true }
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
                contains: 'comfort max',
                mode: 'insensitive'
            }
        }
    });

    for (const u of updates) {
        const normDbName = normalizeString(u.nameMatch);
        // Find existing based on normalized name ignoring extra spaces
        const existing = existingProducts.find(p => normalizeString(p.name) === normDbName);

        if (existing) {
            console.log(`Updating existing: ${existing.name}`);
            await prod.product.update({
                where: { id: existing.id },
                data: {
                    cost: u.cost,
                    price: u.price,
                    laboratory: 'OPTOVISION',
                    is2x1: true,
                    lensIndex: u.lensIndex
                }
            });
        } else if (u.createMissing) {
            console.log(`Creating missing: ${u.nameMatch}`);
            await prod.product.create({
                data: {
                    name: "COMFORT MAX - ORMA XPERIO + CRIZAL 2x1",
                    cost: u.cost,
                    price: u.price,
                    laboratory: 'OPTOVISION',
                    is2x1: true,
                    lensIndex: u.lensIndex,
                    category: 'Cristal'
                }
            });
        } else {
            console.log(`WARNING: Target product not found to update: ${u.nameMatch}`);
        }
    }

    console.log("Process complete.");
    await prod.$disconnect();
}

main().catch(console.error);
