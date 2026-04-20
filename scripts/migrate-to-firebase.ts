import { PrismaClient } from '@prisma/client';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// 1. Initialize Prisma
const prisma = new PrismaClient();

// 2. Initialize Firebase
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

if (!projectId || !clientEmail || !privateKey || !storageBucket) {
    console.error('❌ Missing Firebase environment variables.');
    process.exit(1);
}

if (!admin.apps.length) {
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

async function uploadToFirebase(buffer: Buffer, filename: string, contentType: string): Promise<string> {
    const file = bucket.file(filename);
    await file.save(buffer, {
        metadata: { contentType }
    });
    return filename;
}

function getContentType(dataUri: string): string {
    const match = dataUri.match(/^data:(image\/[a-zA-Z]+);base64,/);
    return match ? match[1] : 'image/jpeg';
}

function base64ToBuffer(dataUri: string): Buffer {
    const base64 = dataUri.split(';base64,').pop();
    return Buffer.from(base64!, 'base64');
}

async function migrate() {
    console.log('🚀 Starting migration to Firebase Storage...');

    const models = [
        { name: 'Prescription', field: 'imageUrl', label: 'Recetas' },
        { name: 'CashMovement', field: 'receiptUrl', label: 'Comprobantes de Caja' },
        { name: 'Payment', field: 'receiptUrl', label: 'Abonos de Venta' },
        { name: 'DoctorPayment', field: 'receiptUrl', label: 'Pagos a Médicos' },
        { name: 'Order', field: 'smartLabScreenshot', label: 'Screenshots Lab' },
    ];

    let totalMigrated = 0;

    for (const model of models) {
        console.log(`\n--- Analizando ${model.label} (${model.name}) ---`);
        
        // Use any because Prisma types for dynamic model access are complex for a script
        const records = await (prisma as any)[model.name.charAt(0).toLowerCase() + model.name.slice(1)].findMany({
            where: {
                [model.field]: {
                    not: null,
                }
            }
        });

        console.log(`Encontrados ${records.length} registros con datos.`);

        for (const record of records) {
            const value = record[model.field];
            if (!value) continue;

            let buffer: Buffer | null = null;
            let contentType = 'image/jpeg';
            let extension = 'jpg';
            let filename = '';

            // CASE 1: BASE64
            if (value.startsWith('data:image')) {
                contentType = getContentType(value);
                extension = contentType.split('/')[1];
                buffer = base64ToBuffer(value);
                filename = `migration_${model.name}_${record.id}_${Date.now()}.${extension}`;
                console.log(`  [BASE64] Migrando ${model.name} ID: ${record.id}`);
            } 
            // CASE 2: LOCAL STORAGE (local://...)
            else if (value.startsWith('local://')) {
                const localFilename = value.replace('local://', '');
                const filePath = path.join(process.cwd(), 'storage', 'uploads', localFilename);
                if (fs.existsSync(filePath)) {
                    buffer = fs.readFileSync(filePath);
                    filename = localFilename; // Keep name for local files
                    extension = path.extname(localFilename).replace('.', '');
                    contentType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
                    console.log(`  [LOCAL] Migrando archivo local: ${localFilename}`);
                } else {
                    console.warn(`  ⚠️ Archivo local no encontrado: ${filePath}`);
                }
            }
            // CASE 3: OLD UPLOADS FOLDER (/uploads/...)
            else if (value.startsWith('/uploads/')) {
                const localFilename = value.replace('/uploads/', '');
                const filePath = path.join(process.cwd(), 'public', 'uploads', localFilename);
                if (fs.existsSync(filePath)) {
                    buffer = fs.readFileSync(filePath);
                    filename = localFilename;
                    extension = path.extname(localFilename).replace('.', '');
                    contentType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
                    console.log(`  [PUBLIC] Migrando archivo antiguo: ${localFilename}`);
                } else {
                    console.warn(`  ⚠️ Archivo antiguo no encontrado: ${filePath}`);
                }
            }

            if (buffer) {
                try {
                    const key = await uploadToFirebase(buffer, filename, contentType);
                    await (prisma as any)[model.name.charAt(0).toLowerCase() + model.name.slice(1)].update({
                        where: { id: record.id },
                        data: { [model.field]: key }
                    });
                    totalMigrated++;
                } catch (error) {
                    console.error(`  ❌ Error subiendo ${filename}:`, error);
                }
            }
        }
    }

    console.log(`\n✅ Migración finalizada. Total de imágenes movidas a Firebase: ${totalMigrated}`);
}

migrate()
    .catch(e => {
        console.error('❌ Error fatal en la migración:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
