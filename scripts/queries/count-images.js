require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.$connect();

    const products = await prisma.product.findMany({
        where: {
            OR: [
                { imagenesCatalogo: { isEmpty: false } },
                { rawImageUrls: { isEmpty: false } }
            ]
        }
    });

    console.log(`Found ${products.length} products with images:`);
    for (const p of products) {
        console.log(`- ID: ${p.id}, Brand: ${p.brand}, Model: ${p.model}, Raw Images: ${p.rawImageUrls.length}, Catalog Images: ${p.imagenesCatalogo.length}`);
    }

    await prisma.$disconnect();
}

main().catch(console.error);
