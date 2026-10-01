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

/**
 * Catálogo: [id, nombre, color, familia, fotos]. El id es el slug de la
 * pieza (`story-agos-<id>`); nombre y color son lo que se escribe en la placa;
 * familia decide la leyenda y la secuencia. Las fotos van por el NÚMERO con
 * que empiezan en la carpeta, en el orden de la secuencia.
 *
 * `foco` (0-1) corre el recorte horizontal de la foto en manos; `aire` abre
 * el perfil hacia arriba; `brillo` levanta una foto oscura. Son los mismos
 * ajustes finos con los que se aprobaron las placas del 29/9.
 */
const RECETA = 'receta', SOL = 'sol', CLIP = 'clip';
const M = [
    // ── Receta: frente, perfil, anteojo en manos ──────────────────────────
    ['atenea-c3', 'Atenea', 'C3', RECETA, ['003', '005', '528']],
    ['victoria-c5', 'Victoria', 'C5', RECETA, ['017', '018', '530']],
    ['dionisio-c2', 'Dionisio', 'C2', RECETA, ['020', '021', '522']],
    ['frida-c5', 'Frida', 'C5', RECETA, ['024', '025', '524']],
    ['polaris-c7', 'Polaris', 'C7', RECETA, ['027', '028', '532']],
    ['gala-c7', 'Gala', 'C7', RECETA, ['036', '037']],
    ['gala-c1', 'Gala', 'C1', RECETA, ['45', '46']],
    ['pegaso-c2', 'Pegaso', 'C2', RECETA, ['049', '050']],
    ['polaris-c2', 'Polaris', 'C2', RECETA, ['053', '054']],
    ['helena-c4', 'Helena', 'C4', RECETA, ['057', '058']],
    ['frida-c1', 'Frida', 'C1', RECETA, ['061', '062']],
    ['frida-c3', 'Frida', 'C3', RECETA, ['073', '074', '075']],
    ['victoria-c1', 'Victoria', 'C1', RECETA, ['079', '080', '081']],
    ['polaris-c6', 'Polaris', 'C6', RECETA, ['084', '085', '086']],
    ['victoria-c6', 'Victoria', 'C6', RECETA, ['094', '095', '096']],
    ['roma', 'Roma', '', RECETA, ['100', '101', '102']],
    ['hera', 'Hera', '', RECETA, ['110', '111', '112']],
    ['onix-negro', 'Onix', 'Negro', RECETA, ['115', '116', '117']],
    ['frida-c2', 'Frida', 'C2', RECETA, ['120', '121', '122']],
    ['andromeda-c6', 'Andrómeda', 'C6', RECETA, ['125', '126', '127']],
    ['olimpia', 'Olimpia', '', RECETA, ['130', '131', '132']],
    ['andromeda-c3', 'Andrómeda', 'C3', RECETA, ['135', '136', '137']],
    ['gala-c8', 'Gala', 'C8', RECETA, ['140', '141', '142']],
    ['helena-c3', 'Helena', 'C3', RECETA, ['145', '146', '147']],
    ['victoria-c7', 'Victoria', 'C7', RECETA, ['150', '151', '152']],
    ['helena-c5', 'Helena', 'C5', RECETA, ['155', '156', '157']],
    ['andromeda-c7', 'Andrómeda', 'C7', RECETA, ['160', '161', '162']],
    ['gala-c2', 'Gala', 'C2', RECETA, ['165', '166', '167']],
    ['gala-c3', 'Gala', 'C3', RECETA, ['170', '171', '172']],
    ['helena-c2', 'Helena', 'C2', RECETA, ['175', '176', '177']],
    ['andromeda-c4', 'Andrómeda', 'C4', RECETA, ['180', '181', '182']],
    ['altair-c1', 'Altair', 'C1', RECETA, ['185', '186', '187']],
    ['minerva-c2', 'Minerva', 'C2', RECETA, ['195', '196', '197']],
    ['aquiles-c4', 'Aquiles', 'C4', RECETA, ['200', '201', '202']],
    ['pandora-c5', 'Pandora', 'C5', RECETA, ['205', '206', '207']],
    ['ariadne-c2', 'Ariadne', 'C2', RECETA, ['210', '211', '212']],
    ['hermes-c4', 'Hermes', 'C4', RECETA, ['215', '216', '217']],
    ['ariadne-c1', 'Ariadne', 'C1', RECETA, ['220', '221', '222']],
    ['teseo-c1', 'Teseo', 'C1', RECETA, ['225', '226', '227']],
    ['diana-c2', 'Diana', 'C2', RECETA, ['230', '231', '232']],
    ['aquiles-c1', 'Aquiles', 'C1', RECETA, ['235', '236', '237']],
    ['venus-c1', 'Venus', 'C1', RECETA, ['240', '241', '242']],
    ['hermes-c3', 'Hermes', 'C3', RECETA, ['245', '246', '247']],
    ['poseidon-c3', 'Poseidon', 'C3', RECETA, ['250', '251', '252']],
    ['teseo-c4', 'Teseo', 'C4', RECETA, ['255', '256', '257']],
    ['orfeo-c4', 'Orfeo', 'C4', RECETA, ['260', '261', '262']],
    ['cronos-c1', 'Cronos', 'C1', RECETA, ['271', '272', '273']],
    ['cronos-c3', 'Cronos', 'C3', RECETA, ['276', '277', '278']],
    ['orfeo-c1', 'Orfeo', 'C1', RECETA, ['281', '282', '283']],
    ['orfeo-c3', 'Orfeo', 'C3', RECETA, ['286', '287', '288']],
    ['hermes-c1', 'Hermes', 'C1', RECETA, ['291', '292', '293']],
    ['poseidon-c2', 'Poseidon', 'C2', RECETA, ['296', '297', '298']],
    ['pandora-c3', 'Pandora', 'C3', RECETA, ['306', '307', '308']],
    ['hermes-c2', 'Hermes', 'C2', RECETA, ['311', '312', '313']],
    ['orfeo-c2', 'Orfeo', 'C2', RECETA, ['316', '317', '318']],
    ['diana-c4', 'Diana', 'C4', RECETA, ['321', '322', '323']],
    ['diana-c3', 'Diana', 'C3', RECETA, ['331', '332', '333']],
    ['venus-c2', 'Venus', 'C2', RECETA, ['336', '337', '338']],
    ['hestia-c1', 'Hestia', 'C1', RECETA, ['341', '342', '343']],
    ['hestia-c2', 'Hestia', 'C2', RECETA, ['346', '347', '348']],
    ['selene-c4', 'Selene', 'C4', RECETA, ['366', '367', '368']],
    ['selene-c5', 'Selene', 'C5', RECETA, ['371', '372', '373']],
    ['rigel-c3', 'Rigel', 'C3', RECETA, ['381', '382', '383']],
    ['rigel-c1', 'Rigel', 'C1', RECETA, ['386', '387', '388']],
    ['orion-c1', 'Orión', 'C1', RECETA, ['396', '397', '398']],
    ['electra-c5', 'Electra', 'C5', RECETA, ['410', '411', '412']],
    ['electra-c4', 'Electra', 'C4', RECETA, ['415', '416', '417']],
    ['minerva-c3', 'Minerva', 'C3', RECETA, ['420', '421', '422']],
    // ── Clip-on: sin clip, frente con clip, perfil, anteojo en manos ──────
    ['venice', 'Venice', '', CLIP, ['425', '428', '429', '430'], { foco: 0.60, ratio: 4 / 5 }],
    ['torino-c4', 'Torino', 'C4', CLIP, ['433', '438', '439', '441'], { foco: 0.45, ratio: 3 / 4 }],
    ['torino-c3', 'Torino', 'C3', CLIP, ['444', '448', '449', '450']],
    ['palermo-c3', 'Palermo', 'C3', CLIP, ['453', '457', '458', '459']],
    ['verona-c1', 'Verona', 'C1', CLIP, ['462', '464', '465', '468']],
    ['capri-c5', 'Capri', 'C5', CLIP, ['471', '475', '476', '477'], { foco: 0.45 }],
    ['monaco-c2', 'Monaco', 'C2', CLIP, ['480', '484', '485', '486'], { ratio: 0.9 }],
    ['riviera-c1', 'Riviera', 'C1', CLIP, ['489', '493', '494', '495'], { foco: 0.56, ratio: 0.9 }],
    ['milano-c1', 'Milano', 'C1', CLIP, ['498', '499'], { brillo: 0.86 }],   // no tiene foto con clip ni en manos
    ['florence-c2', 'Florence', 'C2', CLIP, ['502', '512', '513', '515'], { ratio: 0.9 }],
    // ── Sol: frente, perfil, anteojo en manos ─────────────────────────────
    ['antares-c1', 'Antares', 'C1', SOL, ['535', '536', '537']],
    ['sirio-c1', 'Sirio', 'C1', SOL, ['540', '541', '542']],
    ['sirio-c2', 'Sirio', 'C2', SOL, ['545', '546', '547']],
    ['deneb-c2', 'Deneb', 'C2', SOL, ['550', '551', '552']],
    ['vega-c2', 'Vega', 'C2', SOL, ['555', '556', '557']],
    ['adhara-c4', 'Adhara', 'C4', SOL, ['560', '561', '562'], { foco: 0.49, aire: 0.11 }],
    ['deneb-c1', 'Deneb', 'C1', SOL, ['565', '566', '567']],
    ['vega-c1', 'Vega', 'C1', SOL, ['570', '571', '572']],
    ['mizar-c2', 'Mizar', 'C2', SOL, ['575', '576', '577']],
    ['fenix-c1', 'Fénix', 'C1', SOL, ['580', '581', '582']],
    ['canopo-c2', 'Cánopo', 'C2', SOL, ['585', '586', '587'], { aire: 0.11 }],
    ['nashira-c3', 'Nashira', 'C3', SOL, ['590', '591', '592'], { foco: 0.49, aire: 0.11 }],
];

