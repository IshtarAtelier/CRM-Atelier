import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
    console.log('--- DIAGNOSTIC START ---');
    
    // Check Prescriptions
    const prescriptions = await prisma.prescription.findMany({
        where: { imageUrl: { not: null } },
        select: { id: true, imageUrl: true }
    });
    console.log(`\nPrescriptions with imageUrl: ${prescriptions.length}`);
    prescriptions.slice(0, 10).forEach(p => console.log(`  - ID: ${p.id}, Length: ${p.imageUrl?.length}, URL Start: ${p.imageUrl?.substring(0, 50)}`));

    const base64Prescriptions = prescriptions.filter(p => p.imageUrl?.includes('data:image'));
    console.log(`Prescriptions with Base64: ${base64Prescriptions.length}`);
    
    const base64Payments = payments.filter(p => p.receiptUrl?.includes('data:image'));
    console.log(`Payments with Base64: ${base64Payments.length}`);

    // If no base64 found, show what WE DO HAVE for the first 20 records
    if (base64Prescriptions.length === 0) {
        console.log('\nSample Prescriptions URLs (Non-Base64):');
        prescriptions.slice(0, 20).forEach(p => console.log(`  - ${p.imageUrl}`));
    }

    console.log('\n--- DIAGNOSTIC END ---');
}

diagnose().finally(() => prisma.$disconnect());
