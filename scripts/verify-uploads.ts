import * as admin from 'firebase-admin';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

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

async function listFiles() {
    console.log('Listing files in bucket:', storageBucket);
    try {
        const bucket = admin.storage().bucket();
        const [files] = await bucket.getFiles({ prefix: 'prescriptions/' });
        console.log(`Found ${files.length} files in prescriptions/:`);
        files.forEach(f => {
            console.log(` - ${f.name} (${f.metadata.size} bytes, created: ${f.metadata.timeCreated})`);
        });
        
        const [allFiles] = await bucket.getFiles();
        if (allFiles.length > files.length) {
            console.log(`\nOther files:`);
            allFiles.filter(f => !f.name.startsWith('prescriptions/')).forEach(f => {
                console.log(` - ${f.name} (${f.metadata.size} bytes)`);
            });
        }
    } catch (e: any) {
        console.error('❌ FAILED TO LIST FILES:', e.message);
    }
}

listFiles();
