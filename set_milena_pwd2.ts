import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('zafiro2026', 10);
  const result = await prisma.user.updateMany({
    where: { name: 'Milena Magallanes ' },
    data: { password: hashedPassword }
  });
  console.log(`Password updated successfully for ${result.count} users.`);
}
main().finally(() => prisma.$disconnect());
