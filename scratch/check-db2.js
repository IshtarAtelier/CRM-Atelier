process.env.DATABASE_URL = "postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Connecting to Postgres-uInF database...");
  try {
    const clients = await prisma.client.count();
    const orders = await prisma.order.count();
    const products = await prisma.product.count();
    const users = await prisma.user.count();
    const prescriptions = await prisma.prescription.count();

    console.log("Postgres-uInF database status:");
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
