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
        const isCloudEnabled = !!process.env.FIREBASE_PROJECT_ID;
        console.log('[View Route] isCloudEnabled:', isCloudEnabled, 'key:', key);
        
        if (isCloudEnabled && !key.startsWith('local://')) {
            console.log('[View Route] Entering cloud redirect for key:', key);
            const { getSignedUrl } = await import('@/lib/storage');
            const signedUrl = await getSignedUrl(key);
            console.log('[View Route] Redirecting to signedUrl:', signedUrl);
            const absoluteUrl = new URL(signedUrl, req.url).toString();
            return NextResponse.redirect(absoluteUrl, { status: 307 });
        }
        console.log('[View Route] Bypassed cloud redirect, falling back to local for key:', key);

        // Si es local, buscar y retornar el buffer directamente
        const lookupKey = key.startsWith('local://') ? key : `local://${key}`;
        const buffer = await getFileBuffer(lookupKey);

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
