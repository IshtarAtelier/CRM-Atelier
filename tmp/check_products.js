
const { PrismaClient } = require('../prisma/generated/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany();
  const types = {};
  const categories = {};
  
  products.forEach(p => {
    types[p.type] = (types[p.type] || 0) + 1;
    categories[p.category] = (categories[p.category] || 0) + 1;
  });
  
  console.log('Types counts:', types);
  console.log('Categories counts:', categories);
  
  const frames = products.filter(p => p.type === 'Armazón' || p.category === 'FRAME');
  console.log('Total frames found with current logic:', frames.length);
  
  if (frames.length > 0) {
    console.log('Example frame:', {
      name: frames[0].name,
      type: frames[0].type,
      category: frames[0].category,
      brand: frames[0].brand,
      stock: frames[0].stock
    });
  }

  const atelierFrames = products.filter(p => (p.brand || '').toLowerCase().includes('atelier'));
  console.log('Total Atelier products:', atelierFrames.length);
  if (atelierFrames.length > 0) {
      console.log('Example Atelier product:', {
          name: atelierFrames[0].name,
          type: atelierFrames[0].type,
          category: atelierFrames[0].category,
          brand: atelierFrames[0].brand,
          stock: atelierFrames[0].stock
      });
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
