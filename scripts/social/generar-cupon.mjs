/**
 * Arma las placas de anuncio de un CUPÓN de la tienda leyendo la base, en los
 * cuatro tamaños que pide Meta Ads.
 *
 *   node scripts/social/generar-cupon.mjs                       → QUIEROMISLENTES
 *   node scripts/social/generar-cupon.mjs --cupon SOYCLIENTE
 *   node scripts/social/generar-cupon.mjs --render              → y las renderiza
 *
 * POR QUÉ DESDE LA BASE
 * El cupón vive en la tabla `Coupon`: porcentaje, compra mínima, cupos y
 * vencimiento. La placa de antes lo tenía tipeado a mano, y cuando el 25/9/26
 * Ishtar extendió el vencimiento, el anuncio siguió diciendo "vence el 30/9".
 * Acá todo sale de la fila: si el cupón cambia, se corre de nuevo y la placa
 * dice lo que el checkout va a cobrar. Por eso la pieza sale con
 * `fuente: "base"`, lo único que deja al validador (R6) aceptar la compra
 * mínima en pesos.
 *
 * Se niega a generar si el cupón no está activo, venció o se agotó: una placa
 * de un cupón que el checkout rechaza es una promesa que no se cumple.
 *
 * QUÉ DICE Y POR QUÉ
 *  - "Solo esta semana" y no la fecha: es la estrategia de Ishtar (1/9/26), y
 *    ella puede apagar el cupón cuando quiera. No se discute.
 *  - Las cuotas con la fórmula única de business-info ("3 y 6 cuotas sin
 *    interés, y hasta 12 cuotas fijas"): nunca un "12 sin interés".
 *  - "Solo N cupones" (el total, que es fijo) y nunca "quedan N": los usos
 *    cambian solos y la placa no.
 *  - La compra mínima SIEMPRE y a la vista, pegada al cupón: sin ella, el que
 *    llega con una compra más baja se encuentra el cupón rechazado en el
 *    checkout. Y "tienda online" también: la placa lleva la dirección del
 *    local y alguien podría ir a pedir el descuento ahí.
 *
 * LOS ARMAZONES
 * Los más vendidos de los últimos 90 días que HOY tienen stock y ficha activa
 * en la tienda, uno por modelo. Un anuncio de cupón que muestra un armazón que
 * no se puede comprar hace entrar a alguien para nada. Si no alcanzan, se
 * completa con los destacados de la tienda.
 *
 * Dos piezas, cada una en 4:5, 1:1, 9:16 y 1.91:1:
 *   ad-l5-cupon-semana  urgencia: un armazón protagonista, gigante.
 *   ad-l5-cupon-vuelta  remarketing: cuatro modelos (variedad) — "volviste a mirarlos".
 */
