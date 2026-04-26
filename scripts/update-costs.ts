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
        select: { id: true, brand: true, name: true, cost: true, price: true }
    });

    console.log(`Actualizando costos de ${products.length} cristales...`);
    console.log('Fórmula: Costo Real = (Lista + $40.000) × 1.21');
    console.log('NO se modifican precios de venta.\n');

    let updated = 0;
    for (const p of products) {
        const lista = p.cost;
        const costoReal = Math.round((lista + CALIBRADO) * IVA);
        
        await prisma.product.update({
            where: { id: p.id },
            data: { cost: costoReal }
        });

        console.log(`✅ ${p.brand || ''} | ${(p.name || '').substring(0, 55)} | $${lista.toLocaleString()} → $${costoReal.toLocaleString()}`);
        updated++;
    }

    console.log(`\n=== ${updated} productos actualizados ===`);
    await prisma.$disconnect();
}

main();
