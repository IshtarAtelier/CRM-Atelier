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
import { cuotasLargas, leerPromoCuotas } from './condiciones-pago.mjs';

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

export async function generarPiezaDeProductos({ destacados = false, marca = null, categoria = null, idPieza = null, titulo = null, limite = 3, saltear = 0 } = {}) {
    const { PrismaClient } = await import('@prisma/client');
    // Producción si está disponible; local es el respaldo. Cuál de las dos se
    // usó queda escrito en la pieza (`generadoDesde`): el catálogo de docker
    // está desincronizado, así que un precio leído de ahí puede ser de hace
    // semanas y la fecha de generación no lo delata. La guarda de frescura mira
    // ese campo para negarse a publicar.
    const desdeProduccion = Boolean(process.env.PROD_DATABASE_URL);
    const prisma = new PrismaClient({
        datasources: { db: { url: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL } },
    });

    try {
        const productos = await prisma.webProduct.findMany({
            where: {
                isActive: true,
                imageUrl: { not: null },
                ...(destacados ? { isFeatured: true } : {}),
                ...(categoria ? { category: { equals: categoria, mode: 'insensitive' } } : {}),
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

        // Una sola variante por modelo: "Sirio C1" y "Sirio C3" son el mismo
        // armazón en otro color, y en un carrusel de 3 productos repetir el
        // nombre se ve como un error. El color ya se ve en la foto.
        const porNombre = new Map();
        for (const p of elegidos) {
            const clave = String(p.name).replace(/\s+C\d+\s*$/i, '').trim().toLowerCase();
            if (!porNombre.has(clave)) porNombre.set(clave, p);
        }
        elegidos = [...porNombre.values()];

        // `saltear` corre la ventana: sirve para que dos carruseles de la misma
        // categoría en el mes no muestren los mismos tres productos.
        elegidos = elegidos.slice(saltear, saltear + limite);
        if (!elegidos.length) {
            throw new Error(`Con saltear=${saltear} no quedan productos. Bajar el offset.`);
        }
        console.log(`Productos elegidos: ${elegidos.length}${saltear ? ` (salteando ${saltear})` : ''}`);

        const slides = [];

        // Las condiciones de pago se leen de DONDE LAS LEE LA TIENDA
        // (SystemSetting), con el mismo redondeo que PaymentOptions.tsx. Si la
        // fuente fuera otra, el carrusel diría un número y la ficha otro.
        // El texto libre se interpreta con `leerPromoCuotas`, que no acepta un
        // número que no sea de los que se venden sin interés.
        const cond = await (async () => {
            const filas = await prisma.systemSetting.findMany({
                where: { key: { in: ['web_promo_installments', 'web_promo_cash_discount'] } },
                select: { key: true, value: true },
            });
            const get = (k) => filas.find(f => f.key === k)?.value;
            const promo = leerPromoCuotas(get('web_promo_installments'));
            const crudo = Number(get('web_promo_cash_discount'));
            return {
                cuotas: promo.cantidad,
                textoCuotas: promo.texto,
                descuento: Number.isFinite(crudo) && crudo > 0 ? crudo : 15,
            };
        })();
        console.log(`  · condiciones (de la tienda): ${cond.textoCuotas} · ${cond.descuento}% al contado`);

        // El recargo de las 12 sale de RECARGO_MP_CUOTAS_LARGAS
        // (src/lib/constants/descuentos.ts) — la misma constante que aplica
        // PricingService — y va ADENTRO del importe. Acá NO se escribe el
        // 1,10 a mano, y la leyenda del % no se escribe en ningún lado
        // (fórmula de Ishtar, 31/8 noche: "hasta 12 cuotas fijas").
        console.log(`  · 12 cuotas: fijas, recargo adentro del importe (${(await cuotasLargas(0)).recargo}%)`);

        // Portada: la foto del primero, sin precio (el gancho no es el precio).
        const primero = elegidos[0];
        const fotoPortada = await fotoLocal(primero.imageUrl, `${primero.slug}`);
        console.log(`  ✅ foto: ${primero.name}`);

        slides.push({
            type: 'cover',
            role: 'portada',
            image: path.relative(path.join(RAIZ, 'public', 'images'), fotoPortada),
            title: titulo || (categoria === 'Sol' ? 'Los de *sol* que están volando'
                : marca ? `Armazones *${marca}*` : 'Los que más nos piden *esta temporada*'),
            // Fórmula de Ishtar (31/8 noche): las 12 son "cuotas fijas", sin el
            // % — y se nombran separadas de las sin interés para que no se
            // lean como un solo paquete.
            subtitle: `Diseño de autor en 6 cuotas sin interés, o hasta 12 cuotas fijas. Envío sin cargo.`,
        });

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
            // 12 cuotas MP (27/8/26): misma fórmula que la tienda
            // (PricingService.cuotasMpLargas: lista × factor ÷ 12), con el
            // factor leído de RECARGO_MP_CUOTAS_LARGAS.
            //
            // REGLA DE COMUNICACIÓN (Ishtar, 31/8/2026 a la noche): las 12 se
            // dicen "cuotas fijas", sin la leyenda del % — el recargo va
            // ADENTRO del importe que muestra la placa. Y nunca "sin interés"
            // (eso son solo 3 y 6).
            const cuota12 = (await cuotasLargas(p.product.price)).texto;
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
                body: `${cuota12}\n${cond.textoCuotas}\nTransferencia ${cond.descuento}% OFF: ${plata(alContado)}`,
            });
        }

        slides.push({
            type: 'cta',
            role: 'cierre',
            image: 'blog/fachada-ladrillo.jpg',
            title: 'Probátelos en el local',
            body: 'Cerro de las Rosas. También te los mostramos por WhatsApp si estás lejos.',
        });

        const id = idPieza || (categoria
            ? `armazones-${categoria.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}`
            : marca
                ? `armazones-${marca.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}`
                : 'armazones-destacados');

        const pieza = {
            id,
            format: '4:5',
            theme: 'dark',
            pilar: 'producto',
            // La marca que habilita los precios en el validador (R6).
            fuente: 'base',
            // Cuándo se leyeron los precios. El cron del feed se niega a
            // publicar una pieza de base con más de 10 días: publicar precios
            // viejos es exactamente lo que este sistema existe para impedir.
            generadoEl: new Date().toISOString().slice(0, 10),
            generadoDesde: desdeProduccion ? 'produccion' : 'local',
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

/**
 * Placas INDIVIDUALES de producto (una por armazón) para anuncios: la foto del
 * anteojo grande, la cuota como dato bomba y los descuentos reales. Pedido de
 * Ishtar 1/9/26 ("10 placas diferentes, que se vea bien grande el anteojo").
 *
 * Mismas garantías que el carrusel: precios de la base (fuente: "base", R6) y
 * el cupón se VALIDA EN VIVO contra el endpoint público de la tienda — si el
 * cupón no está vigente, la línea no se escribe. Nada tipeado a mano.
 */
export async function generarPlacasIndividuales({ limite = 10, categoria = null, cupon = 'QUIEROMISLENTES' } = {}) {
    const { PrismaClient } = await import('@prisma/client');
    const desdeProduccion = Boolean(process.env.PROD_DATABASE_URL);
    const prisma = new PrismaClient({
        datasources: { db: { url: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL } },
    });
    try {
        const productos = await prisma.webProduct.findMany({
            where: {
                isActive: true,
                imageUrl: { not: null },
                ...(categoria ? { category: { equals: categoria, mode: 'insensitive' } } : {}),
            },
            include: { product: true },
            take: 200,
        });
        let elegidos = productos.filter(p => p.product && p.product.price > 0);
        const porNombre = new Map();
        for (const p of elegidos) {
            const clave = String(p.name).replace(/\s+C\d+\s*$/i, '').trim().toLowerCase();
            if (!porNombre.has(clave)) porNombre.set(clave, p);
        }
        // Los destacados primero: son los que la óptica ya eligió como vidriera.
        elegidos = [...porNombre.values()].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)).slice(0, limite);
        if (!elegidos.length) throw new Error('Ningún producto activo con foto y precio.');

        const filas = await prisma.systemSetting.findMany({
            where: { key: { in: ['web_promo_installments', 'web_promo_cash_discount'] } },
            select: { key: true, value: true },
        });
        const getS = (k) => filas.find(f => f.key === k)?.value;
        const promo = leerPromoCuotas(getS('web_promo_installments'));
        const crudo = Number(getS('web_promo_cash_discount'));
        const descuento = Number.isFinite(crudo) && crudo > 0 ? crudo : 15;

        // El cupón se valida contra la tienda EN PRODUCCIÓN, no se asume.
        let lineaCupon = null;
        try {
            const r = await fetch('https://atelieroptica.com.ar/api/checkout/validate-coupon', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: cupon, subtotal: 150000 }),
                signal: AbortSignal.timeout(15000),
            });
            const j = await r.json();
            if (j.valid && j.discountType === 'PERCENT') {
                lineaCupon = `Cupón ${cupon}: ${j.discountValue}% OFF en la tienda, solo esta semana`;
                console.log(`  · cupón ${cupon} verificado vivo: ${j.discountValue}% OFF`);
            } else console.log(`  · cupón ${cupon} NO vigente — la línea no se escribe`);
        } catch { console.log('  · no se pudo validar el cupón — la línea no se escribe'); }

        const limpiar = (n) => String(n).replace(/\s+C\d+\s*$/i, '').trim();
        const rutas = [];
        await mkdir(DESTINO, { recursive: true });
        for (const p of elegidos) {
            const foto = await fotoLocal(p.imageUrl, p.slug);
            const cuota = Math.round(p.product.price / promo.cantidad);
            const alContado = Math.round(p.product.price * (1 - descuento / 100));
            const cuota12 = (await cuotasLargas(p.product.price)).texto;
            const id = `placa-producto-${p.slug}`;
            const pieza = {
                id, format: '4:5', theme: 'dark', pilar: 'producto',
                fuente: 'base',
                generadoEl: new Date().toISOString().slice(0, 10),
                generadoDesde: desdeProduccion ? 'produccion' : 'local',
                images_waived: 'Placa de catálogo: la foto del armazón ES el producto, no un fondo.',
                generado: new Date().toISOString().slice(0, 10),
                caption: [
                    `${limpiar(p.name)} — ${promo.texto} de ${plata(cuota)}.`,
                    cuota12 + '.',
                    lineaCupon ? lineaCupon + '.' : null,
                    `Envío gratis a todo el país 🇦🇷`,
                ].filter(Boolean).join(' '),
                slides: [{
                    type: 'number', role: 'portada',
                    image: path.relative(path.join(RAIZ, 'public', 'images'), foto),
                    fotoGrande: true, bomba: true,
                    title: limpiar(p.name) + (
                        p.product.brand && !limpiar(p.name).toLowerCase().includes(p.product.brand.toLowerCase())
                            ? ` · ${p.product.brand}` : ''
                    ),
                    dato: `${promo.cantidad} x ${plata(cuota)}`,
                    body: [
                        `${promo.texto} sin interés · ${cuota12}`,
                        `Transferencia ${descuento}% OFF: ${plata(alContado)}`,
                        lineaCupon,
                    ].filter(Boolean).join('\n'),
                }],
            };
            const ruta = path.join(DESTINO, `${id}.json`);
            await writeFile(ruta, JSON.stringify(pieza, null, 2) + '\n');
            console.log(`  ✅ ${limpiar(p.name)} → ${id} (${plata(p.product.price)} lista)`);
            rutas.push(ruta);
        }
        console.log(`\n${rutas.length} placas individuales. Precios de la base HOY.`);
        return rutas;
    } finally {
        await prisma.$disconnect();
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    const val = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
    if (args.includes('--individuales')) {
        const rutas = await generarPlacasIndividuales({
            limite: Number(val('--limite') || 10),
            categoria: val('--categoria'),
        });
        if (args.includes('--render')) {
            const { renderizarPieza } = await import('./render.mjs');
            for (const r of rutas) await renderizarPieza(r);
        }
        process.exit(0);
    }
    const r = await generarPiezaDeProductos({
        destacados: args.includes('--destacados'),
        marca: val('--marca'),
        categoria: val('--categoria'),
        idPieza: val('--id'),
        titulo: val('--titulo'),
        limite: Number(val('--limite') || 3),
        saltear: Number(val('--saltear') || 0),
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
