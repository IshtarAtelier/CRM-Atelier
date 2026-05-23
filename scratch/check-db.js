process.env.DATABASE_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Connecting to production database...");
  try {
    const clients = await prisma.client.count();
    const orders = await prisma.order.count();
    const products = await prisma.product.count();
    const users = await prisma.user.count();
    const prescriptions = await prisma.prescription.count();

    console.log("Database status:");
    console.log(`- Clients: ${clients}`);
    console.log(`- Orders: ${orders}`);
    console.log(`- Products: ${products}`);
    console.log(`- Users: ${users}`);
    console.log(`- Prescriptions: ${prescriptions}`);
  } catch (err) {
    console.error("Error querying database:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
