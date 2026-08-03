import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/store/product-image?url=<url de la foto del producto>
 *
 * Devuelve la foto convertida a JPEG para que el bot pueda mandarla por WhatsApp.
 * Existe porque el catálogo del proveedor publica casi todo en AVIF (425 de 446
 * fotos) y WhatsApp no lo soporta: mandar la URL cruda le llega al cliente como
 * un archivo roto. El optimizador de Next tampoco sirve acá (responde 500 para
 * ese dominio), así que la conversión se hace en este handler con sharp.
 *
 * Vive bajo /api/store/ (público) y no bajo /api/bot/ (exige API key) porque
 * quien descarga esta URL es WhatsApp al mandarle la foto al cliente, sin
 * credenciales. Es la misma foto de catálogo que ya publica la tienda.
 */

// Solo se proxean fotos de estos hosts: sin la lista, este endpoint sería un
// proxy abierto para pedir cualquier URL desde el servidor (SSRF).
const HOSTS_PERMITIDOS = [
    'kazwiniopticalgroup.com',
    'atelieroptica.com.ar',
];

const MAX_BYTES = 12 * 1024 * 1024;

function hostPermitido(host: string): boolean {
    const limpio = host.toLowerCase();
    return HOSTS_PERMITIDOS.some(h => limpio === h || limpio.endsWith(`.${h}`));
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return new NextResponse('Missing url', { status: 400 });
    }

    let target: URL;
    try {
        target = new URL(url);
    } catch {
        return new NextResponse('URL inválida', { status: 400 });
    }

    if (target.protocol !== 'https:' || !hostPermitido(target.hostname)) {
        return new NextResponse('Host no permitido', { status: 403 });
    }

    try {
        const upstream = await fetch(target.toString(), {
            signal: AbortSignal.timeout(15000),
            headers: { Accept: 'image/*' },
        });

        if (!upstream.ok) {
            return new NextResponse('No se pudo obtener la imagen', { status: 502 });
        }

        const contentType = upstream.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) {
            return new NextResponse('El origen no devolvió una imagen', { status: 502 });
        }

        const buffer = Buffer.from(await upstream.arrayBuffer());
        if (buffer.byteLength > MAX_BYTES) {
            return new NextResponse('Imagen demasiado grande', { status: 413 });
        }

        const sharp = (await import('sharp')).default;
        // Fondo blanco: los armazones vienen con transparencia y JPEG no la
        // soporta — sin esto el fondo sale negro en el chat.
        const jpeg = await sharp(buffer)
            .flatten({ background: '#ffffff' })
            .resize({ width: 1080, withoutEnlargement: true })
            .jpeg({ quality: 82 })
            .toBuffer();

        return new NextResponse(jpeg as any, {
            headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=86400, s-maxage=604800',
            },
        });
    } catch (error: any) {
        console.error('[store/product-image] Error convirtiendo imagen:', error?.message);
        return new NextResponse('Error procesando la imagen', { status: 500 });
    }
}
