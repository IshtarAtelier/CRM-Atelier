import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import fs from 'fs';

/**
 * Esta ruta sirve como proxy para archivos locales que no están en public/
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
        const storageDir = path.join(process.cwd(), 'storage', 'uploads');
        const filepath = path.join(storageDir, safeKey);

        if (!fs.existsSync(filepath)) {
            console.error('Archivo no encontrado:', filepath);
            return new NextResponse('Archivo no encontrado', { status: 404 });
        }

        const buffer = await readFile(filepath);
        
        // Determinar Content-Type básico
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
    } catch (error) {
        console.error('Error sirviendo archivo local:', error);
        return new NextResponse('Error interno', { status: 500 });
    }
}
