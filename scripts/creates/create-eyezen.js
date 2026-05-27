require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

const baseProducts = [
    { nameSuffix: "ORMA + CRIZAL 2x1", cost: 254306, price: 610334, lensIndex: "1.50" },
    { nameSuffix: "AIRWEAR 1.59 + CRIZAL 2x1", cost: 254306, price: 610334, lensIndex: "1.59" },
    { nameSuffix: "STYLIS 1.67 + CRIZAL 2x1", cost: 341408, price: 819379, lensIndex: "1.67" },
    { nameSuffix: "ORMA TRANSITIONS GEN S (Gris) + CRIZAL 2x1", cost: 437415, price: 1049796, lensIndex: "1.50" },
    { nameSuffix: "ORMA TRANSITIONS GEN S (Colores) + CRIZAL 2x1", cost: 505623, price: 1213495, lensIndex: "1.50" },
    { nameSuffix: "AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL 2x1", cost: 476189, price: 1142854, lensIndex: "1.59" },
    { nameSuffix: "STYLIS 1.67 TRANSITIONS GEN S + CRIZAL 2x1", cost: 647368, price: 1553683, lensIndex: "1.67" },
];

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    // 1. ARCHIVE THE EXISTING EYEZEN ITEM SAFELY
    const oldEyezen = await prod.product.findUnique({
        where: { id: "cmpel6fqg0019kom05566vr77" }
    });
    
    if (oldEyezen && !oldEyezen.name.includes("[ARCHIVADO]")) {
        console.log(`Archiving old product: ${oldEyezen.name}`);
        await prod.product.update({
            where: { id: "cmpel6fqg0019kom05566vr77" },
            data: {
                name: `[ARCHIVADO] ${oldEyezen.name}`,
                stock: 0,
                publishToWeb: false
            }
        });
    }

    // 2. CREATE NEW EYEZEN START AND BOOST ITEMS
    for (const prefix of ["EYEZEN START -", "EYEZEN BOOST -"]) {
        for (const bp of baseProducts) {
            const fullName = `${prefix} ${bp.nameSuffix}`;
            console.log(`Creating: ${fullName}`);
            await prod.product.create({
                data: {
                    name: fullName,
                    cost: bp.cost,
                    price: bp.price,
                    laboratory: "OPTOVISION",
                    is2x1: true,
                    lensIndex: bp.lensIndex,
                    category: "Cristal"
                }
            });
        }
    }

    console.log("Process complete: 1 archived, 14 created.");
    await prod.$disconnect();
}

main().catch(console.error);
