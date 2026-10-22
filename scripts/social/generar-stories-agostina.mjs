#!/usr/bin/env node
/**
 * Stories de catálogo con las fotos de Agostina (sesión Gutiérrez 2026).
 *
 *   node scripts/social/generar-stories-agostina.mjs            # todas
 *   node scripts/social/generar-stories-agostina.mjs helena-c4  # una sola
 *   node scripts/social/generar-stories-agostina.mjs --fotos /otra/carpeta
 *
 * POR QUÉ EXISTE. Las stories de producto que salían a diario ("anteojo
 * suelto + precio") no atraían (Ishtar, 1/10/2026). Lo que sí funcionó fueron
 * las fotos de Agostina con el nombre abajo, que se subieron a mano el 29/9 y
 * se agotaron a las 24 h. Este script las genera para que el cron de stories
 * las publique todos los días, alternadas con las de contenido.
 *
 * FORMATO (aprobado el 29/9/2026, no cambiarlo sin mostrarle antes): foto a
 * pantalla completa + degradado oscuro abajo + leyenda chica dorada + nombre
 * grande + color + logo. Nunca franja negra ni cartel sobre fondo liso. Sin
 * precio: por eso NO son `fuente: "base"` y no vencen (R6 no aplica, no hay
 * número adentro).
 *
 * SECUENCIA por modelo: receta y sol = frente → perfil → anteojo en manos;
 * clip-on = sin clip → frente con clip → perfil → anteojo en manos. Cada
 * modelo es UNA pieza con varias slides (`01.jpg`, `02.jpg`, …) y el cron las
 * publica seguidas, así el que mira ve el modelo entero y no una foto suelta.
 *
 * RECORTES. Ningún anteojo cortado y sin aire de más: el frente se recorta
 * desde el pelo; el perfil apoyado en la cara (no en el pelo); la foto del
 * anteojo en manos es apaisada, va entera arriba y se funde hacia abajo con
 * su propia continuación desenfocada.
 *
 * QUÉ MODELOS. Los de la lista de abajo: fotografiados Y publicados en la
 * tienda con stock (cruce hecho el 1/10/2026 contra la copia local de
 * producción). Dar de alta un modelo = agregarlo a la lista; si deja de
 * venderse, sacarlo de acá y correr el script, que reescribe el carril.
 *
 * SALIDA: `public/social/story-agos-<modelo>/NN.jpg` (JPEG real, Instagram no
 * acepta PNG renombrado), `social/contenido/story-agos-<modelo>.json` y el
 * carril `agostina` de `social/stories-diarias.json`, intercalando receta /
 * sol / clip-on para que no salgan cinco clip-on seguidos.
 *
 * Las fotos fuente NO viven en el repo (son 600 MB): la carpeta se pasa con
 * `--fotos` o se toma la del escritorio de Ishtar.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { cargarIdentidad, RAIZ } from './identidad.mjs';
import { renderizarPlaca } from './placa-story-modelo.mjs';
import { retoque } from './retoque-foto.mjs';
import { MODELOS as M, RECETA, SOL, CLIP } from './modelos-agostina.mjs';

const sharp = createRequire(import.meta.url)('sharp');

const args = process.argv.slice(2);
// Un argumento suelto es el modelo a regenerar; lo que sigue a `--fotos` o
// `--vista` es el valor de esa opción, no un modelo.
const soloUno = args.find((a, i) => !a.startsWith('--') && !['--fotos', '--vista'].includes(args[i - 1]));
const FOTOS = args.includes('--fotos')
    ? args[args.indexOf('--fotos') + 1]
    : path.join(os.homedir(), 'Desktop', 'Pagina web atelier', 'Fotos-Agos-Gutierrez-2026');
const VISTA = args.includes('--vista') ? args[args.indexOf('--vista') + 1] : null;

if (!existsSync(FOTOS)) {
    console.error(`No encuentro la carpeta de fotos: ${FOTOS} (pasarla con --fotos).`);
    process.exit(1);
}

// La lista de modelos y sus fotos vive en modelos-agostina.mjs (la comparte
// con generar-feed-modelos.mjs).

const LEYENDA = { [RECETA]: 'Armazón de receta', [SOL]: 'Lentes de sol', [CLIP]: 'Clip-on · receta + sol' };
const SECUENCIA = {
    [RECETA]: ['frente', 'perfil', 'anteojo'],
    [SOL]: ['frente', 'perfil', 'anteojo'],
    [CLIP]: ['sinclip', 'frente', 'perfil', 'anteojo'],
};
// La foto del anteojo en manos SE RENDERIZA pero NO SALE (Ishtar, 3/10/2026:
// el fondo desenfocado se ve como "un cuerpo estirado fantasma"). El carril
// cuenta solo las slides anteriores; el archivo queda por si se rediseña.
const SLIDES_QUE_SALEN = (secuencia) => secuencia.filter(t => t !== 'anteojo').length;
/** Milano solo tiene "sin clip" y perfil. */
const SECUENCIA_CORTA = { [CLIP]: ['sinclip', 'perfil'], [RECETA]: ['frente', 'perfil'], [SOL]: ['frente', 'perfil'] };
/** Un modelo con UNA foto (Andrómeda C7: su perfil tiene los ojos cerrados). */
const SECUENCIA_SOLA = { [CLIP]: ['frente'], [RECETA]: ['frente'], [SOL]: ['frente'] };
const secuenciaDe = (familia, numeros) =>
    (numeros.length === 1 ? SECUENCIA_SOLA : numeros.length === 2 ? SECUENCIA_CORTA : SECUENCIA)[familia];

