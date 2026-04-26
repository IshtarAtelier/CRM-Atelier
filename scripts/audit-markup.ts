import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: { cost: { gt: 0 }, price: { gt: 0 } },
        select: { id: true, brand: true, name: true, type: true, category: true, cost: true, price: true, is2x1: true }
    });

    const bad = products
        .filter(pr => pr.price < pr.cost * 2.4)
        .sort((a, b) => (a.cost * 2.4 - a.price) - (b.cost * 2.4 - b.price));

    console.log('=== PRODUCTOS CON MARKUP INSUFICIENTE (precio < costo x2 +20%) ===');
    console.log(`Total con problemas: ${bad.length} / ${products.length} productos con costo y precio`);
    console.log('');

    for (const pr of bad) {
        const minPrice = Math.round(pr.cost * 2.4);
        const diff = minPrice - pr.price;
        const pct = ((pr.price / pr.cost - 1) * 100).toFixed(0);
        console.log(
            `${pr.brand || '—'} | ${pr.name || '—'} | Cat: ${pr.category || pr.type || '—'} | ` +
            `Costo: $${pr.cost.toLocaleString()} | Precio: $${pr.price.toLocaleString()} | ` +
            `Mín: $${minPrice.toLocaleString()} | Falta: $${diff.toLocaleString()} | Markup: ${pct}%`
        );
    }

    await prisma.$disconnect();
}

main();
