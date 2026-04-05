const { PrismaClient } = require("./prisma/generated/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany();
    console.log("Users:", users);
    const cash = await prisma.cashMovement.findMany();
    console.log("Cash movements:", cash.length);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
