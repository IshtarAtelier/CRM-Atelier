require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();

    console.log("Actualizando MYOPILUX...");
    const prods = await prod.product.findMany({
        where: { name: { contains: 'MYOPILUX' } }
    });
    
    for (const p of prods) {
        let sMax = 0, sMin = -8.0, cMax = 4.0, cMin = -4.0;
        
        await prod.product.update({
            where: { id: p.id },
            data: { sphereMax: sMax, sphereMin: sMin, cylinderMax: cMax, cylinderMin: cMin }
        });
        console.log(`Updated limits for ${p.name}: +${sMax} a ${sMin}`);
    }

    console.log("Done.");
    await prod.$disconnect();
}

main().catch(console.error);
