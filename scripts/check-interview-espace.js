require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    const interview = await prod.product.findMany({
        where: { name: { contains: 'interview', mode: 'insensitive' } }
    });

    const espace = await prod.product.findMany({
        where: { name: { contains: 'espace', mode: 'insensitive' } }
    });

    console.log("=== BÚSQUEDA INTERVIEW ===");
    console.log(`Encontrados: ${interview.length}`);
    if (interview.length > 0) console.table(interview.map(p => ({ Nombre: p.name, Precio: p.price })));

    console.log("\n=== BÚSQUEDA ESPACE PLUS ===");
    console.log(`Encontrados: ${espace.length}`);
    if (espace.length > 0) console.table(espace.map(p => ({ Nombre: p.name, Precio: p.price })));

    await prod.$disconnect();
}

main().catch(console.error);
