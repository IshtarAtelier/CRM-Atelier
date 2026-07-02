import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('perla2026', 10);
  await prisma.user.updateMany({
    where: { name: 'Matias Turchi' },
    data: { password: hashedPassword }
  });
  console.log('Password updated successfully');
}
main().finally(() => prisma.$disconnect());
