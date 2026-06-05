import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Get OPTOVISION config
    const optovision = await prisma.laboratoryConfig.findFirst({
        where: { name: { equals: 'OPTOVISION', mode: 'insensitive' } }
    });

    let iva = optovision ? (optovision.iva || 0) : 21; // Optovision always has IVA
    let calibrado = optovision ? (optovision.calibrado || 0) : 0;

    const listCost = 20000;
    const finalCost = Math.round((listCost + calibrado) * (1 + iva / 100));
    const salePrice = Math.round(finalCost * 2.4);

    console.log(`Configuración OPTOVISION: IVA=${iva}%, Calibrado=$${calibrado}`);
    console.log(`Costo Lista: $${listCost}`);
    console.log(`Costo Final: $${finalCost}`);
    console.log(`Precio Venta (x2.4): $${salePrice}`);

    // 2. Create the Product
    const newProduct = await prisma.product.create({
        data: {
            name: 'Teñido de Cristales',
            model: 'Según Muestra',
            category: 'Tratamiento',
            type: 'Tratamiento Tratamientos',
            laboratory: 'OPTOVISION',
            unitType: 'PAR',
            stock: 0,
            cost: finalCost,
            price: salePrice,
            is2x1: false,
            publishToWeb: false
        }
    });

    console.log('Producto creado exitosamente:', newProduct);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
