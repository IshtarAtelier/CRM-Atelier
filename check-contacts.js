const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const contacts = await prisma.client.findMany({
    where: {
      createdAt: {
        gte: today
      }
    }
  });

  console.log(`Total created today: ${contacts.length}`);
  if (contacts.length > 0) {
    console.log("Sample contact:");
    console.log(contacts[0]);
    
    // Group by contactSource
    const sources = contacts.reduce((acc, c) => {
      acc[c.contactSource] = (acc[c.contactSource] || 0) + 1;
      return acc;
    }, {});
    console.log("Sources:", sources);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
