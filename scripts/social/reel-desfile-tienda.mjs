/**
 * Reel "desfile" para ANUNCIOS de la tienda online: los armazones de la tienda
 * uno detrás del otro, sin precio, y un cierre con la oferta.
 *
 *   node --env-file=.env scripts/social/reel-desfile-tienda.mjs
 *   node --env-file=.env scripts/social/reel-desfile-tienda.mjs --por-categoria 5 --segundos 1.2
 *   node --env-file=.env scripts/social/reel-desfile-tienda.mjs --categorias Sol --por-categoria 12 --nombre desfile-tienda-sol
 *
 * Sale en public/social/reels/desfile-tienda.mp4 (+ -cover.jpg), que queda
 * servido en https://atelieroptica.com.ar/social/reels/desfile-tienda.mp4:
 * de ahí lo baja Meta al subirlo como video del anuncio.
 *
 * POR QUÉ NO ES EL DESFILE DE REDES (reel-desfile-modelos.mjs)
 * Aquel usa las stories con el precio del día quemado y cierra con "Pedí tu
 * presupuesto por WhatsApp". Sirve para una publicación que vive un día. Un
 * anuncio corre semanas: un precio en el video quedaría viejo (la misma idea
 * que la regla R6) y el llamado tiene que llevar a la tienda, no al chat.
 *
 * QUÉ MUESTRA Y DE DÓNDE SALE
 *  - Los armazones publicados en la tienda que HOY tienen stock, uno por
 *    modelo, alternando sol, receta y clip-on (variedad: Ishtar, 28/8 y 1/9).
 *  - Destacados primero dentro de cada categoría.
 *  - Solo fotos de catálogo: fondo blanco, buena resolución y forma de anteojo.
 *    La de una modelo o una captura de pantalla (pasó con Zafiro) se descarta.
 *  - Estilo claro y boutique: "las oscuras no venden" (1/9) y "que no parezca
 *    un póster" (25/9). Colores y fuentes de identidad.mjs.
 *  - Las cuotas con la fórmula única de business-info; dirección y horario en
 *    cada cuadro (van en todas las piezas, pedido del 27/8).
 *
 * SIN AUDIO (-an), como los otros reels: la música se elige en el anuncio.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import { cargarIdentidad, RAIZ } from './identidad.mjs';
import { fotoLocal } from './generar-producto.mjs';
import { DIRECCION_PIE, HORARIO_PIE } from './plantillas.mjs';

const ejecutar = promisify(execFile);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const POR_CATEGORIA = Number(arg('por-categoria', 5));
const SEGUNDOS = Number(arg('segundos', 1.2));
const CIERRE = 2.6;
const FUNDIDO = 0.35;
const TODAS = [
    { clave: 'Sol', rotulo: 'Lentes de sol' },
    { clave: 'Receta', rotulo: 'Armazones de receta' },
    { clave: 'Clip-On', rotulo: 'Clip-on' },
];
// --categorias Sol → un desfile de una sola categoría (p. ej. el de temporada).
const PEDIDAS = arg('categorias', null)?.split(',').map(c => c.trim().toLowerCase());
const CATEGORIAS = PEDIDAS ? TODAS.filter(c => PEDIDAS.includes(c.clave.toLowerCase())) : TODAS;
if (!CATEGORIAS.length) throw new Error(`--categorias no coincide con ninguna: ${TODAS.map(c => c.clave).join(', ')}`);
const NOMBRE = arg('nombre', 'desfile-tienda');
// --excluir Calisto,Eva → modelos cuya foto pasa el filtro automático pero no
// luce (un armazón blanco sobre blanco, un ángulo raro). Criterio a ojo.
const EXCLUIR = new Set((arg('excluir', '') || '').split(',').map(n => n.trim().toLowerCase()).filter(Boolean));
const SALIDA = path.join(RAIZ, 'public', 'social', 'reels');
const FRAMES = path.join(RAIZ, 'social', 'contenido', 'reels', 'salida', `.frames-desfile-tienda-${Date.now()}`);

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const limpiarNombre = (n) => String(n).replace(/\s+C\d+.*$/i, '').trim();

async function cuotasDeBusinessInfo() {
    const ts = await readFile(path.join(RAIZ, 'src', 'lib', 'business-info.ts'), 'utf8');
    const m = ts.match(/\binstallmentsPromo:\s*"((?:[^"\\]|\\.)*)"/);
    if (!m) throw new Error('No se pudo leer installmentsPromo de business-info.ts.');
    return m[1];
}

/** Foto de catálogo recortada al borde del anteojo, o null si no es de catálogo. */
async function fotoDeCatalogo(rutaAbs, nombre) {
    const sharp = (await import('sharp')).default;
    const destino = path.join(path.dirname(rutaAbs), `${nombre}-recorte.jpg`);
    if (existsSync(destino)) return destino;
    const meta = await sharp(rutaAbs).metadata();
    if ((meta.width || 0) < 900) return null; // baja resolución: una captura o una miniatura
    const { data, info } = await sharp(rutaAbs).resize(60, 60, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const esquina = (x0, y0) => {
        let s = 0, n = 0;
        for (let y = y0; y < y0 + 6; y++) for (let x = x0; x < x0 + 6; x++) {
            const i = (y * info.width + x) * info.channels; s += Math.min(data[i], data[i + 1], data[i + 2]); n++;
        }
        return s / n;
    };
    if (Math.min(esquina(0, 0), esquina(54, 0), esquina(0, 54), esquina(54, 54)) < 236) return null;
    const t = await sharp(rutaAbs).trim({ background: '#ffffff', threshold: 22 }).toBuffer({ resolveWithObject: true });
    if (t.info.width / t.info.height < 1.3) return null;
    // Blanqueo del fondo apenas gris (solo píxeles neutros y casi blancos).
    const crudo = await sharp(t.data).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = crudo.data;
    for (let i = 0; i < px.length; i += crudo.info.channels) {
        const min = Math.min(px[i], px[i + 1], px[i + 2]), max = Math.max(px[i], px[i + 1], px[i + 2]);
        if (min < 222 || max - min > 14) continue;
        const k = Math.min(1, (min - 222) / 14);
        for (let c = 0; c < 3; c++) px[i + c] = Math.round(px[i + c] + (255 - px[i + c]) * k);
    }
    const m = Math.round(t.info.width * 0.04);
    await sharp(px, { raw: crudo.info }).extend({ top: m, bottom: m, left: m, right: m, background: '#ffffff' }).jpeg({ quality: 92 }).toFile(destino);
    return destino;
}

async function elegirArmazones() {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL } } });
    try {
        const fichas = await prisma.webProduct.findMany({
            where: { isActive: true, imageUrl: { not: null }, category: { in: CATEGORIAS.map(c => c.clave) }, product: { stock: { gt: 0 } } },
            include: { product: { select: { brand: true } } },
            orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
            take: 500,
        });
        const porCategoria = {};
        for (const c of CATEGORIAS) {
            const vistos = new Set();
            const elegidas = [];
            for (const f of fichas.filter(x => x.category === c.clave)) {
                if (elegidas.length >= POR_CATEGORIA) break;
                const modelo = limpiarNombre(f.name);
                if (vistos.has(modelo.toLowerCase()) || EXCLUIR.has(modelo.toLowerCase())) continue;
                try {
                    const yaEstaba = existsSync(path.join(RAIZ, 'public', 'images', 'catalogo-social', `${f.slug}.jpg`));
                    const original = await fotoLocal(f.imageUrl, f.slug);
                    const foto = await fotoDeCatalogo(original, f.slug);
                    if (!foto) {
                        console.log(`  · ${modelo}: la foto no es de catálogo — se saltea`);
                        if (!yaEstaba) await rm(original, { force: true });
                        continue;
                    }
                    vistos.add(modelo.toLowerCase());
                    elegidas.push({ modelo, marca: f.product?.brand || '', categoria: c.rotulo, foto });
                } catch (err) {
                    console.log(`  · ${modelo}: la foto no bajó (${err.message}) — se saltea`);
                }
            }
            porCategoria[c.clave] = elegidas;
        }
        // Alternadas: sol, receta, clip-on, sol, receta, clip-on…
        const orden = [];
        for (let i = 0; i < POR_CATEGORIA; i++) for (const c of CATEGORIAS) if (porCategoria[c.clave][i]) orden.push(porCategoria[c.clave][i]);
        if (orden.length < 4) throw new Error('Menos de 4 armazones con stock y foto de catálogo: no alcanza para un desfile.');
        return orden;
    } finally {
        await prisma.$disconnect();
    }
}

