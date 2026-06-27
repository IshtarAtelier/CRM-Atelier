const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const proposedNames = [
  "Poseidon", "Dionisio", "Zeus", "Apolo", "Hermes",
  "Ares", "Hades", "Hefesto", "Helios", "Teseo",
  "Heracles", "Aquiles", "Perseo", "Ulises", "Cronos",
  "Prometeo", "Orfeo", "Eros", "Baco", "Atlas"
];

async function check() {
  const existing = await prisma.product.findMany({
    where: {
      name: { in: proposedNames }
    }
  });
  console.log(`Found ${existing.length} existing products with proposed names:`);
  existing.forEach(p => console.log(`  -> Name: ${p.name}, Model: ${p.model}, Brand: ${p.brand}`));
}

check().catch(console.error).finally(() => prisma.$disconnect());