const archivos = readdirSync(FOTOS);
function fotoPorNumero(numero) {
    const f = archivos.find(a => a.startsWith(`${numero} - `) && /\.jpe?g$/i.test(a));
    if (!f) throw new Error(`No hay foto que empiece con "${numero} - " en ${FOTOS}`);
    return path.join(FOTOS, f);
}

async function dimensiones(base) {
    const m = await base.metadata();
    const girada = (m.orientation ?? 1) >= 5;
    return { Wo: girada ? m.height : m.width, Ho: girada ? m.width : m.height };
}


/** Extremos horizontales de lo oscuro (armazón, pelo) en una franja de filas. */
function extremosOscuros(px, W, y0, y1, umbral = 120) {
    let x0 = W, x1 = 0;
    for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) if (px(x, y) < umbral) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    return x1 >= x0 ? [x0, x1] : null;
}

/**
 * Recorte 9:16 con fondo propio: si el recorte pedido es más alto que la
 * foto, lo que falta abajo se rellena con la misma foto desenfocada (queda
 * bajo el degradado, no se nota). Así un recorte puede ser más ANCHO que lo
 * que da 9:16 de la foto entera sin cortar nada.
 */
async function recortarConFondo(base, { left, top, width, height }, Ho, brillo) {
    const visible = Math.min(height, Ho - top);
    const altoFoto = Math.round(1920 * visible / height);
    const foto = await retoque(base.clone().extract({ left: left | 0, top: top | 0, width: width | 0, height: visible | 0 }).resize(1080, altoFoto), brillo)
        .png().toBuffer();
    if (altoFoto >= 1920) return sharp(foto).jpeg({ quality: 90 }).toBuffer();
    const franja = Math.max(20, Math.round(altoFoto * 0.14));
    const fondo = await sharp(foto).extract({ left: 0, top: altoFoto - franja, width: 1080, height: franja })
        .resize(1080, 1920, { fit: 'fill' }).blur(45).toBuffer();
    return sharp(fondo).composite([{ input: foto, left: 0, top: 0 }]).jpeg({ quality: 90 }).toBuffer();
}

