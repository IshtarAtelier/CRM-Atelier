import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectRecords() {
    console.log('--- Prescriptions ---');
    const prescriptions = await prisma.prescription.findMany({ take: 10, select: { id: true, imageUrl: true } });
    prescriptions.forEach(r => console.log(`ID: ${r.id}, ImageURL: ${r.imageUrl?.substring(0, 50)}...`));

    console.log('\n--- Payments ---');
    const payments = await prisma.payment.findMany({ take: 10, select: { id: true, receiptUrl: true } });
    payments.forEach(p => console.log(`ID: ${p.id}, ReceiptURL: ${p.receiptUrl?.substring(0, 50)}...`));

    await prisma.$disconnect();
}

inspectRecords();
