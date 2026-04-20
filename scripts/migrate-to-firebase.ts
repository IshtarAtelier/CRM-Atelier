import { PrismaClient } from '@prisma/client';
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

    if (!projectId || !clientEmail || !privateKey || !storageBucket) {
        console.error('❌ Missing Firebase credentials in .env');
        process.exit(1);
    }

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
        }),
        storageBucket
    });
}

const bucket = admin.storage().bucket();

async function migrateBase64ToFirebase() {
    console.log('🚀 Starting migration of Base64 images to Firebase Storage...');

    let migratedPrescriptions = 0;
    let migratedPayments = 0;
    let migratedDoctorPayments = 0;
    let migratedCashMovements = 0;
    let errors = 0;

    async function uploadBase64(base64Data: string, folder: string, filename: string): Promise<string | null> {
        if (!base64Data || !base64Data.startsWith('data:image/')) return null;

        try {
            // Extract content type and base64 string
            const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) return null;

            const contentType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            const fileExtension = contentType.split('/')[1] || 'jpg';
            const finalPath = `${folder}/${filename}.${fileExtension}`;

            const file = bucket.file(finalPath);
            await file.save(buffer, {
                metadata: { contentType },
                public: false,
            });

            console.log(` ✅ Uploaded to ${finalPath}`);
            return finalPath;
        } catch (e: any) {
            console.error(` ❌ Failed to upload ${filename}:`, e.message);
            errors++;
            return null;
        }
    }

    // 1. Migrate Prescriptions
    console.log('\n--- Checking Prescriptions ---');
    const prescriptions = await prisma.prescription.findMany({
        where: { imageUrl: { startsWith: 'data:image/' } }
    });
    console.log(`Found ${prescriptions.length} prescriptions with Base64 images.`);

    for (const rx of prescriptions) {
        const newUrl = await uploadBase64(rx.imageUrl!, 'prescriptions', `migrated_${rx.id}`);
        if (newUrl) {
            await prisma.prescription.update({
                where: { id: rx.id },
                data: { imageUrl: newUrl }
            });
            migratedPrescriptions++;
        }
    }

    // 2. Migrate Payments
    console.log('\n--- Checking Client Payments ---');
    const payments = await prisma.payment.findMany({
        where: { receiptUrl: { startsWith: 'data:image/' } }
    });
    console.log(`Found ${payments.length} payments with Base64 receipts.`);

    for (const p of payments) {
        const newUrl = await uploadBase64(p.receiptUrl!, 'payments', `migrated_${p.id}`);
        if (newUrl) {
            await prisma.payment.update({
                where: { id: p.id },
                data: { receiptUrl: newUrl }
            });
            migratedPayments++;
        }
    }

    // 3. Migrate Doctor Payments
    console.log('\n--- Checking Doctor Payments ---');
    const doctorPayments = await prisma.doctorPayment.findMany({
        where: { receiptUrl: { startsWith: 'data:image/' } }
    });
    console.log(`Found ${doctorPayments.length} doctor payments with Base64 receipts.`);

    for (const dp of doctorPayments) {
        const newUrl = await uploadBase64(dp.receiptUrl!, 'doctor-payments', `migrated_${dp.id}`);
        if (newUrl) {
            await prisma.doctorPayment.update({
                where: { id: dp.id },
                data: { receiptUrl: newUrl }
            });
            migratedDoctorPayments++;
        }
    }

    // 4. Migrate Cash Movements
    console.log('\n--- Checking Cash Movements ---');
    const cashMovements = await prisma.cashMovement.findMany({
        where: { receiptUrl: { startsWith: 'data:image/' } }
    });
    console.log(`Found ${cashMovements.length} cash movements with Base64 receipts.`);

    for (const cm of cashMovements) {
        const newUrl = await uploadBase64(cm.receiptUrl!, 'cash-movements', `migrated_${cm.id}`);
        if (newUrl) {
            await prisma.cashMovement.update({
                where: { id: cm.id },
                data: { receiptUrl: newUrl }
            });
            migratedCashMovements++;
        }
    }

    console.log('\n--- MIGRATION COMPLETE ---');
    console.log(`✅ Prescriptions migrated: ${migratedPrescriptions}`);
    console.log(`✅ Client Payments migrated: ${migratedPayments}`);
    console.log(`✅ Doctor Payments migrated: ${migratedDoctorPayments}`);
    console.log(`✅ Cash Movements migrated: ${migratedCashMovements}`);
    console.log(`❌ Errors encountered: ${errors}`);

    await prisma.$disconnect();
}

migrateBase64ToFirebase()
    .catch(e => {
        console.error('Fatal migration error:', e);
        process.exit(1);
    });
