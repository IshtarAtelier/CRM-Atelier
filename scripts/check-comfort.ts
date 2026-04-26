import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: { name: { contains: 'COMFORT MAX' } },
        select: { name: true, cost: true, price: true },
        orderBy: { cost: 'asc' }
    });

    console.log('=== COMFORT MAX - Verificación de costos ===\n');
    for (const p of products) {
        const nombre = (p.name || '').substring(0, 60);
        const markup = p.cost > 0 ? (p.price / p.cost).toFixed(2) : '—';
        const status = p.cost > 0 && (p.price / p.cost) >= 2.4 ? '✅' : '⚠️';
        console.log(`${status} ${nombre}`);
        console.log(`   Costo: $${p.cost.toLocaleString()} | Precio: $${p.price.toLocaleString()} | Markup: ×${markup}`);
    }
    await prisma.$disconnect();
}
main();
