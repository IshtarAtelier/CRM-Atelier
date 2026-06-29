const { PrismaClient } = require('@prisma/client');

// Local database client
const localPrisma = new PrismaClient();

// Production database client
const prodDbUrl = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";
const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: prodDbUrl
    }
  }
});

async function deleteFromDb(prismaInstance, dbName) {
  console.log(`\n--- Deleting 57202LJH-C31 from ${dbName} ---`);
  
  // Find product
  const product = await prismaInstance.product.findFirst({
    where: {
      model: '57202LJH-C31'
    },
    include: {
      webProducts: true
    }
  });

  if (!product) {
    console.log(`Product 57202LJH-C31 not found in ${dbName}. Skipping.`);
    return;
  }

  console.log(`Found Product in ${dbName}: ID=${product.id}, Name="${product.name}"`);

  // 1. Delete associated WebProducts
  if (product.webProducts.length > 0) {
    const webIds = product.webProducts.map(w => w.id);
    const deleteWeb = await prismaInstance.webProduct.deleteMany({
      where: {
        id: {
          in: webIds
        }
      }
    });
    console.log(`Deleted ${deleteWeb.count} associated WebProduct entries from ${dbName}.`);
  }

  // 2. Delete the Product entry itself
  const deleteProd = await prismaInstance.product.delete({
    where: {
      id: product.id
    }
  });
  console.log(`Deleted Product entry 57202LJH-C31 from ${dbName}.`);
}

async function main() {
  // Run for local database
  await deleteFromDb(localPrisma, "Local Database");
  
  // Run for production database
  await deleteFromDb(prodPrisma, "Production Database");

  await localPrisma.$disconnect();
  await prodPrisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Error running deletion script:", e);
  await localPrisma.$disconnect();
  await prodPrisma.$disconnect();
});
