require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    const products = await prod.product.findMany({
        where: {
            OR: [
                { name: { contains: 'kodak', mode: 'insensitive' } },
                { name: { contains: 'unique', mode: 'insensitive' } },
                { name: { contains: 'precise', mode: 'insensitive' } },
                { name: { contains: 'softwear', mode: 'insensitive' } },
                { name: { contains: 'sv digital', mode: 'insensitive' } },
                { name: { contains: 'kdk', mode: 'insensitive' } }
            ]
        },
        orderBy: {
            name: 'asc'
        }
    });

    console.log("=== BÚSQUEDA EXTENDIDA (KODAK / UNIQUE / PRECISE / SOFTWEAR) ===");
    console.log(`Total encontrados: ${products.length}`);
    
    if (products.length > 0) {
        const tableData = products.map(p => {
            return {
                ID: p.id,
                Nombre: p.name,
                Costo: p.cost,
                Precio: p.price
            };
        });
        console.table(tableData);
    }
    
    await prod.$disconnect();
}

main().catch(console.error);
