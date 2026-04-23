// Script para subir imágenes del blog a Firebase Storage
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load .env manually
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)="(.+)"$/);
    if (match) envVars[match[1]] = match[2];
});

const projectId = envVars.FIREBASE_PROJECT_ID;
const clientEmail = envVars.FIREBASE_CLIENT_EMAIL;
const privateKey = envVars.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const storageBucket = envVars.FIREBASE_STORAGE_BUCKET;

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        storageBucket
    });
}

const bucket = admin.storage().bucket();

async function uploadImage(localPath, remoteName) {
    const buffer = fs.readFileSync(localPath);
    const file = bucket.file(`blog/${remoteName}`);
    await file.save(buffer, {
        metadata: { contentType: 'image/png' },
        public: true
    });
    const publicUrl = `https://storage.googleapis.com/${storageBucket}/blog/${remoteName}`;
    console.log(`OK ${remoteName} -> ${publicUrl}`);
    return publicUrl;
}

async function main() {
    const imgDir = 'C:\\Users\\pisan\\.gemini\\antigravity\\brain\\a7415e1f-9246-44f2-828a-934032dcc579';
    
    const images = [
        { file: 'blog1_header_coleccion_1776894134925.png', name: 'blog1_header.png' },
        { file: 'blog1_marcos_geometricos_1776894151467.png', name: 'blog1_marcos.png' },
        { file: 'blog2_lentes_antiluz_1776894166565.png', name: 'blog2_header.png' },
        { file: 'blog2_home_office_1776894180542.png', name: 'blog2_homeoffice.png' },
        { file: 'blog3_guia_rostros_1776894195379.png', name: 'blog3_header.png' },
        { file: 'blog3_eligiendo_anteojos_1776894208930.png', name: 'blog3_eligiendo.png' },
        { file: 'blog4_lente_multifocal_1776894224014.png', name: 'blog4_header.png' },
        { file: 'blog4_adulto_leyendo_1776894236207.png', name: 'blog4_leyendo.png' },
        { file: 'blog5_tendencias_sol_1776894249830.png', name: 'blog5_header.png' },
        { file: 'blog5_cordoba_sol_1776894265955.png', name: 'blog5_cordoba.png' },
        { file: 'blog6_nino_escuela_1776894280623.png', name: 'blog6_header.png' },
        { file: 'blog6_consulta_optico_1776894302363.png', name: 'blog6_consulta.png' },
    ];

    console.log('Subiendo imagenes a Firebase Storage...\n');
    const urls = {};
    
    for (const img of images) {
        const fullPath = path.join(imgDir, img.file);
        if (fs.existsSync(fullPath)) {
            urls[img.name] = await uploadImage(fullPath, img.name);
        } else {
            console.log(`NOT FOUND: ${img.file}`);
        }
    }

    console.log('\nURLs generadas:');
    console.log(JSON.stringify(urls, null, 2));
    
    fs.writeFileSync(path.join(__dirname, 'blog-image-urls.json'), JSON.stringify(urls, null, 2));
    console.log('\nGuardadas en scripts/blog-image-urls.json');
}

main().catch(console.error);
