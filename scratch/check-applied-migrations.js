process.env.DATABASE_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Connected to production database.");
  try {
    const res = await prisma.$queryRaw`SELECT migration_name, applied_steps_count FROM _prisma_migrations ORDER BY finished_at ASC`;
    console.log("Migrations in _prisma_migrations:");
    res.forEach(row => {
      console.log(`- ${row.migration_name} (applied steps: ${row.applied_steps_count})`);
    });
  } catch (err) {
    console.error("Error querying migrations table:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