/**
 * Frente: 9:16 desde el pelo, centrado en la cabeza. Si el armazón es más
 * ancho que lo que entra en 9:16 (Victoria C5, Dionisio, Gala C7), el recorte
 * se abre hasta incluirlo entero: ningún anteojo cortado.
 */
async function recortarFrente(file, brillo, margen = 0.015) {
    const base = sharp(file).rotate();
    const { data, info } = await base.clone().resize(400).greyscale().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, px = (x, y) => data[y * W + x];
    let top = 0, cx = W / 2;
    for (let y = 0; y < H; y++) {
        let n = 0;
        for (let x = (W * 0.25) | 0; x < W * 0.75; x++) if (px(x, y) < 110) n++;
        if (n > 6) {
            top = y;
            let sx = 0, k = 0;
            for (let x = (W * 0.25) | 0; x < W * 0.75; x++) if (px(x, y + 8) < 110) { sx += x; k++; }
            if (k) cx = sx / k;
            break;
        }
    }
    const { Wo, Ho } = await dimensiones(base);
    const s = Wo / W;
    let t = Math.max(0, top * s - Ho * margen), ch = Ho - t, cw = ch * 9 / 16;
    if (cw > Wo) { cw = Wo; ch = cw * 16 / 9; }
    let left = Math.max(0, Math.min(Wo - cw, cx * s - cw / 2));
    // La franja de los ojos: si el armazón se sale del recorte, abrirlo.
    const ext = extremosOscuros(px, W, top + ((H - top) * 0.18) | 0, top + ((H - top) * 0.42) | 0);
    if (ext) {
        const aire = Wo * 0.03;
        const x0 = Math.max(0, ext[0] * s - aire), x1 = Math.min(Wo, ext[1] * s + aire);
        if (x0 < left || x1 > left + cw) {
            cw = Math.min(Wo, Math.max(cw, x1 - x0));
            ch = cw * 16 / 9;
            left = Math.max(0, Math.min(Wo - cw, (x0 + x1) / 2 - cw / 2));
        }
    }
    return recortarConFondo(base, { left, top: t, width: cw, height: ch }, Ho, brillo);
}

/** Perfil: centra en el ancho real de la cabeza (pelo + cara + anteojo) y se apoya en la cara, no en el pelo. */
async function recortarPerfil(file, brillo, aire = 0.05) {
    const base = sharp(file).rotate();
    const { data, info } = await base.clone().resize(400).greyscale().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, px = (x, y) => data[y * W + x];
    let top = 0;
    for (let y = 0; y < H; y++) {
        let n = 0;
        for (let x = 0; x < W; x++) if (px(x, y) < 110) n++;
        if (n > 6) { top = y; break; }
    }
    let x1 = 0;
    const hasta = Math.min(H, top + Math.round(H * 0.30));
    for (let y = top; y < hasta; y++) for (let x = 0; x < W; x++) if (px(x, y) < 185 && x > x1) x1 = x;
    const { Wo, Ho } = await dimensiones(base);
    const s = Wo / W;
    let t = Math.max(0, top * s - Ho * aire), ch = Ho - t, cw = ch * 9 / 16;
    if (cw > Wo) { cw = Wo; ch = cw * 16 / 9; }
    const derecha = Math.min(Wo, x1 * s + Wo * 0.05);
    const left = Math.max(0, Math.min(Wo - cw, derecha - cw));
    return retoque(base.extract({ left: left | 0, top: t | 0, width: cw | 0, height: ch | 0 }).resize(1080, 1920), brillo)
        .jpeg({ quality: 90 }).toBuffer();
}

/**
 * Anteojo en manos: la foto apaisada entera arriba, fundida sobre su propia
 * continuación desenfocada. `ratio` es ancho/alto del recorte; si el armazón
 * (lo oscuro de la franja central) se sale, el recorte se abre hasta incluirlo.
 */
