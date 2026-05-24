const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    const products = await prod.product.findMany({
        where: {
            name: {
                contains: 'eyezen',
                mode: 'insensitive'
            }
        },
        orderBy: {
            name: 'asc'
        }
    });

    console.log("=== REPORTE EYEZEN EN PRODUCCIÓN ===");
    console.log(`Total encontrados: ${products.length}`);
    
    if (products.length > 0) {
        const tableData = products.map(p => {
            const markup = p.cost > 0 ? (p.price / p.cost).toFixed(2) + 'x' : 'N/A';
            return {
                ID: p.id,
                Nombre: p.name,
                Laboratorio: p.laboratory,
                is2x1: p.is2x1,
                Costo: p.cost,
                Precio: p.price,
                Markup: markup
            };
        });

        console.table(tableData);
    } else {
        console.log("No se encontraron productos con el nombre 'Eyezen'.");
    }
    
    await prod.$disconnect();
}

main().catch(console.error);
