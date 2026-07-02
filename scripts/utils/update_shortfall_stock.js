const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const items = [
  { model: '7103 C2', added: 1 },
  { model: 'Q5205-C8', added: 0 },
  { model: 'FG1643 C2', added: 4 },
  { model: 'TL5206 C4', added: 2 },
  { model: 'Q8013-C7', added: 4 },
  { model: '9004M C5', added: 0 },
  { model: 'R12221 C1', added: 0 },
  { model: 'TG2810 C4', added: 4 },
  { model: 'test', added: 0 },
  { model: 'HY238014 C4-1', added: 4 },
  { model: 'TL5207 C4', added: 0 },
  { model: '9001S C3', added: 3 },
  { model: 'MLT25029 C2', added: 1 },
  { model: 'MLT25029 C4', added: 3 },
  { model: '8125S C4', added: 3 }
];

async function main() {
  for (const item of items) {
    // We update stock to the real stock (added). If it's < 4, we also unpublish.
    const realStock = item.added;
    const publishToWeb = realStock >= 4;

    // We must find the product first, since model might be exact or have slight variations
    const products = await prisma.product.findMany({
      where: {
        model: {
          contains: item.model.replace('-', ' ').trim(),
          mode: 'insensitive'
        }
      }
    });

    if (products.length > 0) {
      for (const p of products) {
        await prisma.product.update({
          where: { id: p.id },
          data: {
            stock: realStock,
            publishToWeb: publishToWeb
          }
        });
        console.log(`Updated DB for ${p.model}: stock=${realStock}, publishToWeb=${publishToWeb}`);
      }
    } else {
      // try replacing space with dash
      const products2 = await prisma.product.findMany({
        where: {
          model: {
            contains: item.model.replace(' ', '-').trim(),
            mode: 'insensitive'
          }
        }
      });
      if (products2.length > 0) {
        for (const p of products2) {
          await prisma.product.update({
            where: { id: p.id },
            data: {
              stock: realStock,
              publishToWeb: publishToWeb
            }
          });
          console.log(`Updated DB for ${p.model}: stock=${realStock}, publishToWeb=${publishToWeb}`);
        }
      } else {
         console.log(`Could not find ${item.model} in DB.`);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