const LEYENDA = { [RECETA]: 'Armazón de receta', [SOL]: 'Lentes de sol', [CLIP]: 'Clip-on · receta + sol' };
const SECUENCIA = {
    [RECETA]: ['frente', 'perfil', 'anteojo'],
    [SOL]: ['frente', 'perfil', 'anteojo'],
    [CLIP]: ['sinclip', 'frente', 'perfil', 'anteojo'],
};
/** Milano solo tiene "sin clip" y perfil. */
const SECUENCIA_CORTA = { [CLIP]: ['sinclip', 'perfil'], [RECETA]: ['frente', 'perfil'], [SOL]: ['frente', 'perfil'] };

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

const retoque = (img, brillo) =>
    img.modulate({ brightness: brillo, saturation: 1.03 }).linear(1.06, -6).sharpen({ sigma: 0.6 });

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
const oro = id.colores.marcaClara;
const logo = 'data:image/png;base64,' + readFileSync(id.logo).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

const generadas = [];
for (const [slug, nombre, color, familia, numeros, ajustes = {}] of M) {
    if (soloUno && slug !== soloUno) continue;
    const piezaId = `story-agos-${slug}`;
    const secuencia = (numeros.length === 2 ? SECUENCIA_CORTA : SECUENCIA)[familia];
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
        const img = buf.toString('base64');
        await page.setContent(`<html><head><link href="${id.googleFonts}" rel="stylesheet"><style>
body{margin:0;width:1080px;height:1920px;overflow:hidden;position:relative;background:${id.oscuro};font-family:${id.fuentes.titulo}}
.f{position:absolute;inset:0;background:url(data:image/jpeg;base64,${img}) center/cover}
.g{position:absolute;left:0;right:0;bottom:0;height:700px;background:linear-gradient(transparent,${id.oscuro})}
.t{position:absolute;left:0;right:0;bottom:170px;text-align:center;color:#fff}
.k{font-size:30px;letter-spacing:10px;color:${oro};text-transform:uppercase;margin-bottom:10px}
.n{font-size:130px;font-weight:700;letter-spacing:4px;line-height:1}
.c{font-size:40px;color:${oro};letter-spacing:6px;margin-top:8px}
.l{position:absolute;bottom:60px;left:50%;transform:translateX(-50%);height:54px;filter:brightness(0) invert(1)}
</style></head><body><div class="f"></div><div class="g"></div>
<div class="t"><div class="k">${LEYENDA[familia]}</div><div class="n">${nombre}</div>${color ? `<div class="c">${color}</div>` : ''}</div>
<img class="l" src="${logo}"></body></html>`, { waitUntil: 'networkidle' });
        const destino = path.join(salida, `${String(i + 1).padStart(2, '0')}.jpg`);
        await page.screenshot({ path: destino, type: 'jpeg', quality: 88 });
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
        const secuencia = (numeros.length === 2 ? SECUENCIA_CORTA : SECUENCIA)[familia];
        porFamilia[familia].push({ id: `story-agos-${slug}`, tipo: familia, slides: secuencia.length });
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
