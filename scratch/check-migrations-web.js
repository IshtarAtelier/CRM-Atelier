const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway"
    }
  }
});

async function main() {
  try {
    // Check columns of Client table
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Client'
    `;
    console.log("Client columns in Web Database:");
    console.log(columns);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