import { writeFile, readFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from './identidad.mjs';
import { fotoLocal } from './generar-producto.mjs';

const DESTINO = path.join(RAIZ, 'social', 'contenido');
const BUSINESS_INFO_TS = path.join(RAIZ, 'src', 'lib', 'business-info.ts');
const plata = (n) => `$${Math.round(n).toLocaleString('es-AR')}`;

/** Los cuatro tamaños de anuncio (mismo criterio que generar-campania.mjs). */
const TAMANOS = [
    { formato: '4:5', sufijo: '' },
    { formato: '1:1', sufijo: '-cuadrado' },
    { formato: '9:16', sufijo: '-story' },
    { formato: '1.91:1', sufijo: '-apaisado' },
];

/** Un campo de texto de `BUSINESS_INFO` (el archivo es TS y esto corre con node pelado). */
async function campoDeBusinessInfo(campo) {
    const ts = await readFile(BUSINESS_INFO_TS, 'utf8');
    const m = ts.match(new RegExp(`\\b${campo}:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
    if (!m) throw new Error(`No se pudo leer "${campo}" de business-info.ts.`);
    return m[1];
}

const limpiarNombre = (n) => String(n).replace(/\s+C\d+\s*$/i, '').trim();

/**
 * La foto del armazón, recortada al borde del producto.
 *
 * Las fotos del catálogo traen un marco blanco generoso: puestas tal cual, el
 * anteojo ocupa menos de la mitad del panel y la placa se ve vacía — justo lo
 * contrario del "anteojo gigante" que pidió Ishtar el 1/9. Se recorta el
 * blanco y se deja un margen parejo del 4%.
 *
 * Devuelve null si la foto NO es de catálogo: fondo que no es blanco (una
 * foto con una persona, una de ambiente) o un recorte que no tiene forma de
 * anteojo (más alto que ancho). Pasó en la primera vuelta: se coló la foto de
 * una modelo en la grilla de armazones.
 */
async function fotoRecortada(rutaAbs, nombre) {
    const sharp = (await import('sharp')).default;
    const destino = path.join(path.dirname(rutaAbs), `${nombre}-recorte.jpg`);
    if (existsSync(destino)) return destino;

    // Fondo blanco: se miran las cuatro esquinas de una miniatura.
    const { data, info } = await sharp(rutaAbs).resize(60, 60, { fit: 'fill' }).removeAlpha().raw()
        .toBuffer({ resolveWithObject: true });
    const esquina = (x0, y0) => {
        let suma = 0, n = 0;
        for (let y = y0; y < y0 + 6; y++) for (let x = x0; x < x0 + 6; x++) {
            const i = (y * info.width + x) * info.channels;
            suma += Math.min(data[i], data[i + 1], data[i + 2]); n++;
        }
        return suma / n;
    };
    const esquinas = [esquina(0, 0), esquina(54, 0), esquina(0, 54), esquina(54, 54)];
    if (Math.min(...esquinas) < 236) return null;

    const t = await sharp(rutaAbs).trim({ background: '#ffffff', threshold: 22 }).toBuffer({ resolveWithObject: true });
    if (t.info.width / t.info.height < 1.3) return null;

    // Blanqueo del fondo: varias fotos del proveedor tienen el fondo apenas
    // gris (243-248) y sobre el panel blanco se nota el recuadro de la foto.
    // Solo se tocan los píxeles NEUTROS y casi blancos, con una rampa para no
    // dejar halo: el color del armazón (dorado, carey, lentes) no se toca.
    const crudo = await sharp(t.data).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = crudo.data;
    for (let i = 0; i < px.length; i += crudo.info.channels) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        const min = Math.min(r, g, b), max = Math.max(r, g, b);
        if (min < 222 || max - min > 14) continue;
        const k = Math.min(1, (min - 222) / 14);
        px[i] = Math.round(r + (255 - r) * k);
        px[i + 1] = Math.round(g + (255 - g) * k);
        px[i + 2] = Math.round(b + (255 - b) * k);
    }

    const margen = Math.round(t.info.width * 0.04);
    await sharp(px, { raw: crudo.info })
        .extend({ top: margen, bottom: margen, left: margen, right: margen, background: '#ffffff' })
        .jpeg({ quality: 92 })
        .toFile(destino);
    return destino;
}

async function elegirArmazones(prisma, cantidad) {
    const hace90 = new Date(Date.now() - 90 * 864e5);
    const vendidos = await prisma.$queryRaw`
        SELECT oi."productId", SUM(oi.quantity)::int AS unidades
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        WHERE o."isDeleted" = false AND o."orderType" = 'SALE'
          AND COALESCE(o."labSentAt", o."createdAt") >= ${hace90}
          AND oi."productId" IS NOT NULL
        GROUP BY oi."productId"`;
    const ventas = new Map(vendidos.map((v) => [v.productId, v.unidades]));

    const fichas = await prisma.webProduct.findMany({
        where: { isActive: true, imageUrl: { not: null } },
        include: { product: { select: { stock: true, price: true } } },
        take: 400,
    });
    const candidatas = fichas
        .filter((f) => f.product && f.product.stock > 0 && f.product.price > 0)
        .map((f) => ({ ...f, unidades: ventas.get(f.productId) ?? 0 }))
        .sort((a, b) => (b.unidades - a.unidades) || (Number(b.isFeatured) - Number(a.isFeatured)));

    const porModelo = new Map();
    for (const f of candidatas) {
        const clave = limpiarNombre(f.name).toLowerCase();
        if (!porModelo.has(clave)) porModelo.set(clave, f);
        if (porModelo.size >= cantidad * 3) break; // margen por si alguna foto no baja
    }

    const elegidas = [];
    for (const f of porModelo.values()) {
        if (elegidas.length >= cantidad) break;
        try {
            const yaEstaba = existsSync(path.join(RAIZ, 'public', 'images', 'catalogo-social', `${f.slug}.jpg`));
            const original = await fotoLocal(f.imageUrl, f.slug);
            const foto = await fotoRecortada(original, f.slug);
            if (!foto) {
                console.log(`  · ${limpiarNombre(f.name)}: la foto no es de catálogo (fondo no blanco o no parece un anteojo) — se saltea`);
                // Si la bajamos recién para esto, no se deja basura en el banco.
                if (!yaEstaba) await unlink(original).catch(() => {});
                continue;
            }
            elegidas.push({ nombre: limpiarNombre(f.name), unidades: f.unidades, foto: path.relative(path.join(RAIZ, 'public', 'images'), foto) });
        } catch (err) {
            console.log(`  · ${f.name}: la foto no se pudo preparar (${err.message}) — se saltea`);
        }
    }
    if (!elegidas.length) throw new Error('Ningún armazón con stock, ficha activa y foto.');
    return elegidas;
}

export async function generarPlacasDeCupon({ codigo = 'QUIEROMISLENTES' } = {}) {
    const { PrismaClient } = await import('@prisma/client');
    // Producción si está disponible (el catálogo de docker está desincronizado);
    // cuál se usó queda escrito en la pieza, como en generar-producto.
    const desdeProduccion = Boolean(process.env.PROD_DATABASE_URL);
    const prisma = new PrismaClient({
        datasources: { db: { url: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL } },
    });

    try {
        const cupon = await prisma.coupon.findUnique({
            where: { code: codigo.toUpperCase() },
            select: { code: true, discountType: true, discountValue: true, isActive: true, expiresAt: true, maxUses: true, usedCount: true, minOrderAmount: true },
        });
        if (!cupon) throw new Error(`El cupón ${codigo} no existe en la base.`);
        if (!cupon.isActive) throw new Error(`El cupón ${cupon.code} está desactivado: no se arma una placa de un cupón que el checkout rechaza.`);
        if (cupon.expiresAt && cupon.expiresAt < new Date()) throw new Error(`El cupón ${cupon.code} venció.`);
        if (cupon.maxUses != null && cupon.usedCount >= cupon.maxUses) throw new Error(`El cupón ${cupon.code} ya usó sus ${cupon.maxUses} cupos.`);

        const descuento = cupon.discountType === 'PERCENT'
            ? `${cupon.discountValue % 1 === 0 ? cupon.discountValue : cupon.discountValue.toFixed(1)}% OFF`
            : `${plata(cupon.discountValue)} OFF`;
        const minimo = cupon.minOrderAmount && cupon.minOrderAmount > 0 ? `Compra mínima ${plata(cupon.minOrderAmount)}` : null;
        // "Solo N cupones" es el total de la fila, que no cambia con los usos
        // (lo que cambia es cuántos quedan, y eso no se escribe). Cuando se
        // agotan, este generador se niega y los anuncios hay que pausarlos.
        const cupos = cupon.maxUses != null ? `Solo ${cupon.maxUses} cupones` : null;
        // Pegado al cupón y bien visible: dónde vale y desde cuánto. En letra
        // chica era lo que menos se leía (revisión del 25/9).
        const requisito = [
            'En la *tienda online*',
            cupon.minOrderAmount && cupon.minOrderAmount > 0 ? `compras desde ${plata(cupon.minOrderAmount)}` : null,
        ].filter(Boolean).join(' · ');
        const condiciones = cupos;

        // "3 y 6 cuotas sin interés, y hasta 12 cuotas fijas" → dos renglones con las mismas palabras.
        const cuotas = await campoDeBusinessInfo('installmentsPromo');
        const [sinInteres, fijas] = cuotas.split(/,\s*y\s+/);
        if (!sinInteres || !fijas) throw new Error(`installmentsPromo cambió de forma ("${cuotas}"): revisar el partido en renglones.`);
        const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
        const renglones = [mayus(sinInteres), mayus(fijas), 'Envío gratis a todo el país'];

        const armazones = await elegirArmazones(prisma, 4);
        console.log(`  · cupón ${cupon.code}: ${descuento}${minimo ? ` · ${minimo.toLowerCase()}` : ''}${cupon.maxUses != null ? ` · ${cupon.maxUses - cupon.usedCount} de ${cupon.maxUses} cupos libres` : ''}`);
        console.log(`  · armazones: ${armazones.map((a) => `${a.nombre} (${a.unidades} ${a.unidades === 1 ? 'vendido' : 'vendidos'} en 90 días)`).join(', ')}`);

        const piezas = {
            'ad-l5-cupon-semana': {
                temas: ['tienda', 'remarketing', 'cupon'],
                eyebrow: 'SOLO ESTA SEMANA',
                sello: true,
                title: `En *toda la tienda online* con el cupón`,
                fotos: [armazones[0].foto],
                caption: `Solo esta semana: ${descuento} en toda la tienda online con el cupón ${cupon.code} 🏷️\n\n${cuotas}. Envío gratis a todo el país.\n\n${[minimo, cupos].filter(Boolean).join(' · ')}.`,
            },
            'ad-l5-cupon-vuelta': {
                temas: ['tienda', 'remarketing', 'cupon'],
                eyebrow: 'VOLVISTE A MIRARLOS',
                // La urgencia tiene que estar también acá (en la placa de
                // producto aprobada estaba): la revisión del 25/9 la echó en falta.
                title: `Llevátelos con el cupón · *solo esta semana*`,
                fotos: armazones.map((a) => a.foto),
                caption: `Esos anteojos que estuviste mirando siguen acá 👓 Solo esta semana, llevátelos con ${descuento} usando el cupón ${cupon.code} en la tienda online.\n\n${cuotas}, con envío gratis a todo el país.\n\n${[minimo, cupos].filter(Boolean).join(' · ')}.`,
            },
        };

        await mkdir(DESTINO, { recursive: true });
        const rutas = [];
        const hoy = new Date().toISOString().slice(0, 10);
        for (const [base, p] of Object.entries(piezas)) {
            for (const t of TAMANOS) {
                const id = `${base}${t.sufijo}`;
                const pieza = {
                    id,
                    format: t.formato,
                    // Claro: "las placas así tan oscuras no me gustan, eso no vende" (Ishtar, 1/9/26).
                    theme: 'light',
                    pilar: 'campania',
                    fuente: 'base',
                    generadoEl: hoy,
                    generadoDesde: desdeProduccion ? 'produccion' : 'local',
                    cupon: cupon.code,
                    temas: p.temas,
                    caption: p.caption,
                    slides: [{
                        type: 'cupon',
                        role: 'portada',
                        image: p.fotos[0],
                        images: p.fotos.length > 1 ? p.fotos : [],
                        eyebrow: p.eyebrow,
                        ...(p.sello ? { sello: true } : {}),
                        dato: descuento,
                        title: p.title,
                        cupon: cupon.code,
                        requisito,
                        items: renglones,
                        condiciones,
                        // El botón del anuncio abre WhatsApp: el llamado dice lo mismo.
                        cta: 'Escribinos y te ayudamos a usarlo',
                    }],
                };
                const ruta = path.join(DESTINO, `${id}.json`);
                await writeFile(ruta, JSON.stringify(pieza, null, 2) + '\n');
                rutas.push(ruta);
            }
            console.log(`  ✅ ${base} (4 tamaños)`);
        }
        return rutas;
    } finally {
        await prisma.$disconnect();
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    const i = args.indexOf('--cupon');
    const rutas = await generarPlacasDeCupon({ codigo: i !== -1 ? args[i + 1] : 'QUIEROMISLENTES' });
    if (args.includes('--render')) {
        const { renderizarPieza } = await import('./render.mjs');
        for (const r of rutas) await renderizarPieza(r);
    }
    process.exit(0);
}
