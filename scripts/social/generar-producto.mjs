/**
 * Arma una pieza de PRODUCTO leyendo el catálogo real, en vez de escribirla a mano.
 *
 *   node scripts/social/generar-producto.mjs --destacados
 *   node scripts/social/generar-producto.mjs --marca "Cápsula Escarlata"
 *   node scripts/social/generar-producto.mjs --destacados --render
 *
 * Por qué existe: el nombre, el precio y la foto de un armazón ya viven en la
 * base — son los mismos que ve la tienda y el bot de WhatsApp. Copiarlos a mano
 * a un JSON es la forma de publicar, tarde o temprano, un precio viejo.
 *
 * La pieza sale marcada con `fuente: "base"`, que es lo único que hace que el
 * validador (regla R6) acepte precios. Una pieza escrita a mano con un precio
 * adentro NO renderiza. Así el error deja de ser posible en vez de ser "algo a
 * tener cuidado".
 *
 * Las fotos del catálogo son AVIF de un proveedor externo y el render necesita
 * archivos locales, así que se bajan y convierten a JPEG una sola vez, a un
 * caché en public/images/catalogo-social/ que se reutiliza entre corridas.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from './identidad.mjs';

const CACHE_FOTOS = path.join(RAIZ, 'public', 'images', 'catalogo-social');
const DESTINO = path.join(RAIZ, 'social', 'contenido');

const plata = (n) => `$${Math.round(n).toLocaleString('es-AR')}`;

/**
 * Baja la foto del proveedor y la deja como JPEG local.
 * Fuerza IPv4: el host del catálogo publica registro AAAA y desde un servidor
 * sin salida IPv6 el fetch muere con un "fetch failed" seco (ya nos pasó con
 * las fotos que manda el bot).
 */
