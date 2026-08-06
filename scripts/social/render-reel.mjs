/**
 * Graba un reel: captura el loop cuadro por cuadro y lo arma con ffmpeg.
 *
 *   node scripts/social/render-reel.mjs social/contenido/reels/2x1-multifocales.json
 *
 * Deja en `social/contenido/reels/salida/`:
 *   AAAAMMDD-<tema>-reel.mp4   1080x1920, 30 fps, H.264, sin audio
 *   AAAAMMDD-<tema>-cover.jpg  el frame más fuerte, para portada
 *   AAAAMMDD-<tema>-reel.txt   el copy con los hashtags, listo para pegar
 *
 * POR QUÉ SE CAPTURA CUADRO POR CUADRO Y NO SE GRABA LA PANTALLA
 * Grabar "en vivo" a 30 fps depende de que la máquina llegue a dibujar 30 veces
 * por segundo. Cuando no llega —y con una foto de 4000 px no llega— el video
 * sale con frames repetidos y micro-tirones. Acá se avanza un reloj a mano
 * (`window.__dibujar(t)`), se saca la foto, y recién ahí se pasa al siguiente:
 * el resultado es idéntico corra en la máquina que corra.
 *
 * SIN AUDIO A PROPÓSITO (`-an`): Instagram baja el volumen de los reels sin
 * música propia, y un audio vacío hace que la app muestre "audio original" con
 * silencio, que se ve peor que no tener nada.
 *
 * Se usa Playwright y no Puppeteer porque ya está en el proyecto (es lo que
 * renderiza las placas). Es la misma captura; cambiar a Puppeteer serían diez
 * líneas y otro Chromium de 300 MB bajado al pedo.
 */
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cargarIdentidad, RAIZ } from './identidad.mjs';
import { htmlDeReel, DURACION_MS, FPS } from './reel-plantilla.mjs';
import { htmlDeReelOjo, DURACION_OJO_MS } from './reel-plantilla-ojo.mjs';
import { hashtagsDeReel } from './seo.mjs';

const ejecutar = promisify(execFile);
const SALIDA = path.join(RAIZ, 'social', 'contenido', 'reels', 'salida');
const BANCO = path.join(RAIZ, 'public', 'images');
const PUBLIC = path.join(RAIZ, 'public');

/** AAAAMMDD del día de hoy, en hora argentina. */
function fechaHoy() {
    const ART = new Date(Date.now() - 3 * 60 * 60 * 1000);
    return `${ART.getUTCFullYear()}${String(ART.getUTCMonth() + 1).padStart(2, '0')}${String(ART.getUTCDate()).padStart(2, '0')}`;
}

