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

/**
 * Baja la imagen forzando IPv4.
 *
 * El host del proveedor publica registro AAAA, pero el servicio no tiene salida
 * IPv6 (ipv6EgressEnabled: false en Railway): con `fetch` normal la conexión
 * moría con un "fetch failed" seco en producción, mientras en local andaba
 * perfecto. `family: 4` obliga a resolver por IPv4, que sí tiene salida.
 */
function bajarPorIPv4(target: URL): Promise<{ buffer: Buffer; contentType: string }> {
    return new Promise((resolve, reject) => {
        import('node:https').then(({ default: https }) => {
            const req = https.get(
                {
                    hostname: target.hostname,
                    path: `${target.pathname}${target.search}`,
                    port: target.port || 443,
                    family: 4,
                    timeout: 15000,
                    headers: { Accept: 'image/*', 'User-Agent': 'AtelierOptica/1.0' },
                },
                (res) => {
                    if (!res.statusCode || res.statusCode >= 400) {
                        res.resume();
                        reject(new Error(`El origen respondió ${res.statusCode}`));
                        return;
                    }

                    const trozos: Buffer[] = [];
                    let total = 0;
                    res.on('data', (t: Buffer) => {
                        total += t.length;
                        if (total > MAX_BYTES) {
                            req.destroy();
                            reject(new Error('Imagen demasiado grande'));
                            return;
                        }
                        trozos.push(t);
                    });
                    res.on('end', () => resolve({
                        buffer: Buffer.concat(trozos),
                        contentType: (res.headers['content-type'] || '').split(';')[0].trim(),
                    }));
                    res.on('error', reject);
                }
            );

            req.on('timeout', () => { req.destroy(new Error('Timeout bajando la imagen')); });
            req.on('error', reject);
        }).catch(reject);
    });
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
        const { buffer, contentType } = await bajarPorIPv4(target);

        if (!contentType.startsWith('image/')) {
            return new NextResponse('El origen no devolvió una imagen', { status: 502 });
        }

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
        // La causa importa: "fetch failed" a secas no dice si fue DNS, TLS o red.
        console.error(
            '[store/product-image] Error convirtiendo imagen:',
            error?.message,
            error?.cause?.code || error?.code || '',
            target.hostname
        );
        return new NextResponse('Error procesando la imagen', { status: 500 });
    }
}
