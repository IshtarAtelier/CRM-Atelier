const { PrismaClient } = require('./prisma/generated/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('atelier', 10);

    // Admin: ishtar
    const admin = await prisma.user.upsert({
        where: { email: 'ishtar' },
        update: {
            password: hashedPassword,
            role: 'ADMIN',
            name: 'Ishtar',
        },
        create: {
            name: 'Ishtar',
            email: 'ishtar',
            password: hashedPassword,
            role: 'ADMIN',
        },
    });

    // Vendedor: matias
    const staff = await prisma.user.upsert({
        where: { email: 'matias' },
        update: {
            password: hashedPassword,
            role: 'STAFF',
            name: 'Matías',
        },
        create: {
            name: 'Matías',
            email: 'matias',
            password: hashedPassword,
            role: 'STAFF',
        },
    });

    console.log('✅ Admin creado:', admin.email, '- Rol:', admin.role);
    console.log('✅ Vendedor creado:', staff.email, '- Rol:', staff.role);
    console.log('');
    console.log('Credenciales:');
    console.log('  Admin    → Usuario: ishtar   | Contraseña: atelier');
    console.log('  Vendedor → Usuario: matias   | Contraseña: atelier');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
