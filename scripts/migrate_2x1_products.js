const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
    console.log('--- Iniciando migración de productos 2x1 ---');
    
    // Buscar todos los productos que tengan indicadores de 2x1 en el nombre o modelo
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { name: { contains: '2x1' } },
                { name: { contains: 'dos por uno' } },
                { name: { contains: '2 por 1' } },
                { name: { contains: '2por1' } },
                { model: { contains: '2x1' } },
                { model: { contains: 'dos por uno' } }
            ]
        }
    });

    console.log(`Encontrados ${products.length} productos potenciales.`);

    let updatedCount = 0;
    for (const p of products) {
        if (!p.is2x1) {
            await prisma.product.update({
                where: { id: p.id },
                data: { is2x1: true }
            });
            console.log(`✓ Marcado como 2x1: ${p.name || p.model || p.id}`);
            updatedCount++;
        }
    }

    console.log(`--- Migración finalizada: ${updatedCount} productos actualizados ---`);
}

migrate()
    .catch(e => {
        console.error('Error durante la migración:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
