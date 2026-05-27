import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Iniciando actualización de categoría...");
    
    // Buscar si existe el producto Teñido
    const existing = await prisma.product.findFirst({
        where: { 
            name: { in: ['Teñido', 'teñido', 'Tenido', 'tenido'] },
        }
    });

    if (existing) {
        await prisma.product.update({
            where: { id: existing.id },
            data: { 
                category: 'Tratamientos y Accesorios',
                type: 'ADDON',
                price: 35000,
            }
        });
        console.log(`✅ Producto "Teñido" actualizado a la nueva categoría "Tratamientos y Accesorios". Precio actual: $35000`);
    } else {
        const product = await prisma.product.create({
            data: {
                name: 'Teñido',
                category: 'Tratamientos y Accesorios',
                type: 'ADDON',
                brand: 'Servicio',
                price: 35000,
                cost: 0,
                stock: 9999,
                unitType: 'SERVICIO',
                botLabel: 'Teñido de cristal',
            }
        });
        console.log(`✅ Producto "Teñido" creado en la nueva categoría "Tratamientos y Accesorios". Precio: $35000`);
    }
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
