const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const prescriptions = await prisma.prescription.findMany({
    where: { clientId: 'cmpii03s2000noj189fm608q6' }
  });
  console.log("All prescriptions for this client:", JSON.stringify(prescriptions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
