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

async function testUpload() {
    console.log('Testing upload to bucket:', storageBucket);
    try {
        const bucket = admin.storage().bucket();
        const file = bucket.file('test-connection.txt');
        await file.save('Connection working!', {
            metadata: { contentType: 'text/plain' }
        });
        console.log('✅ UPLOAD SUCCESSFUL!');
        
        // Cleanup
        await file.delete();
        console.log('✅ DELETE SUCCESSFUL!');
    } catch (e: any) {
        console.error('❌ UPLOAD FAILED:', e.message);
    }
}

testUpload();
