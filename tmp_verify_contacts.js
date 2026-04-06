const { PrismaClient } = require('./prisma/generated/client');
const prisma = new PrismaClient();

async function checkClients() {
  const clientsToCheck = [
    { name: "Erika Spehar", dni: "35090859" },
    { name: "Laura Julieta Saez", dni: "38501083" },
    { name: "Graciela Pagliari" }
  ];

  console.log("\n=== Checking if clients exist in the new system ===\n");
  for (const c of clientsToCheck) {
    const found = await prisma.client.findFirst({
      where: {
        OR: [
          { name: { contains: c.name, mode: 'insensitive' } },
          ...(c.dni ? [{ dni: c.dni }] : [])
        ]
      }
    });
    if (found) {
      console.log(`✅ FOUND: "${found.name}" (ID: ${found.id}, DNI: ${found.dni || 'N/A'})`);
    } else {
      console.log(`❌ NOT FOUND: "${c.name}"`);
    }
  }
  console.log("\nDone.\n");
}

checkClients()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
