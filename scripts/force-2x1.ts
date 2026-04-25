import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Buscando productos con 2x1 en el nombre para forzar el switch a activo...");
    
    const allProducts = await prisma.product.findMany();
    
    let updatedCount = 0;
    
    for (const product of allProducts) {
        const name = product.name?.toLowerCase() || '';
        if (
            name.includes('2x1') || 
            name.includes('2 x 1') || 
            name.includes('dos por uno') || 
            name.includes('dos x uno')
        ) {
            if (!product.is2x1) {
                await prisma.product.update({
                    where: { id: product.id },
                    data: { is2x1: true }
                });
                console.log(`- Activado 2x1: ${product.name}`);
                updatedCount++;
            }
        }
    }
    
    console.log(`\nListo. Se activó el switch 2x1 automáticamente en ${updatedCount} productos que lo decían en su nombre.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
