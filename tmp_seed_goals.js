const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targets = [
    { month: 1, year: 2026, target1: 18000000, target2: 24000000, target3: 30000000 },
    { month: 2, year: 2026, target1: 18000000, target2: 24000000, target3: 30000000 },
    { month: 3, year: 2026, target1: 18000000, target2: 24000000, target3: 30000000 },
    { month: 4, year: 2026, target1: 18000000, target2: 24000000, target3: 30000000 },
  ];

  console.log('Seeding monthly targets...');

  for (const t of targets) {
    try {
      // Using raw query to avoid issues if Prisma Client is out of date
      await prisma.$executeRaw`
        INSERT INTO "MonthlyTarget" (id, month, year, target1, target2, target3, "createdAt", "updatedAt")
        VALUES (
          ${Math.random().toString(36).substring(7)}, 
          ${t.month}, 
          ${t.year}, 
          ${t.target1}, 
          ${t.target2}, 
          ${t.target3}, 
          CURRENT_TIMESTAMP, 
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(month, year) DO UPDATE SET
          target1 = EXCLUDED.target1,
          target2 = EXCLUDED.target2,
          target3 = EXCLUDED.target3,
          "updatedAt" = CURRENT_TIMESTAMP;
      `;
      console.log(`Upserted target for ${t.month}/${t.year}`);
    } catch (e) {
      console.error(`Error for ${t.month}/${t.year}:`, e.message);
    }
  }

  await prisma.$disconnect();
}

main();