function css(id) {
    const bronce = `color-mix(in srgb, ${id.colores.marca} 72%, ${id.oscuro} 28%)`;
    const filete = `color-mix(in srgb, ${id.oscuro} 16%, ${id.colores.fondo} 84%)`;
    const suave = `color-mix(in srgb, ${id.oscuro} 72%, ${id.colores.fondo} 28%)`;
    return `* { margin:0; padding:0; box-sizing:border-box; }
    body { width:1080px; height:1920px; overflow:hidden; position:relative; background:${id.colores.fondo};
      color:${id.oscuro}; font-family:${id.fuentes.texto}; -webkit-font-smoothing:antialiased; }
    .caps { font-size:24px; font-weight:600; letter-spacing:8px; text-transform:uppercase; color:${bronce}; }
    .serif { font-family:${id.fuentes.serif}; font-weight:500; }
    /* Zonas seguras de story/reel: arriba ~250 px la cabecera de la cuenta y
       abajo ~460 px el botón y la pila de Reels. Todo lo que se lee vive entre
       las dos. */
    .cab { position:absolute; top:290px; left:0; right:0; text-align:center; }
    .cab h1 { font-family:${id.fuentes.serif}; font-weight:500; font-size:128px; line-height:1; margin-top:18px; }
    .barra { width:110px; height:2px; background:${id.colores.marca}; margin:34px auto 0; }
    .panel { position:absolute; top:640px; left:0; right:0; height:620px; background:#ffffff;
      border-top:1px solid ${filete}; border-bottom:1px solid ${filete};
      background-size:auto 78%; background-position:center; background-repeat:no-repeat; }
    .panel.ancha { background-size:88% auto; }
    .web { position:absolute; top:1300px; left:0; right:0; text-align:center; font-size:30px; font-weight:600; letter-spacing:1px; }
    .pie { position:absolute; left:80px; right:80px; top:1382px; display:flex; align-items:center; justify-content:space-between;
      border-top:1px solid ${filete}; padding-top:20px; }
    .pie img { height:40px; }
    .pie span { font-size:20px; text-align:right; line-height:1.35; color:${suave}; }
    .cierre { position:absolute; top:300px; left:90px; right:90px; text-align:center; }
    .cierre h1 { font-family:${id.fuentes.serif}; font-weight:500; font-size:150px; line-height:.95; margin-top:26px; }
    .cierre h1 i { color:${bronce}; }
    .cierre .fil { height:1px; background:${filete}; margin:50px 0 38px; }
    .cierre p.l { font-size:38px; font-weight:600; line-height:1.5; }
    .cierre p.url { margin-top:44px; font-size:44px; font-weight:800; letter-spacing:1px; }
    .cierre p.url span { display:inline-block; border:1.5px solid ${bronce}; color:${bronce}; padding:18px 36px; }`;
}

