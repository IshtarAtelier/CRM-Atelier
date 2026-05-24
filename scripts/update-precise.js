const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

const preciseProducts = [
    { name: "KODAK PRECISE - ORMA 2x1", cost: 341408, price: 819379, lensIndex: "1.50" },
    { name: "KODAK PRECISE - ORMA BLUE UV 2x1", cost: 353483, price: 848359, lensIndex: "1.50" },
    { name: "KODAK PRECISE - AIRWEAR 1.59 2x1", cost: 341408, price: 819379, lensIndex: "1.59" },
    { name: "KODAK PRECISE - AIRWEAR 1.59 BLUE UV 2x1", cost: 353483, price: 848359, lensIndex: "1.59" },
    { name: "KODAK PRECISE - STYLIS 1.67 2x1", cost: 414431, price: 994634, lensIndex: "1.67" },
    { name: "KODAK PRECISE - STYLIS 1.67 BLUE UV 2x1", cost: 428570, price: 1028568, lensIndex: "1.67" },
    { name: "KODAK PRECISE - ORMA ACCLIMATES 2x1", cost: 445377, price: 1068905, lensIndex: "1.50" },
    { name: "KODAK PRECISE - ORMA TRANSITIONS GEN S 2x1", cost: 568174, price: 1363618, lensIndex: "1.50" },
    { name: "KODAK PRECISE - AIRWEAR 1.59 TRANSITIONS GEN S 2x1", cost: 612575, price: 1470180, lensIndex: "1.59" },
    { name: "KODAK PRECISE - STYLIS 1.67 TRANSITIONS GEN S 2x1", cost: 639491, price: 1534778, lensIndex: "1.67" },
    { name: "KODAK PRECISE - ORMA XPERIO 2x1", cost: 568174, price: 1363618, lensIndex: "1.50" },
    { name: "KODAK PRECISE - AIRWEAR 1.59 XPERIO 2x1", cost: 612575, price: 1470180, lensIndex: "1.59" }
];

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();

    for (const p of preciseProducts) {
        // Try to find the existing product by name
        const existing = await prod.product.findFirst({
            where: { name: p.name }
        });

        if (existing) {
            console.log(`Updating: ${p.name}`);
            await prod.product.update({
                where: { id: existing.id },
                data: {
                    cost: p.cost,
                    price: p.price,
                    laboratory: "OPTOVISION",
                    is2x1: true,
                    lensIndex: p.lensIndex,
                    category: "Cristal",
                    type: "Cristal Multifocal"
                }
            });
        } else {
            console.log(`Creating missing: ${p.name}`);
            await prod.product.create({
                data: {
                    name: p.name,
                    cost: p.cost,
                    price: p.price,
                    laboratory: "OPTOVISION",
                    is2x1: true,
                    lensIndex: p.lensIndex,
                    category: "Cristal",
                    type: "Cristal Multifocal"
                }
            });
        }
    }

    console.log("Process complete for Kodak Precise.");
    await prod.$disconnect();
}

main().catch(console.error);
