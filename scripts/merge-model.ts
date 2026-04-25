import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Iniciando unificación de 'modelo' en 'nombre' para cristales...");
    
    const crystals = await prisma.product.findMany({
        where: {
            OR: [
                { category: 'Cristal' },
                { category: 'LENS' },
            ]
        }
    });

    let updatedCount = 0;

    for (const product of crystals) {
        if (product.model && product.model.trim() !== '') {
            const modelStr = product.model.trim();
            let newName = product.name ? product.name.trim() : '';

            // Check if name already contains the model to avoid duplication
            if (newName.toLowerCase().includes(modelStr.toLowerCase())) {
                // Ya lo contiene, simplemente borramos el modelo
                await prisma.product.update({
                    where: { id: product.id },
                    data: { model: '' }
                });
                console.log(`- Limpiado modelo repetido: ID ${product.id} (Nombre ya tenía '${modelStr}')`);
                updatedCount++;
            } else {
                // Merge model into name
                if (newName) {
                    newName = `${newName} - ${modelStr}`;
                } else {
                    newName = modelStr;
                }
                
                await prisma.product.update({
                    where: { id: product.id },
                    data: { name: newName, model: '' }
                });
                console.log(`- Fusionado: ID ${product.id} -> Nuevo nombre: '${newName}'`);
                updatedCount++;
            }
        }
    }

    console.log(`\nMigración completada. Se actualizaron ${updatedCount} cristales.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
