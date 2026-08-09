/**
 * Renderiza una pieza (un carrusel) a imágenes listas para publicar.
 *
 *   node scripts/social/render.mjs social/contenido/ejemplo.json
 *
 * Genera DOS archivos por slide en `public/social/<id-pieza>/`:
 *   - PNG master, sin pérdida, para archivo.
 *   - JPEG REAL de calidad 92, que es el que se publica.
 *
 * Lo del JPEG no es un detalle: Instagram RECHAZA un PNG renombrado a .jpg. Hay
 * que convertir de verdad, y por eso el JPEG se genera con sharp y no cambiando
 * la extensión.
 *
 * Van a `public/` porque Instagram no acepta los bytes de la imagen: recibe una
 * URL pública HTTPS y va a buscarla él mismo. Al estar en public/, quedan
 * servidas en https://atelieroptica.com.ar/social/<pieza>/<archivo>.jpg
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { cargarIdentidad, formatoDePieza, RAIZ } from './identidad.mjs';
import { htmlDeSlide } from './plantillas.mjs';
import { validarPieza } from './validador.mjs';

const SALIDA_BASE = path.join(RAIZ, 'public', 'social');
const BANCO = path.join(RAIZ, 'public', 'images');
const PUBLIC = path.join(RAIZ, 'public');

/**
 * Resuelve la referencia de una imagen a una ruta absoluta.
 *
 * Se prueban dos raíces porque hay dos bancos distintos:
 *   - `public/images/` — las fotos editoriales y del blog, que se citan como
 *     "blog/fachada-ladrillo.jpg".
 *   - `public/` — las fotos de producto, que la base guarda con su ruta web ya
 *     hecha ("assets/products/acetato/nashira-c3.webp"). Reescribirlas al
 *     generarlas sería duplicar el criterio de dónde vive cada foto en dos
 *     lugares; alcanza con que el resolvedor entienda las dos formas.
 *
 * Sigue devolviendo null si no existe: la regla R5 se apoya en esto para
 * bloquear una pieza que cite una foto inexistente.
 */
export function resolverImagen(ref) {
    if (!ref) return null;
    const limpia = String(ref).replace(/^\//, '');
    for (const raiz of [BANCO, PUBLIC]) {
        const ruta = path.join(raiz, limpia);
        if (existsSync(ruta)) return ruta;
    }
    return null;
}

export async function renderizarPieza(rutaJson, { soloValidar = false } = {}) {
    const pieza = JSON.parse(await readFile(rutaJson, 'utf-8'));
    const id = await cargarIdentidad();

    // El formato lo manda la pieza: una story es 1080x1920 y un carrusel de
    // feed 1080x1350. Antes se ignoraba el campo `format` y todo salía 4:5,
    // así que una story habría salido con franjas o recortada.
    id.formato = formatoDePieza(pieza);

    // Resolver las imágenes ANTES de validar: el validador necesita saber
    // cuáles existen de verdad (regla R5).
    for (const slide of pieza.slides || []) {
        slide.imagenResuelta = resolverImagen(slide.image);
    }

    // El validador es BLOQUEANTE. Si falla, no se renderiza nada.
    // Una advertencia que se puede ignorar deja de mirarse en tres semanas.
    const problemas = validarPieza(pieza);
    const bloqueantes = problemas.filter(p => p.nivel === 'error');

    if (problemas.length) {
        console.log('\nValidación:');
        for (const p of problemas) {
            console.log(`  ${p.nivel === 'error' ? '❌' : '⚠️ '} [${p.regla}] ${p.mensaje}`);
        }
    }
    if (bloqueantes.length) {
        console.log(`\nNo se renderiza: ${bloqueantes.length} regla(s) sin cumplir.`);
        return { ok: false, problemas };
    }
    if (soloValidar) {
        console.log('\nValidación OK (no se renderizó: --solo-validar).');
        return { ok: true, problemas, archivos: [] };
    }

    const { chromium } = await import('playwright');
    const navegador = await chromium.launch();
    const pagina = await navegador.newPage({
        viewport: { width: id.formato.ancho, height: id.formato.alto },
        // 2x y después se baja a tamaño nominal con Lanczos: el texto y los
        // bordes finos quedan mucho más limpios que renderizando a 1x. Las
        // dimensiones finales NO cambian (Instagram espera 1080px de ancho).
        deviceScaleFactor: 2,
    });

    const carpeta = path.join(SALIDA_BASE, pieza.id);
    await mkdir(carpeta, { recursive: true });

    const sharp = (await import('sharp')).default;
    const archivos = [];

    // Las imágenes se incrustan como data URI. Con `file://` el navegador las
    // bloquea al usar setContent() y la pieza sale sin foto ni logo, en
    // silencio. Se convierten una sola vez por pieza, no por slide.
    const aDataUri = async (ruta) => {
        if (!ruta) return null;
        const bytes = await readFile(ruta);
        const ext = path.extname(ruta).toLowerCase();
        const mime = ext === '.png' ? 'image/png'
            : ext === '.webp' ? 'image/webp'
            : ext === '.svg' ? 'image/svg+xml'
            : 'image/jpeg';
        return `data:${mime};base64,${bytes.toString('base64')}`;
    };

    id.logo = await aDataUri(id.logo);
    for (const slide of pieza.slides || []) {
        slide.imagenResuelta = await aDataUri(slide.imagenResuelta);
    }

    for (const [i, slide] of (pieza.slides || []).entries()) {
        const n = String(i + 1).padStart(2, '0');
        const html = htmlDeSlide(slide, id, pieza);

        await pagina.setContent(html, { waitUntil: 'networkidle' });
        // Un respiro para que la tipografía de Google termine de aplicarse: sin
        // esto, la primera slide sale con la fuente del sistema.
        await pagina.waitForTimeout(350);

        const png = await pagina.screenshot({ type: 'png' });
        const rutaPng = path.join(carpeta, `${n}.png`);
        await writeFile(rutaPng, png);

        // JPEG DE VERDAD, convertido. No es el PNG con otro nombre.
        const rutaJpg = path.join(carpeta, `${n}.jpg`);
        await sharp(png)
            .resize(id.formato.ancho, id.formato.alto, { kernel: 'lanczos3' })
            .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: '4:4:4' })
            .toFile(rutaJpg);

        archivos.push({ slide: i + 1, tipo: slide.type, png: rutaPng, jpg: rutaJpg });
        console.log(`  ✅ slide ${n} (${slide.type})`);
    }

    await navegador.close();

    console.log(`\n${archivos.length} slide(s) en public/social/${pieza.id}/`);
    console.log(`URL pública: https://atelieroptica.com.ar/social/${pieza.id}/01.jpg`);
    return { ok: true, problemas, archivos, pieza };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const ruta = process.argv[2];
    if (!ruta) {
        console.error('Falta el archivo de la pieza.\n  node scripts/social/render.mjs social/contenido/ejemplo.json');
        process.exit(1);
    }
    const r = await renderizarPieza(path.resolve(ruta), {
        soloValidar: process.argv.includes('--solo-validar'),
    });
    process.exit(r.ok ? 0 : 1);
}
