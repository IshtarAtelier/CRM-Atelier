import { NextRequest, NextResponse } from 'next/server';
import { getFileBuffer } from '@/lib/storage';
import { isPathTraversalKey } from '@/lib/utils/storage';
import { decrypt } from '@/lib/auth';
import path from 'path';

/**
 * Seguridad (auditoría 20/8, A1): esta ruta está fuera del middleware a
 * propósito (las imágenes del catálogo público viven acá y las pide cualquier
 * visitante), pero el MISMO directorio guarda documentos sensibles: audios y
 * fotos de chats de WhatsApp, recetas médicas y comprobantes. Servirlos sin
 * sesión era una fuga de PII con solo conocer la key.
 *
 * Regla: si la key matchea un patrón sensible, exige cookie de sesión válida.
 * El catálogo (avif/webp de productos) sigue público.
 */
const SENSITIVE_KEY = /_wa_|receta|receipt|comprobante|prescripcion|prescription|\.pdf$|\.ogg$/i;

export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) {
        return new NextResponse('Missing key', { status: 400 });
    }

    // Seguridad: bloquear SOLO el traversal real (un ".." o "." como segmento de
    // ruta). Un ".." dentro del nombre del archivo es legítimo — ver
    // isPathTraversalKey. La defensa de fondo sigue siendo la contención dentro
    // del directorio de storage, que es la que de verdad garantiza el límite.
    const cleanKey = key.replace('local://', '');
    if (isPathTraversalKey(cleanKey)) {
        return new NextResponse('Forbidden: Invalid key', { status: 403 });
    }
    if (SENSITIVE_KEY.test(cleanKey)) {
        const token = req.cookies.get('session')?.value;
        const session = token ? await decrypt(token) : null;
        if (!session?.id) {
            return new NextResponse('No autorizado', { status: 401 });
        }
    }

    const storageDir = path.resolve(process.cwd(), 'storage', 'uploads');
    const resolvedPath = path.resolve(storageDir, cleanKey);
    // Con separador: sin él, "storage/uploads-otro" pasaría el startsWith.
    if (resolvedPath !== storageDir && !resolvedPath.startsWith(storageDir + path.sep)) {
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
                'Cache-Control': SENSITIVE_KEY.test(cleanKey)
                    ? 'private, no-store'
                    : 'public, max-age=31536000, immutable'
            }
        });
    } catch (error) {
        console.error('Error serving storage file:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
