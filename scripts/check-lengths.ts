import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkHighLengthFields() {
    console.log('--- Prescriptions (Length > 1000) ---');
    const prescriptions = await prisma.prescription.findMany({
        where: { imageUrl: { not: null } }
    });
    prescriptions.forEach(rx => {
        if (rx.imageUrl && rx.imageUrl.length > 1000) {
            console.log(`ID: ${rx.id}, Length: ${rx.imageUrl.length}, Start: ${rx.imageUrl.substring(0, 50)}`);
        }
    });

    console.log('\n--- Payments (Length > 1000) ---');
    const payments = await prisma.payment.findMany({
        where: { receiptUrl: { not: null } }
    });
    payments.forEach(p => {
        if (p.receiptUrl && p.receiptUrl.length > 1000) {
            console.log(`ID: ${p.id}, Length: ${p.receiptUrl.length}, Start: ${p.receiptUrl.substring(0, 50)}`);
        }
    });

    await prisma.$disconnect();
}

checkHighLengthFields();
