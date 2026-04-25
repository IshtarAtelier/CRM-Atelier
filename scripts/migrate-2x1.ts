import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const normalizeText = (text: string): string => {
    return (text || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .trim();
};

async function main() {
    console.log('Iniciando migración de productos 2x1...');

    const allProducts = await prisma.product.findMany();
    let updatedCount = 0;

    for (const p of allProducts) {
        if (p.is2x1) continue; // Ya tiene la marca explícita

        const fullSearch = normalizeText(`${p.name || ''} ${p.brand || ''} ${p.type || ''} ${p.model || ''}`);
        const isMT = fullSearch.includes('multifocal') || fullSearch.includes('progresivo');
        
        const promoRegex = /\b(2\s?x\s?1|2\s?por\s?1|dos\s?por\s?uno|dos\s?x\s?uno)\b/i;
        const isLegacy2x1 = promoRegex.test(fullSearch);

        if (isMT && isLegacy2x1) {
            console.log(`Marcando como 2x1: ${p.name} (${p.brand})`);
            await prisma.product.update({
                where: { id: p.id },
                data: { is2x1: true }
            });
            updatedCount++;
        }
    }

    console.log(`\nMigración completada. Se actualizaron ${updatedCount} productos.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
