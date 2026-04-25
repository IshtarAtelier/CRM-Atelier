import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: "postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway"
});

async function main() {
    console.log("Estandarizando tipos de cristal...");
    
    const cristales = await prisma.product.findMany({
        where: {
            OR: [
                { category: 'Cristal' },
                { category: 'LENS' },
                { type: { startsWith: 'MULTIFOCAL' } },
                { type: { startsWith: 'MONOFOCAL' } },
                { type: { startsWith: 'BIFOCAL' } },
                { type: { startsWith: 'OCUPACIONAL' } }
            ]
        }
    });

    let updatedCount = 0;

    for (const p of cristales) {
        let newType = p.type;
        const typeUpper = (p.type || '').toUpperCase();
        
        if (typeUpper === 'MULTIFOCAL') newType = 'Cristal Multifocal';
        else if (typeUpper === 'MONOFOCAL') newType = 'Cristal Monofocal';
        else if (typeUpper === 'BIFOCAL') newType = 'Cristal Bifocal';
        else if (typeUpper === 'OCUPACIONAL') newType = 'Cristal Ocupacional';
        else if (typeUpper === 'CRISTAL MULTIFOCAL') newType = 'Cristal Multifocal';
        else if (typeUpper === 'CRISTAL MONOFOCAL') newType = 'Cristal Monofocal';
        else if (typeUpper === 'CRISTAL BIFOCAL') newType = 'Cristal Bifocal';
        else if (typeUpper === 'CRISTAL OCUPACIONAL') newType = 'Cristal Ocupacional';

        let newCategory = p.category;
        if (newCategory === 'LENS') newCategory = 'Cristal';

        if (newType !== p.type || newCategory !== p.category) {
            await prisma.product.update({
                where: { id: p.id },
                data: { type: newType, category: newCategory }
            });
            console.log(`Corregido: [${p.id}] ${p.name} | Cat: ${p.category}->${newCategory} | Tipo: ${p.type} -> ${newType}`);
            updatedCount++;
        }
    }

    console.log(`\nMigración terminada. Se estandarizaron ${updatedCount} productos.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