function resolverImagen(ref) {
    if (!ref) return null;
    const limpia = String(ref).replace(/^\//, '');
    for (const raiz of [BANCO, PUBLIC]) {
        const r = path.join(raiz, limpia);
        if (existsSync(r)) return r;
    }
    return null;
}

async function aDataUri(ruta) {
    const bytes = await readFile(ruta);
    const ext = path.extname(ruta).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp'
        : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
    return `data:${mime};base64,${bytes.toString('base64')}`;
}

export async function renderizarReel(rutaJson) {
    const reel = JSON.parse(await readFile(rutaJson, 'utf-8'));
    const id = await cargarIdentidad();

    const fotoRuta = resolverImagen(reel.imagen);
    if (!fotoRuta && reel.plantilla !== 'ojo') {
        // Misma lógica que la regla R5 de las placas: si la foto no existe, no
        // se renderiza. Un reel con el fondo vacío es peor que ningún reel.
        throw new Error(`La imagen "${reel.imagen}" no existe en el banco. No se renderiza.`);
    }

    const base = `${fechaHoy()}-${reel.tema}`;
    await mkdir(SALIDA, { recursive: true });
    const dirFrames = path.join(SALIDA, `.frames-${reel.tema}`);
    await rm(dirFrames, { recursive: true, force: true });
    await mkdir(dirFrames, { recursive: true });

    // Cada plantilla trae su duración: el explicador del ojo necesita 12 s,
    // una promo aguanta 6. La duración vive en la plantilla y no en el JSON
    // para que el timeline interno y el largo del video no puedan divergir.
    const esOjo = reel.plantilla === 'ojo';
    const DUR = esOjo ? DURACION_OJO_MS : DURACION_MS;
    const html = esOjo
        ? htmlDeReelOjo(reel, id, await aDataUri(id.logo))
        : htmlDeReel(reel, id, await aDataUri(fotoRuta), await aDataUri(id.logo));

    const { chromium } = await import('playwright');
    const navegador = await chromium.launch();
    const pagina = await navegador.newPage({
        viewport: { width: 1080, height: 1920 },
        deviceScaleFactor: 1,
    });

    const totalFrames = Math.round((DUR / 1000) * FPS);
    console.log(`\nGrabando ${totalFrames} frames (${DUR / 1000}s a ${FPS} fps)…`);

    try {
        await pagina.setContent(html, { waitUntil: 'networkidle' });
        // Las fuentes tienen que estar cargadas ANTES del primer frame: si no,
        // los primeros cuadros salen con la tipografía del sistema y se ve el
        // cambio de fuente en el video.
        await pagina.evaluate(() => document.fonts.ready);

        for (let f = 0; f < totalFrames; f++) {
            const t = (f / FPS) * 1000;
            await pagina.evaluate((ms) => window.__dibujar(ms), t);
            await pagina.screenshot({
                path: path.join(dirFrames, `f${String(f).padStart(5, '0')}.png`),
                animations: 'disabled',
            });
            if (f % 30 === 0) process.stdout.write(`  ${f}/${totalFrames}\r`);
        }
        console.log(`  ${totalFrames}/${totalFrames} frames capturados`);

        // La portada: el frame donde la escena principal está entera en
        // pantalla. Se toma del medio de su turno, no del principio, porque en
        // el arranque el texto todavía está entrando y sale semitransparente.
        const cual = reel.coverEscena ?? 0;
        const nEsc = (reel.escenas || []).length || 1;
        const tCover = reel.coverMs ?? (((cual + 0.5) / nEsc) * DUR);
        await pagina.evaluate((ms) => window.__dibujar(ms), tCover);
        const cover = path.join(SALIDA, `${base}-cover.jpg`);
        await pagina.screenshot({ path: cover, type: 'jpeg', quality: 92 });
        console.log(`  portada: escena ${cual + 1} de ${nEsc}`);
    } finally {
        await navegador.close();
    }

    // ── El video ────────────────────────────────────────────────────────────
    const ffmpeg = (await import('ffmpeg-static')).default;
    const mp4 = path.join(SALIDA, `${base}-reel.mp4`);

    await ejecutar(ffmpeg, [
        '-y',
        '-framerate', String(FPS),
        '-i', path.join(dirFrames, 'f%05d.png'),
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '18',
        // yuv420p: sin esto el video se ve verde o no reproduce en varios
        // celulares. Es el formato de color que espera todo reproductor.
        '-pix_fmt', 'yuv420p',
        // Instagram re-comprime igual; -movflags +faststart deja el índice al
        // principio para que empiece a reproducir sin bajar el archivo entero.
        '-movflags', '+faststart',
        '-an',
        '-r', String(FPS),
        mp4,
    ]);

    await rm(dirFrames, { recursive: true, force: true });

    // ── El copy ─────────────────────────────────────────────────────────────
    const hashtags = hashtagsDeReel({ temas: reel.temas }, 8);
    const txt = `${reel.copy.trim()}\n\n${hashtags}\n`;
    const rutaTxt = path.join(SALIDA, `${base}-reel.txt`);
    await writeFile(rutaTxt, txt, 'utf-8');

    // Copia hosteada SIN fecha en public/social/reels/: es la URL estable que
    // usa el cron para publicar por API (Instagram descarga el video de ahí).
    // La salida fechada de arriba queda como entregable manual.
    const HOSTEO = path.join(RAIZ, 'public', 'social', 'reels');
    await mkdir(HOSTEO, { recursive: true });
    const { copyFile } = await import('node:fs/promises');
    await copyFile(mp4, path.join(HOSTEO, `${reel.tema}.mp4`));
    await copyFile(path.join(SALIDA, `${base}-cover.jpg`), path.join(HOSTEO, `${reel.tema}-cover.jpg`));

    const rel = (p) => path.relative(RAIZ, p);
    console.log(`\n✅ ${rel(mp4)}`);
    console.log(`✅ ${rel(path.join(SALIDA, `${base}-cover.jpg`))}`);
    console.log(`✅ ${rel(rutaTxt)}`);
    return { mp4, cover: path.join(SALIDA, `${base}-cover.jpg`), txt: rutaTxt };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const ruta = process.argv[2];
    if (!ruta) {
        console.error('Falta el reel.\n  node scripts/social/render-reel.mjs social/contenido/reels/2x1-multifocales.json');
        process.exit(1);
    }
    try {
        await renderizarReel(path.resolve(ruta));
    } catch (e) {
        console.error(`\n❌ ${e.message}`);
        process.exit(1);
    }
}
