import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import { getSignedUrl } from '@/lib/storage';

/**
 * Esta ruta sirve como proxy para archivos almacenados.
 * - Si el archivo está en Firebase (cloud), redirige al signed URL.
 * - Si el archivo está en el filesystem local, lo sirve directamente.
 * Solo es accesible si el usuario está autenticado (protegido por middleware).
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
        return new NextResponse('Falta el parámetro key', { status: 400 });
    }

    try {
        // Sanitizar el key para evitar Directory Traversal
        const safeKey = key.replace(/\.\./g, '');

        // 1) Intentar servir desde el filesystem local primero
        const storageDir = path.join(process.cwd(), 'storage', 'uploads');
        const filepath = path.join(storageDir, safeKey);

        if (fs.existsSync(filepath)) {
            const buffer = await readFile(filepath);
            
            const ext = path.extname(filepath).toLowerCase();
            const contentTypes: Record<string, string> = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.pdf': 'application/pdf',
            };

            const contentType = contentTypes[ext] || 'application/octet-stream';

            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'private, max-age=3600',
                },
            });
        }

        // 2) No está en local -> obtener signed URL de Firebase y redirigir
        const signedUrl = await getSignedUrl(safeKey);
        
        if (signedUrl && signedUrl.startsWith('http')) {
            return NextResponse.redirect(signedUrl);
        }

        // 3) Fallback: ni local ni cloud
        console.error('Archivo no encontrado en local ni en Firebase:', safeKey);
        return new NextResponse('Archivo no encontrado', { status: 404 });
    } catch (error) {
        console.error('Error sirviendo archivo:', error);
        return new NextResponse('Error interno', { status: 500 });
    }
}
