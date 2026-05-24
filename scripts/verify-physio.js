const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    const physioProducts = await prod.product.findMany({
        where: {
            name: {
                contains: 'physio',
                mode: 'insensitive'
            }
        },
        orderBy: {
            name: 'asc'
        }
    });

    console.log("=== REPORTE PHYSIO 3.0 EN PRODUCCIÓN ===");
    console.log(`Total encontrados: ${physioProducts.length}`);
    
    // Check duplicates
    const names = physioProducts.map(p => p.name);
    const duplicates = names.filter((item, index) => names.indexOf(item) !== index);
    if (duplicates.length > 0) {
        console.log("¡ADVERTENCIA! Se encontraron duplicados:", duplicates);
    } else {
        console.log("✓ No hay duplicados.");
    }

    // Print table format
    const tableData = physioProducts.map(p => {
        return {
            ID: p.id,
            Nombre: p.name,
            Laboratorio: p.laboratory,
            is2x1: p.is2x1,
            Índice: p.lensIndex,
            Costo: p.cost,
            Precio: p.price
        };
    });

    console.table(tableData);
    
    await prod.$disconnect();
}

main().catch(console.error);
