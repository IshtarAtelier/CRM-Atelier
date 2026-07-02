const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const modelToHide = 'TL5217';
  
  console.log(`Buscando modelo ${modelToHide}...`);
  
  // Update Product
  const updatedProducts = await prisma.product.updateMany({
    where: { 
        name: { contains: modelToHide }
    },
    data: {
        stock: 0,
        publishToWeb: false
    }
  });
  
  console.log(`Productos actualizados en CRM: ${updatedProducts.count}`);

  // Update WebProduct
  const updatedWebProducts = await prisma.webProduct.updateMany({
    where: { 
        name: { contains: modelToHide }
    },
    data: {
        isActive: false
    }
  });
  
  console.log(`Productos ocultados en la Web: ${updatedWebProducts.count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
