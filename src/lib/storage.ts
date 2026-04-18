import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as s3GetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { writeFile, mkdir, readFile, unlink, readdir, stat } from "fs/promises";
import path from "path";

// Configuración desde variables de entorno
const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
const region = process.env.STORAGE_REGION || "auto";
const bucketName = process.env.STORAGE_BUCKET_NAME;
const endpoint = process.env.STORAGE_ENDPOINT;

// ¿Estamos en modo S3/R2?
const isCloudEnabled = !!(accessKeyId && secretAccessKey && bucketName && endpoint);

// Cliente S3 (solo si está habilitado)
const s3Client = isCloudEnabled 
    ? new S3Client({
        region,
        endpoint,
        credentials: {
            accessKeyId: accessKeyId!,
            secretAccessKey: secretAccessKey!,
        },
        forcePathStyle: true, // Necesario para R2 y algunos otros
      })
    : null;

/**
 * Sube un archivo al almacenamiento (Cloud o Local)
 */
export async function uploadFile(buffer: Buffer, filename: string, contentType: string): Promise<string> {
    if (isCloudEnabled && s3Client) {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: filename,
            Body: buffer,
            ContentType: contentType,
        });
        await s3Client.send(command);
        return filename; // En la nube guardamos el KEY como referencia
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

    if (isCloudEnabled && s3Client) {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });
        // URL válida por 1 hora
        return await s3GetSignedUrl(s3Client, command, { expiresIn: 3600 });
    }

    // Fallback: si no hay cloud y el key no tiene prefijo, probamos como local por si acaso
    return `/api/storage/view?key=${encodeURIComponent(key)}`;
}

/**
 * Lista archivos con un prefijo específico
 */
export async function listFiles(prefix: string): Promise<{ key: string, size?: number, lastModified?: Date }[]> {
    if (isCloudEnabled && s3Client) {
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix
        });
        
        try {
            const response = await s3Client.send(command);
            return (response.Contents || []).map(item => ({
                key: item.Key || '',
                size: item.Size,
                lastModified: item.LastModified
            }));
        } catch (error) {
            console.error("Error listing S3 files:", error);
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

    if (isCloudEnabled && s3Client) {
        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
        });
        try {
            await s3Client.send(command);
        } catch (error) {
            console.error("Error deleting S3 file:", error);
        }
    }
}
