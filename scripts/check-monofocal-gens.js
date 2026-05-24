const { PrismaClient } = require('@prisma/client');
const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();
    
    // Buscar monofocales que contengan "Gen S"
    const products = await prod.product.findMany({
        where: {
            name: { contains: 'gen s', mode: 'insensitive' },
            type: 'Cristal Monofocal'
        },
        orderBy: {
            name: 'asc'
        }
    });

    console.log("=== BÚSQUEDA MONOFOCALES TRANSITIONS GEN S ===");
    console.log(`Encontrados: ${products.length}`);
    
    if (products.length > 0) {
        const tableData = products.map(p => {
            return {
                ID: p.id,
                Nombre: p.name,
                Costo: p.cost,
                Precio: p.price,
                is2x1: p.is2x1
            };
        });
        console.table(tableData);
    }
    
    // Y también buscar si hay otros monofocales Transitions para ver qué más hay
    const otherTransitions = await prod.product.findMany({
        where: {
            name: { contains: 'transitions', mode: 'insensitive' },
            type: 'Cristal Monofocal',
            NOT: {
                name: { contains: 'gen s', mode: 'insensitive' }
            }
        },
        orderBy: {
            name: 'asc'
        }
    });

    console.log("\n=== OTROS MONOFOCALES TRANSITIONS (No Gen S) ===");
    console.log(`Encontrados: ${otherTransitions.length}`);
    if (otherTransitions.length > 0) {
        const tableData2 = otherTransitions.map(p => {
            return {
                ID: p.id,
                Nombre: p.name,
                Costo: p.cost,
                Precio: p.price,
                is2x1: p.is2x1
            };
        });
        console.table(tableData2);
    }
    
    await prod.$disconnect();
}

main().catch(console.error);
