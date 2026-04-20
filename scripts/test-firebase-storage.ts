import * as admin from 'firebase-admin';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
        })
    });
}

async function run() {
    console.log('Fetching all buckets for project:', projectId);
    try {
        const storage = admin.storage();
        // In the admin SDK, you get the Storage object and then call getBuckets on it via the bucket() method's parent
        // or just use the bucket() constructor.
        // Actually, listing buckets requires 'resourcemanager.projects.get' or similar permissions.
        // Let's try the common API way:
        const [buckets] = await storage.getBuckets();
        
        if (buckets.length === 0) {
            console.log('❌ No buckets found in this project. Please enable "Storage" in Firebase Console.');
        } else {
            console.log('✅ Found buckets:');
            buckets.forEach(b => console.log(' -', b.name));
        }
    } catch (e: any) {
        console.error('❌ Error listing buckets:', e.message);
        console.log('\nThis usually means Cloud Storage is NOT enabled or the Service Account lacks permissions.');
    }
}

run();