const pie = (id, logo) => `<div class="pie"><img src="${logo}" alt=""><span>${esc(DIRECCION_PIE)}<br>${esc(HORARIO_PIE)}</span></div>`;

async function main() {
    const id = await cargarIdentidad();
    const sharp = (await import('sharp')).default;
    const { chromium } = await import('playwright');
    const cuotas = await cuotasDeBusinessInfo();
    const [sinInteres, fijas] = cuotas.split(/,\s*y\s+/);
    if (!sinInteres || !fijas) throw new Error(`installmentsPromo cambió de forma ("${cuotas}").`);
    const may = (t) => t.charAt(0).toUpperCase() + t.slice(1);

    console.log('Eligiendo armazones de la tienda (con stock y foto de catálogo)…');
    const armazones = await elegirArmazones();
    console.log(`${armazones.length} en el desfile: ${armazones.map(a => a.modelo).join(', ')}`);

    const logo = `data:image/png;base64,${(await readFile(id.logo)).toString('base64')}`;
    const aUri = async (ruta) => `data:image/jpeg;base64,${(await readFile(ruta)).toString('base64')}`;
    await mkdir(FRAMES, { recursive: true });
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    const cuadros = [];
    try {
        const render = async (cuerpo, nombre) => {
            await page.setContent(`<!doctype html><html lang="es"><head><meta charset="utf-8"><link href="${id.googleFonts}" rel="stylesheet"><style>${css(id)}</style></head><body>${cuerpo}</body></html>`, { waitUntil: 'load', timeout: 60000 });
            await page.evaluate(() => document.fonts.ready);
            const ruta = path.join(FRAMES, `${nombre}.jpg`);
            await sharp(await page.screenshot({ type: 'png' })).jpeg({ quality: 93 }).toFile(ruta);
            return ruta;
        };
        for (const [i, a] of armazones.entries()) {
            const m = await sharp(a.foto).metadata();
            const ancha = m.width / m.height > 2.2 ? ' ancha' : '';
            cuadros.push(await render(`
              <div class="cab"><p class="caps">${esc(a.categoria)}${a.marca ? ` · ${esc(a.marca)}` : ''}</p><h1>${esc(a.modelo)}</h1><div class="barra"></div></div>
              <div class="panel${ancha}" style="background-image:url('${await aUri(a.foto)}')"></div>
              <p class="web">En la tienda online · envío gratis a todo el país</p>
              ${pie(id, logo)}`, String(i).padStart(2, '0')));
        }
        cuadros.push(await render(`
          <div class="cierre"><p class="caps">Atelier Óptica · tienda online</p>
            <h1>Elegí<br><i>los tuyos</i></h1>
            <div class="fil"></div>
            <p class="l">${esc(may(sinInteres))}</p>
            <p class="l">${esc(may(fijas))}</p>
            <p class="l">Envío gratis a todo el país</p>
            <p class="url"><span>atelieroptica.com.ar</span></p></div>
          ${pie(id, logo)}`, 'zz-cierre'));
    } finally {
        await browser.close();
    }

    // Fundido encadenado entre cuadros; el cierre queda más tiempo.
    const inputs = [];
    cuadros.forEach((c, i) => {
        const dur = (i === cuadros.length - 1 ? CIERRE : SEGUNDOS) + FUNDIDO;
        inputs.push('-loop', '1', '-t', String(dur), '-i', c);
    });
    let filtro = '';
    let previa = '0:v';
    let offset = SEGUNDOS;
    for (let i = 1; i < cuadros.length; i++) {
        const salida = i === cuadros.length - 1 ? 'vout' : `v${i}`;
        filtro += `[${previa}][${i}:v]xfade=transition=fade:duration=${FUNDIDO}:offset=${offset.toFixed(2)}[${salida}];`;
        previa = salida;
        offset += SEGUNDOS;
    }
    await mkdir(SALIDA, { recursive: true });
    const mp4 = path.join(SALIDA, `${NOMBRE}.mp4`);
    const cover = path.join(SALIDA, `${NOMBRE}-cover.jpg`);
    await ejecutar(ffmpegPath, ['-y', ...inputs, '-filter_complex', filtro.slice(0, -1), '-map', '[vout]',
        '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', '-an', mp4]);
    await writeFile(cover, await readFile(cuadros[0]));
    await rm(FRAMES, { recursive: true, force: true });
    console.log(`\n✅ ${path.relative(RAIZ, mp4)} (${cuadros.length} cuadros, ~${(offset + CIERRE).toFixed(1)} s)`);
}

main().catch((e) => { console.error(`\n❌ ${e.message}`); process.exit(1); });
