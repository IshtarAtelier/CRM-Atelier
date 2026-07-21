import { NextRequest, NextResponse } from 'next/server';
import { getFileBuffer } from '@/lib/storage';
import path from 'path';

export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) {
        return new NextResponse('Missing key', { status: 400 });
    }

    // Security: Sanitize key to prevent path traversal attacks
    const cleanKey = key.replace('local://', '');
    if (cleanKey.includes('..') || cleanKey.includes('\\')) {
        return new NextResponse('Forbidden: Invalid key', { status: 403 });
    }
    const storageDir = path.resolve(process.cwd(), 'storage', 'uploads');
    const resolvedPath = path.resolve(storageDir, cleanKey);
    if (!resolvedPath.startsWith(storageDir)) {
        return new NextResponse('Forbidden: Path traversal detected', { status: 403 });
    }

    try {
        // Nota: NO redirigir (307) a la URL firmada de Firebase — el optimizador de
        // imágenes de Next.js resuelve rutas relativas invocando este handler en
        // proceso (sin seguir redirects), así que espera bytes + 200, no un 3xx.
        // Devolver siempre el buffer directo funciona igual para <img> normal y
        // para /_next/image.
        const buffer = await getFileBuffer(key);

        if (!buffer) {
            return new NextResponse('File not found', { status: 404 });
        }

        // Adivinar el tipo de contenido básico
        let contentType = 'application/octet-stream';
        if (key.endsWith('.jpg') || key.endsWith('.jpeg')) contentType = 'image/jpeg';
        else if (key.endsWith('.png')) contentType = 'image/png';
        else if (key.endsWith('.webp')) contentType = 'image/webp';
        else if (key.endsWith('.avif')) contentType = 'image/avif';
        else if (key.endsWith('.mp4')) contentType = 'video/mp4';
        else if (key.endsWith('.ogg')) contentType = 'audio/ogg';
        else if (key.endsWith('.pdf')) contentType = 'application/pdf';

        return new Response(buffer as any, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });
    } catch (error) {
        console.error('Error serving storage file:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