async function recortarAnteojo(file, brillo, foco = 0.55, ratio = 4 / 5) {
    const base = sharp(file).rotate();
    const { Wo, Ho } = await dimensiones(base);
    const { data, info } = await base.clone().resize(400).greyscale().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, px = (x, y) => data[y * W + x];
    const ch = Ho;
    let cw = Math.min(Wo, Math.round(ch * ratio));
    let left = Math.max(0, Math.min(Wo - cw, Math.round(foco * Wo - cw / 2)));
    // Si en el borde del recorte hay algo oscuro (una patilla, un clip), se
    // abre de a poco hasta que el borde quede limpio. Se mira solo la franja
    // de las manos y se abre desde el borde, no hasta "todo lo oscuro": el
    // pelo que cae a los costados también es oscuro y abriría a pantalla entera.
    const s = W / Wo, y0 = (H * 0.4) | 0, y1 = (H * 0.75) | 0;
    const bordeSucio = (xo) => {
        const x = Math.max(0, Math.min(W - 1, (xo * s) | 0));
        for (let y = y0; y < y1; y++) if (px(x, y) < 90) return true;
        return false;
    };
    const paso = Math.round(Wo * 0.02);
    for (let i = 0; i < 40 && cw < Wo; i++) {
        const izq = bordeSucio(left + paso), der = bordeSucio(left + cw - paso);
        if (!izq && !der) break;
        if (izq && left > 0) { left = Math.max(0, left - paso); cw += paso; }
        if (der && left + cw < Wo) cw += paso;
        if (!izq && !(der && left + cw <= Wo)) { if (left + cw > Wo) cw = Wo - left; }
        cw = Math.min(cw, Wo - left);
    }
    const altoFoto = Math.round(1080 * ch / cw);
    const foto = await retoque(base.extract({ left, top: 0, width: cw, height: ch }).resize(1080, altoFoto), brillo)
        .png().toBuffer();
    const franja = Math.round(altoFoto * 0.14);
    const fondo = await sharp(foto).extract({ left: 0, top: altoFoto - franja, width: 1080, height: franja })
        .resize(1080, 1920, { fit: 'fill' }).blur(45).toBuffer();
    const fundido = 320;
    const mascara = Buffer.from(
        `<svg width="1080" height="${altoFoto}" xmlns="http://www.w3.org/2000/svg"><defs>` +
        `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="${(altoFoto - fundido) / altoFoto}" stop-color="#fff" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>` +
        `<rect width="1080" height="${altoFoto}" fill="url(#g)"/></svg>`);
    const fotoAlfa = await sharp(foto).ensureAlpha().composite([{ input: mascara, blend: 'dest-in' }]).png().toBuffer();
    return sharp(fondo).composite([{ input: fotoAlfa, left: 0, top: 0 }]).jpeg({ quality: 90 }).toBuffer();
}

const id = await cargarIdentidad();
const logo = 'data:image/png;base64,' + readFileSync(id.logo).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

const generadas = [];
for (const [slug, nombre, color, familia, numeros, ajustes = {}] of M) {
    if (soloUno && slug !== soloUno) continue;
    const piezaId = `story-agos-${slug}`;
    const secuencia = secuenciaDe(familia, numeros);
    if (secuencia.length !== numeros.length) throw new Error(`${slug}: ${numeros.length} fotos para una secuencia de ${secuencia.length}`);
    const brillo = ajustes.brillo ?? 1.04;
    const salida = path.join(RAIZ, 'public', 'social', piezaId);
    rmSync(salida, { recursive: true, force: true });
    mkdirSync(salida, { recursive: true });

    for (const [i, tipo] of secuencia.entries()) {
        const file = fotoPorNumero(numeros[i]);
        const buf = tipo === 'anteojo' ? await recortarAnteojo(file, brillo, ajustes.foco, ajustes.ratio)
            : tipo === 'perfil' ? await recortarPerfil(file, brillo, ajustes.aire)
                : await recortarFrente(file, brillo);
        const destino = path.join(salida, `${String(i + 1).padStart(2, '0')}.jpg`);
        await renderizarPlaca(page, { id, logo, fotoJpg: buf, leyenda: LEYENDA[familia], nombre, color, destino });
    }

    writeFileSync(path.join(RAIZ, 'social', 'contenido', `${piezaId}.json`), JSON.stringify({
        id: piezaId,
        format: '9:16',
        theme: 'dark',
        pilar: 'agostina',
        fuente: 'fotos-agostina',   // sin precio adentro: no vence (R6 no aplica)
        temas: ['armazones', familia],
        producto: { nombre, color, familia },
        caption: `${nombre}${color ? ' ' + color : ''} · Cápsula Escarlata`,
        slides: secuencia.map((tipo, i) => ({ type: 'foto', role: tipo, image: `social/${piezaId}/${String(i + 1).padStart(2, '0')}.jpg` })),
    }, null, 2) + '\n');
    generadas.push({ id: piezaId, familia, slides: secuencia.length });
    console.log(`✅ ${piezaId} (${secuencia.length} slides)`);
}
await browser.close();

