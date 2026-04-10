const { PrismaClient } = require('./prisma/generated/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('ishtar123', 10);
    
    const user = await prisma.user.upsert({
        where: { email: 'ishtar' },
        update: { password: hashedPassword },
        create: {
            email: 'ishtar',
            name: 'Administrador Local',
            password: hashedPassword,
            role: 'ADMIN'
        }
    });
    
    console.log('User ishtar updated/created with password: ishtar123');
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
