import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const costList = 20000;
    const iva = 21;
    const finalCost = Math.round(costList * (1 + iva / 100)); // 24200
    const salePrice = Math.round(finalCost * 2.4); // 58080

    const updatedProduct = await prisma.product.updateMany({
        where: {
            name: 'Teñido de Cristales',
            model: 'Según Muestra',
            laboratory: 'OPTOVISION'
        },
        data: {
            cost: finalCost,
            price: salePrice
        }
    });

    console.log(`Updated ${updatedProduct.count} products.`);
    console.log(`New Cost: $${finalCost}, New Price: $${salePrice}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
