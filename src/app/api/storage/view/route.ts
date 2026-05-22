import { NextRequest, NextResponse } from 'next/server';
import { getFileBuffer, getSignedUrl } from '@/lib/storage';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) {
        return new NextResponse('Missing key', { status: 400 });
    }

    try {
        // Si el archivo es local (o era local://), el key aquí vendrá sin prefijo
        // Pero lib/storage maneja local:// internamente.
        // Vamos a verificar si es un archivo de la nube para redirigir
        const isCloudEnabled = !!process.env.FIREBASE_PROJECT_ID;
        
        if (isCloudEnabled && !key.startsWith('local://')) {
            // Generar URL firmada temporal y redirigir
            const signedUrl = await getSignedUrl(key);
            if (signedUrl.startsWith('http')) {
                return NextResponse.redirect(signedUrl);
            }
        }

        // Si es local, lo servimos directamente leyendo el buffer
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
        else if (key.endsWith('.mp4')) contentType = 'video/mp4';
        else if (key.endsWith('.ogg')) contentType = 'audio/ogg';
        else if (key.endsWith('.pdf')) contentType = 'application/pdf';

        return new Response(buffer as any, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400'
            }
        });
    } catch (error) {
        console.error('Error serving storage file:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
