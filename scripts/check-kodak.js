require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const PROD_URL = process.env.PROD_DATABASE_URL;

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    const products = await prod.product.findMany({
        where: {
            name: {
                contains: 'kodak',
                mode: 'insensitive'
            }
        },
        orderBy: {
            name: 'asc'
        }
    });

    console.log("=== REPORTE KODAK EN PRODUCCIÓN ===");
    console.log(`Total encontrados: ${products.length}`);
    
    if (products.length > 0) {
        const tableData = products.map(p => {
            return {
                ID: p.id,
                Nombre: p.name,
                Laboratorio: p.laboratory,
                is2x1: p.is2x1,
                Costo: p.cost,
                Precio: p.price
            };
        });
        console.table(tableData);
    } else {
        console.log("No se encontraron productos con la palabra 'Kodak'.");
    }
    
    await prod.$disconnect();
}

main().catch(console.error);