// ── El carril. Se reescribe entero desde la lista de arriba, intercalando
// familias: receta es el 75% del catálogo, así que entre cada dos de receta
// cae una de sol o clip-on y nunca salen cinco clip-on seguidos.
if (!soloUno) {
    const porFamilia = { [RECETA]: [], [SOL]: [], [CLIP]: [] };
    for (const [slug, , , familia, numeros] of M) {
        const secuencia = secuenciaDe(familia, numeros);
        porFamilia[familia].push({ id: `story-agos-${slug}`, tipo: familia, slides: SLIDES_QUE_SALEN(secuencia) });
    }
    const otras = [];
    for (let i = 0; porFamilia[SOL].length || porFamilia[CLIP].length; i++) {
        const de = (i % 2 === 0 ? porFamilia[SOL] : porFamilia[CLIP]);
        const alt = de === porFamilia[SOL] ? porFamilia[CLIP] : porFamilia[SOL];
        otras.push((de.length ? de : alt).shift());
    }
    const carril = [];
    const paso = Math.max(1, Math.floor(porFamilia[RECETA].length / otras.length));
    let k = 0;
    for (const r of porFamilia[RECETA]) {
        carril.push(r);
        if (++k % paso === 0 && otras.length) carril.push(otras.shift());
    }
    carril.push(...otras);

    const rutaCarriles = path.join(RAIZ, 'social', 'stories-diarias.json');
    const json = JSON.parse(readFileSync(rutaCarriles, 'utf-8'));
    json.carriles.agostina = carril;
    writeFileSync(rutaCarriles, JSON.stringify(json, null, 2) + '\n');
    console.log(`📋 carril "agostina": ${carril.length} modelos, ${carril.reduce((s, e) => s + e.slides, 0)} stories`);
}

// Vista previa: una fila por modelo, para mostrar ANTES de que salga nada.
if (VISTA) {
    const filas = [];
    for (const g of generadas) {
        const celdas = [];
        for (let i = 1; i <= g.slides; i++) {
            celdas.push(await sharp(path.join(RAIZ, 'public', 'social', g.id, `${String(i).padStart(2, '0')}.jpg`)).resize(216, 384).toBuffer());
        }
        filas.push(celdas);
    }
    const porHoja = 12;
    for (let h = 0; h * porHoja < filas.length; h++) {
        const tanda = filas.slice(h * porHoja, (h + 1) * porHoja);
        const comp = [];
        tanda.forEach((celdas, r) => celdas.forEach((input, c) => comp.push({ input, left: c * 224, top: r * 392 })));
        await sharp({ create: { width: 4 * 224, height: tanda.length * 392, channels: 3, background: '#fff' } })
            .composite(comp).jpeg({ quality: 80 }).toFile(`${VISTA}-${h + 1}.jpg`);
    }
    console.log(`🖼  vista previa en ${VISTA}-N.jpg`);
}
