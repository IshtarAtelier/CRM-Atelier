import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findBrokenLinks() {
    console.log('--- Prescriptions with local:// ---');
    const prescriptions = await prisma.prescription.findMany({
        where: { imageUrl: { startsWith: 'local://' } },
        include: { client: true }
    });
    prescriptions.forEach(rx => {
        console.log(`ID: ${rx.id}, Client: ${rx.client.name}, Key: ${rx.imageUrl}`);
    });

    console.log('\n--- Payments with local:// ---');
    const payments = await prisma.payment.findMany({
        where: { receiptUrl: { startsWith: 'local://' } },
        include: { order: { include: { client: true } } }
    });
    payments.forEach(p => {
        console.log(`ID: ${p.id}, Client: ${p.order.client.name}, Amount: ${p.amount}, Key: ${p.receiptUrl}`);
    });

    await prisma.$disconnect();
}

findBrokenLinks();
