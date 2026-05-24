const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    const products = await prod.product.findMany({
        where: {
            name: {
                contains: 'comfort',
                mode: 'insensitive'
            },
            NOT: {
                name: {
                    contains: 'max',
                    mode: 'insensitive'
                }
            }
        },
        orderBy: {
            name: 'asc'
        }
    });

    console.log("=== REPORTE COMFORT EN PRODUCCIÓN ===");
    console.log(`Total encontrados: ${products.length}`);
    
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
    await prod.$disconnect();
}

main().catch(console.error);
