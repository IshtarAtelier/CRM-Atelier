const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();

    console.log("Actualizando EYEZEN...");
    const prods = await prod.product.findMany({
        where: { name: { contains: 'EYEZEN' } }
    });
    
    for (const p of prods) {
        let sMax = 0, sMin = -10.0, cMax = 6.0, cMin = -6.0;
        
        if (p.name.includes("ORMA")) { sMax = 6.0; }
        else if (p.name.includes("AIRWEAR")) { sMax = 6.0; }
        else if (p.name.includes("STYLIS")) { sMax = 9.0; sMin = -14.0; }

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