async function fotoLocal(url, nombre) {
    const destino = path.join(CACHE_FOTOS, `${nombre}.jpg`);
    if (existsSync(destino)) return destino;

    const sharp = (await import('sharp')).default;
    await mkdir(CACHE_FOTOS, { recursive: true });

    // Parte del catálogo ya está en el repo ("/assets/products/...") y parte
    // vive en el proveedor. Se convierten igual —el render necesita JPEG y casi
    // todo el catálogo está en AVIF— pero la local no se baja por red.
    if (!/^https?:\/\//i.test(url)) {
        const local = path.join(RAIZ, 'public', url.replace(/^\//, ''));
        if (!existsSync(local)) {
            throw new Error(`la foto ${url} no existe en public/`);
        }
        await sharp(local)
            .flatten({ background: '#ffffff' })
            .resize({ width: 1400, withoutEnlargement: true })
            .jpeg({ quality: 90 })
            .toFile(destino);
        return destino;
    }

    const { default: https } = await import('node:https');
    const target = new URL(url);

    const bytes = await new Promise((resolve, reject) => {
        const req = https.get({
            hostname: target.hostname,
            path: `${target.pathname}${target.search}`,
            family: 4,
            timeout: 20000,
            headers: { Accept: 'image/*', 'User-Agent': 'AtelierOptica/1.0' },
        }, (res) => {
            if (!res.statusCode || res.statusCode >= 400) {
                res.resume();
                return reject(new Error(`el proveedor respondió ${res.statusCode}`));
            }
            const trozos = [];
            res.on('data', t => trozos.push(t));
            res.on('end', () => resolve(Buffer.concat(trozos)));
            res.on('error', reject);
        });
        req.on('timeout', () => req.destroy(new Error('timeout bajando la foto')));
        req.on('error', reject);
    });

    // Fondo blanco: los armazones vienen con transparencia y en JPEG el fondo
    // saldría negro.
    await sharp(bytes)
        .flatten({ background: '#ffffff' })
        .resize({ width: 1400, withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toFile(destino);

    return destino;
}

export async function generarPiezaDeProductos({ destacados = false, marca = null, limite = 3 } = {}) {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
        datasources: { db: { url: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL } },
    });

    try {
        const productos = await prisma.webProduct.findMany({
            where: {
                isActive: true,
                imageUrl: { not: null },
                ...(destacados ? { isFeatured: true } : {}),
            },
            include: { product: true },
            take: 200,
        });

        let elegidos = productos.filter(p => p.product && p.product.price > 0);
        if (marca) {
            const m = marca.toLowerCase();
            elegidos = elegidos.filter(p => (p.product.brand || '').toLowerCase().includes(m));
        }
        if (!elegidos.length) {
            throw new Error('Ningún producto activo con foto y precio para ese filtro.');
        }

        elegidos = elegidos.slice(0, limite);
        console.log(`Productos elegidos: ${elegidos.length}`);

        const slides = [];

        // Portada: la foto del primero, sin precio (el gancho no es el precio).
        const primero = elegidos[0];
        const fotoPortada = await fotoLocal(primero.imageUrl, `${primero.slug}`);
        console.log(`  ✅ foto: ${primero.name}`);

        slides.push({
            type: 'cover',
            role: 'portada',
            image: path.relative(path.join(RAIZ, 'public', 'images'), fotoPortada),
            title: marca ? `Armazones *${marca}*` : 'Los que más nos piden *esta temporada*',
            subtitle: 'Diseño de autor, en 6 cuotas sin interés y con envío sin cargo.',
        });

        // Las condiciones de pago se leen de DONDE LAS LEE LA TIENDA
        // (SystemSetting), con el mismo redondeo que PaymentOptions.tsx. Si la
        // fuente fuera otra, el carrusel diría un número y la ficha otro.
        const cond = await (async () => {
            const filas = await prisma.systemSetting.findMany({
                where: { key: { in: ['web_promo_installments', 'web_promo_cash_discount'] } },
                select: { key: true, value: true },
            });
            const get = (k) => filas.find(f => f.key === k)?.value;
            const texto = get('web_promo_installments') || '6 cuotas sin interés';
            const crudo = Number(get('web_promo_cash_discount'));
            return {
                cuotas: Number(texto.match(/\d+/)?.[0] || 6),
                textoCuotas: texto,
                descuento: Number.isFinite(crudo) && crudo > 0 ? crudo : 15,
            };
        })();
        console.log(`  · condiciones (de la tienda): ${cond.textoCuotas} · ${cond.descuento}% al contado`);

        // "Nashira C3" → "Nashira": el sufijo de color distingue variantes en
        // el catálogo; en una placa ensucia y el color se ve en la foto.
        const limpiar = (n) => String(n).replace(/\s+C\d+\s*$/i, '').trim();

        // Una slide por producto. EL PRIMER IMPACTO ES LA CUOTA, no el precio
        // de lista: el precio crudo solo no dice nada y no vende. Debajo, el
        // contado con el descuento. Mismo criterio que las stories de producto.
        for (const [i, p] of elegidos.entries()) {
            const foto = await fotoLocal(p.imageUrl, p.slug);
            console.log(`  ✅ foto: ${limpiar(p.name)}`);
            const cuota = Math.round(p.product.price / cond.cuotas);
            const alContado = Math.round(p.product.price * (1 - cond.descuento / 100));
            slides.push({
                type: 'number',
                // El primer producto es la bisagra: donde el carrusel gira de
                // "mirá estos" a "esto es lo que cuestan".
                ...(i === 0 ? { role: 'bisagra' } : {}),
                image: path.relative(path.join(RAIZ, 'public', 'images'), foto),
                // La marca se agrega solo si el nombre no la trae ya: en el
                // catálogo hay productos nombrados "Cápsula escarlata 91501" y
                // repetirla daba "Cápsula escarlata 91501 · Cápsula escarlata".
                title: limpiar(p.name) + (
                    p.product.brand && !limpiar(p.name).toLowerCase().includes(p.product.brand.toLowerCase())
                        ? ` · ${p.product.brand}` : ''
                ),
                dato: plata(cuota),
                body: `${cond.textoCuotas}\n${plata(alContado)} en efectivo o transferencia`,
            });
        }

        slides.push({
            type: 'cta',
            role: 'cierre',
            image: 'blog/fachada-ladrillo.jpg',
            title: 'Probátelos en el local',
            body: 'Cerro de las Rosas. También te los mostramos por WhatsApp si estás lejos.',
        });

        const id = marca
            ? `armazones-${marca.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}`
            : 'armazones-destacados';

        const pieza = {
            id,
            format: '4:5',
            theme: 'dark',
            pilar: 'producto',
            // La marca que habilita los precios en el validador (R6).
            fuente: 'base',
            // R1-R4 pasan a aviso: en un carrusel de catálogo cada slide ES un
            // armazón, y la foto del armazón no es decoración sino el producto.
            // Exigirle un 60% de slides sin imagen lo volvería otra cosa.
            // R5 (las fotos existen) y R6 (los precios salen de la base) NO se
            // eximen nunca, que son las que evitan publicar algo falso.
            images_waived: 'Carrusel de catálogo: cada slide es un armazón y su foto es el producto, no un fondo.',
            generado: new Date().toISOString().slice(0, 10),
            slides,
        };

        await mkdir(DESTINO, { recursive: true });
        const ruta = path.join(DESTINO, `${id}.json`);
        await writeFile(ruta, JSON.stringify(pieza, null, 2) + '\n');

        console.log(`\nPieza escrita: social/contenido/${id}.json`);
        console.log(`Precios tomados de la base HOY (${pieza.generado}).`);
        return { ruta, pieza };
    } finally {
        await prisma.$disconnect();
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    const marcaIdx = args.indexOf('--marca');
    const r = await generarPiezaDeProductos({
        destacados: args.includes('--destacados'),
        marca: marcaIdx !== -1 ? args[marcaIdx + 1] : null,
    });

    if (args.includes('--render')) {
        const { renderizarPieza } = await import('./render.mjs');
        console.log('');
        await renderizarPieza(r.ruta);
    } else {
        console.log('Para generar las imágenes:');
        console.log(`  node scripts/social/render.mjs ${path.relative(RAIZ, r.ruta)}`);
    }
}
