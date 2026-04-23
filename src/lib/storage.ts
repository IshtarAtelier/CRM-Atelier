import * as admin from 'firebase-admin';
import { writeFile, mkdir, unlink, readdir, stat } from "fs/promises";
import path from "path";

// Configuración de Firebase desde variables de entorno
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// Reparar saltos de línea literales en la llave privada si vienen del .env
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

// ¿Estamos en modo Nube (Firebase)?
const isCloudEnabled = !!(projectId && clientEmail && privateKey && storageBucket);

// Inicializar Firebase Admin SDK (solo una vez)
if (isCloudEnabled && !admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
        }),
        storageBucket
    });
}

/**
 * Sube un archivo al almacenamiento (Cloud o Local)
 */
export async function uploadFile(buffer: Buffer, filename: string, contentType: string): Promise<string> {
    if (isCloudEnabled) {
        const bucket = admin.storage().bucket();
        const file = bucket.file(filename);
        await file.save(buffer, {
            metadata: { contentType }
        });
        return filename; // En la nube guardamos el KEY (nombre) como referencia
    } else {
        // MODO LOCAL (Simulación para desarrollo)
        const storageDir = path.join(process.cwd(), 'storage', 'uploads');
        await mkdir(storageDir, { recursive: true });
        const filepath = path.join(storageDir, filename);
        await writeFile(filepath, buffer);
        return `local://${filename}`; // Prefijo para saber que es local
    }
}

/**
 * Genera una URL segura para visualizar el archivo
 */
export async function getSignedUrl(key: string): Promise<string> {
    // Si es una ruta antigua (legacy de public/uploads)
    if (key.startsWith('/uploads/')) {
        return key;
    }

    if (key.startsWith('local://')) {
        const pureKey = key.replace('local://', '');
        // Usaremos una ruta de API interna para servir archivos locales de forma "segura"
        return `/api/storage/view?key=${encodeURIComponent(pureKey)}`;
    }

    if (isCloudEnabled) {
        const bucket = admin.storage().bucket();
        const file = bucket.file(key);
        try {
            const [url] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + 3600 * 1000 // Válida por 1 hora
            });
            return url;
        } catch (error) {
            console.error("Error generating Firebase signed URL:", error);
            // Fallback a ruta raw si configuraron el bucket púbicamente, o devolvemos un placeholder
            return `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(key)}?alt=media`;
        }
    }

    // Fallback local por si acaso
    return `/api/storage/view?key=${encodeURIComponent(key)}`;
}

/**
 * Lista archivos con un prefijo específico
 */
export async function listFiles(prefix: string): Promise<{ key: string, size?: number, lastModified?: Date }[]> {
    if (isCloudEnabled) {
        try {
            const bucket = admin.storage().bucket();
            const [files] = await bucket.getFiles({ prefix });
            
            return files.map(file => ({
                key: file.name,
                size: Number(file.metadata.size || 0),
                lastModified: file.metadata.updated ? new Date(file.metadata.updated) : undefined
            }));
        } catch (error) {
            console.error("Error listing Firebase files:", error);
            return [];
        }
    } else {
        // Fallback local
        const storageDir = path.join(process.cwd(), 'storage', 'uploads');
        try {
            const files = await readdir(storageDir);
            const result = [];
            for (const file of files) {
                if (file.startsWith(prefix)) {
                    const fileStat = await stat(path.join(storageDir, file));
                    result.push({
                        key: `local://${file}`,
                        size: fileStat.size,
                        lastModified: fileStat.mtime
                    });
                }
            }
            return result;
        } catch (error) {
            return [];
        }
    }
}

/**
 * Elimina un archivo del almacenamiento
 */
export async function deleteFile(key: string): Promise<void> {
    if (key.startsWith('local://')) {
        const pureKey = key.replace('local://', '');
        const filepath = path.join(process.cwd(), 'storage', 'uploads', pureKey);
        try {
            await unlink(filepath);
        } catch (error) {
            console.error("Error deleting local file:", error);
        }
        return;
    }

    if (isCloudEnabled) {
        try {
            const bucket = admin.storage().bucket();
            await bucket.file(key).delete();
        } catch (error) {
            console.error("Error deleting Firebase file:", error);
        }
    }
}

/**
 * Gets a file as Buffer (for server-side processing like AI OCR)
 */
export async function getFileBuffer(key: string): Promise<Buffer | null> {
    if (key.startsWith('local://')) {
        const pureKey = key.replace('local://', '');
        const filepath = path.join(process.cwd(), 'storage', 'uploads', pureKey);
        try {
            const { readFile } = await import('fs/promises');
            return await readFile(filepath);
        } catch (error) {
            console.error('Error reading local file buffer:', error);
            return null;
        }
    }

    if (isCloudEnabled) {
        try {
            const bucket = admin.storage().bucket();
            const [buffer] = await bucket.file(key).download();
            return buffer;
        } catch (error) {
            console.error('Error downloading Cloud file buffer:', error);
            return null;
        }
    }

    return null;
}
