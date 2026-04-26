import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CALIBRADO = 40000;
const IVA = 1.21;

async function main() {
    const products = await prisma.product.findMany({
        where: {
            cost: { gt: 0 },
            OR: [
                { category: 'CRISTAL' },
                { type: { contains: 'Cristal' } },
                { type: { contains: 'Multifocal' } },
                { type: { contains: 'Monofocal' } },
                { type: { contains: 'Bifocal' } },
            ]
        },
        select: { id: true, brand: true, name: true, cost: true }
    });

    console.log(`Revirtiendo costos de ${products.length} cristales...`);
    console.log('Fórmula inversa: Lista = (Costo actual / 1.21) - $40.000\n');

    let updated = 0;
    for (const p of products) {
        const costoActual = p.cost;
        const listaOriginal = Math.round(costoActual / IVA - CALIBRADO);

        await prisma.product.update({
            where: { id: p.id },
            data: { cost: listaOriginal }
        });

        console.log(`↩️ ${p.brand || ''} | ${(p.name || '').substring(0, 55)} | $${costoActual.toLocaleString()} → $${listaOriginal.toLocaleString()}`);
        updated++;
    }

    console.log(`\n=== ${updated} productos revertidos ===`);
    await prisma.$disconnect();
}

main();
