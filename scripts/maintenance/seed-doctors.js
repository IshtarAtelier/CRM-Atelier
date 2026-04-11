const { PrismaClient } = require('./prisma/generated/client');
const prisma = new PrismaClient();

async function main() {
    const doctors = [
        'Rafael Acosta',
        'Jemima Dermendieff'
    ];

    for (const name of doctors) {
        await prisma.doctor.upsert({
            where: { name },
            update: {},
            create: { name }
        });
        console.log(`✅ Médico "${name}" creado/verificado`);
    }

    console.log('\n🩺 Seed de médicos completado.');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
