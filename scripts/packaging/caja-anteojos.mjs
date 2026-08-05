#!/usr/bin/env node
/**
 * Caja impresa para el packaging de anteojos — troquel + arte, listos para imprenta.
 *
 *   node scripts/packaging/caja-anteojos.mjs                 # 20 × 10 × 10 cm, tema claro
 *   node scripts/packaging/caja-anteojos.mjs --tema oscuro
 *   node scripts/packaging/caja-anteojos.mjs --largo 180 --ancho 90 --alto 90
 *
 * Genera en `scripts/packaging/salida/`:
 *   - `...-arte.pdf`      lo que se imprime (escala 1:1, con 3 mm de sangrado)
 *   - `...-troquel.pdf`   solo corte y hendido, con la ficha técnica para el troquelador
 *   - `...-preview.png`   para mirar el desarrollo de un vistazo
 *   - `...-mockup.png`    la caja armada, para aprobar el diseño
 *
 * Por qué así y no un diseño hecho a mano:
 *
 * 1. La caja se DECLARA (medidas + textos acá arriba) y el troquel se calcula.
 *    Si mañana la caja es de 18 cm, se cambia un número y el desarrollo entero
 *    —solapas, uñas, ranuras, sangrado— se recalcula solo. Un troquel dibujado a
 *    mano hay que volver a dibujarlo, y ahí es donde entran los milímetros mal.
 *
 * 2. Los colores salen de `globals.css` vía `identidad.mjs`, igual que las piezas
 *    de redes. Una sola fuente de verdad: el día que cambie el bronce de la marca,
 *    la caja nueva sale con el bronce nuevo. PROHIBIDO escribir un color acá.
 *
 * 3. Los datos de contacto se leen de `src/lib/business-info.ts`. Una dirección
 *    vieja en una caja no se corrige con un deploy: se tira la tirada entera.
 *
 * Contraste (hay gente en el equipo con baja visión, y la caja la lee un cliente
 * en la vereda): el bronce sobre crema da 3,5:1 — alcanza para filetes y texto
 * grande, NO para los datos. Todo lo que hay que leer va en la tinta oscura.
 */
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarIdentidad, RAIZ } from '../social/identidad.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(AQUI, 'salida');

/* ────────────────────────────────────────────────────────────────────────────
   LO QUE DICE LA CAJA
   Todo el texto impreso vive acá. Cambiar una línea acá y volver a correr el
   script es todo lo que hace falta para cambiar lo que dice la caja.
   ──────────────────────────────────────────────────────────────────────────── */
const TEXTOS = {
    /** Frente: la cara grande. Va el logo y una sola línea. */
    tagline: 'PROFESIONALISMO · ÉTICA · DISEÑO',
    /** Tapa: es lo primero que se ve al abrir. */
    tapa: 'GRACIAS POR ELEGIRNOS',
    /** Dorso: los datos. Salen de business-info.ts, no se escriben acá. */
    dorsoTitulo: 'Dónde encontrarnos',
    /** Laterales: bajo el ícono. */
    lateral: 'Anteojos hechos a medida',
};

/* ────────────────────────────────────────────────────────────────────────────
   MEDIDAS
   ──────────────────────────────────────────────────────────────────────────── */
const MEDIDAS_POR_DEFECTO = { largo: 200, ancho: 100, alto: 100 }; // mm — 20 × 10 × 10 cm

/** Sangrado: 3 mm es lo que pide cualquier imprenta para cortar sin filo blanco. */
const SANGRADO = 3;

/**
 * El desarrollo plano de una caja plegadiza de solapas cruzadas (tuck end
 * invertido): la tapa cuelga del dorso, el fondo cuelga del frente, y las
 * solapas de polvo cuelgan de los laterales.
 *
 * Se eligió tuck end invertido y no fondo automático porque es el troquel que
 * cualquier imprenta tiene: sale más barato y se arma sin pegar más que la
 * pestaña lateral. Si el anteojo va con estuche rígido y la caja pesa, pedirle
 * a la imprenta que cambie SOLO el fondo por uno automático (crash-lock) — el
 * resto del troquel no se toca.
 */
function geometria({ largo: L, ancho: A, alto: H }) {
    const pestana = 18;                     // pestaña de pegado
    const cierre = A - 2;                   // panel de cierre: tapa el hueco de A
    const una = 18;                         // la uña que entra en la pared opuesta
    const polvo = Math.round(A * 0.45);     // solapas de polvo: no se tocan entre sí
    const retiro = 1.5;                     // holgura para que la tapa entre sola
    const chaflan = 6;                      // esquinas matadas: no enganchan al cerrar

    const x = {
        p0: 0,
        p1: pestana,
        p2: pestana + L,
        p3: pestana + L + A,
        p4: pestana + L + A + L,
        p5: pestana + L + A + L + A,
    };

    const bodyT = cierre + una;
    const y = {
        extTop: 0,
        unaTop: una,
        polvoTop: bodyT - polvo,
        bodyT,
        bodyB: bodyT + H,
        polvoBot: bodyT + H + polvo,
        unaBot: bodyT + H + cierre,
        extBot: bodyT + H + cierre + una,
    };

    return { L, A, H, pestana, cierre, una, polvo, retiro, chaflan, x, y, ancho: x.p5, alto: y.extBot };
}

/* ── El contorno ─────────────────────────────────────────────────────────────
   Se recorre el perímetro entero como UN polígono cerrado. No son rectángulos
   superpuestos: si lo fueran, el troquel cortaría también por los pliegues y la
   caja saldría en pedazos. */

/** Media luna para sacar la tapa con el dedo. Polilínea a propósito: así el
 *  contorno espeja y se recorre al revés sin pelearse con los arcos de SVG. */
function muesca(xc, y, rx = 16, ry = 9, pasos = 18) {
    const pts = [];
    for (let i = 0; i <= pasos; i++) {
        const t = Math.PI - (Math.PI * i) / pasos;
        pts.push([xc + rx * Math.cos(t), y + ry * Math.sin(t)]);
    }
    return pts;
}

/** Borde libre (el que se abre): recto con la media luna en el medio. */
function bordeLibre(g, xa, xb, conMuesca) {
    const y = g.y.bodyT;
    if (!conMuesca) return [[xa, y], [xb, y]];
    return [[xa, y], ...muesca((xa + xb) / 2, y), [xb, y]];
}

/** Solapa de polvo: la que dobla primero y hace de tope. */
function solapaPolvo(g, xa, xb) {
    const { retiro: r, chaflan: c } = g;
    const { bodyT, polvoTop } = g.y;
    return [
        [xa, bodyT],
        [xa + r, polvoTop + c],
        [xa + r + c, polvoTop],
        [xb - r - c, polvoTop],
        [xb - r, polvoTop + c],
        [xb, bodyT],
    ];
}

/** Panel de cierre + uña. El retiro lateral es lo que hace que entre sola. */
function panelCierre(g, xa, xb) {
    const { retiro: r, chaflan: c } = g;
    const { bodyT, unaTop, extTop } = g.y;
    return [
        [xa + r, bodyT],
        [xa + r, unaTop],
        [xa + r + c, extTop],
        [xb - r - c, extTop],
        [xb - r, unaTop],
        [xb - r, bodyT],
    ];
}

function contorno(g) {
    const { x, y } = g;
    const espejo = (p) => [p[0], y.bodyT + y.bodyB - p[1]];

    // Arriba, de izquierda a derecha: frente libre, polvo, tapa, polvo.
    const arriba = [
        ...bordeLibre(g, x.p1, x.p2, true),
        ...solapaPolvo(g, x.p2, x.p3),
        ...panelCierre(g, x.p3, x.p4),
        ...solapaPolvo(g, x.p4, x.p5),
    ];

    // Abajo es el mismo dibujo espejado — y recorrido al revés, porque el
    // perímetro vuelve de derecha a izquierda.
    const abajo = [
        ...panelCierre(g, x.p1, x.p2),
        ...solapaPolvo(g, x.p2, x.p3),
        ...bordeLibre(g, x.p3, x.p4, true),
        ...solapaPolvo(g, x.p4, x.p5),
    ].map(espejo).reverse();

    const pestana = [
        [x.p1, y.bodyB],
        [x.p0, y.bodyB - g.chaflan],
        [x.p0, y.bodyT + g.chaflan],
    ];

    const pts = [...arriba, [x.p5, y.bodyB], ...abajo, ...pestana];
    return 'M ' + pts.map(([px, py]) => `${px.toFixed(2)},${py.toFixed(2)}`).join(' L ') + ' Z';
}

/** Hendidos: por dónde dobla. Nunca se cortan. */
function hendidos(g) {
    const { x, y } = g;
    const v = (px) => `M ${px},${y.bodyT} L ${px},${y.bodyB}`;
    const h = (py, xa, xb) => `M ${xa},${py} L ${xb},${py}`;
    return [
        v(x.p1), v(x.p2), v(x.p3), v(x.p4),          // las cuatro aristas verticales
        h(y.bodyT, x.p2, x.p5),                       // arriba: dobla todo menos el frente
        h(y.bodyB, x.p1, x.p3), h(y.bodyB, x.p4, x.p5), // abajo: todo menos el dorso
        h(y.unaTop, x.p3 + g.retiro, x.p4 - g.retiro),  // pliegue de la uña de la tapa
        h(y.bodyT + y.bodyB - y.unaTop, x.p1 + g.retiro, x.p2 - g.retiro), // uña del fondo
    ].join(' ');
}

/* ── Datos del negocio ───────────────────────────────────────────────────────
   Se leen del TypeScript en vez de copiarlos: una dirección desactualizada en
   una caja impresa se paga con la tirada entera. */
async function datosDelNegocio() {
    const ts = await readFile(path.join(RAIZ, 'src', 'lib', 'business-info.ts'), 'utf-8');
    const campo = (nombre) => {
        const m = ts.match(new RegExp(`\\b${nombre}:\\s*"([^"]+)"`));
        if (!m) throw new Error(`No se pudo leer "${nombre}" de src/lib/business-info.ts`);
        return m[1];
    };
    const instagram = campo('instagramUrl').replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, '');
    return {
        direccion: campo('address'),
        telefono: campo('phone'),
        web: campo('websiteDisplay'),
        instagram,
    };
}

/* ── Arte ────────────────────────────────────────────────────────────────────
   Cada cara es una función que devuelve HTML. Las mismas funciones dibujan el
   desarrollo plano Y el mockup 3D: si se cambia el frente, cambia en los dos.
   Es la regla de siempre — un dato que se ve en dos lados se arma en un solo
   lugar. */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Logo tintado: el PNG se usa como máscara y el color lo pone el CSS. Así el
 *  mismo archivo sirve en tinta oscura sobre crema y en crema sobre marrón. */
function logo(dataUri, anchoMm, color) {
    return `<span class="tinta" style="
      width:${anchoMm}mm; aspect-ratio:2337/354; background-color:${color};
      -webkit-mask-image:url('${dataUri}'); mask-image:url('${dataUri}');"></span>`;
}

function icono(dataUri, anchoMm, color) {
    return `<span class="tinta" style="
      width:${anchoMm}mm; aspect-ratio:1294/1198; background-color:${color};
      -webkit-mask-image:url('${dataUri}'); mask-image:url('${dataUri}');"></span>`;
}

function caraFrente(a) {
    return `<div class="cara frente">
      ${logo(a.imagotipo, a.g.L * 0.6, a.tinta)}
      <span class="filete"></span>
      <p class="tagline">${esc(TEXTOS.tagline)}</p>
    </div>`;
}

function caraDorso(a) {
    const { negocio } = a;
    // Acá va el imagotipo solo: ya trae el anteojo adentro, y ponerle al lado el
    // ícono suelto duplica la marca. Se vio en el primer preview.
    return `<div class="cara dorso">
      <div class="marca-chica">
        ${logo(a.imagotipo, a.g.L * 0.33, a.tinta)}
      </div>
      <div class="datos">
        <p class="rotulo">${esc(TEXTOS.dorsoTitulo)}</p>
        <p class="dato">${esc(negocio.direccion)}</p>
        <p class="dato">${esc(negocio.web)} · ${esc(negocio.instagram)}</p>
        <p class="dato">${esc(negocio.telefono)}</p>
      </div>
    </div>`;
}

function caraLateral(a) {
    return `<div class="cara lateral">
      ${icono(a.icono, a.g.A * 0.42, a.detalle)}
      <p class="pie-lateral">${esc(TEXTOS.lateral)}</p>
      <p class="handle">${esc(a.negocio.instagram)}</p>
    </div>`;
}

function caraTapa(a) {
    return `<div class="cara tapa">
      <p class="tapa-texto">${esc(TEXTOS.tapa)}</p>
      <span class="filete corto"></span>
      <p class="tapa-web">${esc(a.negocio.web)}</p>
    </div>`;
}

/** El fondo va limpio a propósito: menos tinta, y es la cara que se raya. */
function caraFondo() {
    return `<div class="cara fondo-caja"></div>`;
}

function estilos(a) {
    const { papel, tinta, detalle } = a;
    return `
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Geist',-apple-system,'Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;}
    .tinta{display:block;-webkit-mask-size:contain;mask-size:contain;
           -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
           -webkit-mask-position:center;mask-position:center;}

    .cara{width:100%;height:100%;overflow:hidden;background:${papel};color:${tinta};
          display:flex;flex-direction:column;}

    /* Frente: logo centrado, filete y una sola línea. */
    .frente{align-items:center;justify-content:center;gap:7mm;}
    .filete{display:block;width:34mm;height:0.5mm;background:${detalle};}
    .filete.corto{width:22mm;}
    .tagline{font-size:3.4mm;letter-spacing:0.42em;font-weight:500;text-indent:0.42em;opacity:.85;}

    /* Dorso: marca chica arriba, datos abajo. */
    .dorso{justify-content:space-between;padding:11mm 14mm;}
    .marca-chica{display:flex;align-items:center;gap:6mm;}
    .datos{display:flex;flex-direction:column;gap:2.4mm;}
    /* El rótulo y el handle van en tinta, NO en bronce: el bronce sobre crema da
       3,5:1 y estos cuerpos son de 3 mm. El bronce se queda en los filetes y en
       el ícono, que son grandes y decorativos. */
    .rotulo{font-size:3mm;letter-spacing:0.3em;text-transform:uppercase;font-weight:600;opacity:.7;}
    .dato{font-size:4.2mm;line-height:1.35;font-weight:400;}

    /* Laterales: el ícono manda. */
    .lateral{align-items:center;justify-content:center;gap:5mm;padding:8mm;text-align:center;}
    .pie-lateral{font-size:3.4mm;letter-spacing:0.06em;font-weight:500;}
    .handle{font-size:3mm;letter-spacing:0.24em;font-weight:600;opacity:.7;}

    /* Tapa: se lee al abrir. */
    .tapa{align-items:center;justify-content:center;gap:5mm;}
    .tapa-texto{font-size:4.4mm;letter-spacing:0.34em;font-weight:600;text-indent:0.34em;}
    .tapa-web{font-size:3.2mm;letter-spacing:0.2em;font-weight:500;opacity:.7;}

    .fondo-caja{background:${papel};}`;
}

/* ── Las tres salidas ──────────────────────────────────────────────────────── */

function htmlDesarrollo(a, { conTroquel }) {
    const { g } = a;
    const W = g.ancho + SANGRADO * 2;
    const Ht = g.alto + SANGRADO * 2;
    const m = SANGRADO;

    // El fondo es un color plano de borde a borde, así que el sangrado ya está
    // resuelto: la cuchilla siempre cae sobre tinta.
    const panel = (html, left, top, w, h, girado = false) =>
        `<div class="panel" style="left:${m + left}mm;top:${m + top}mm;width:${w}mm;height:${h}mm${girado ? ';transform:rotate(180deg)' : ''}">${html}</div>`;

    const { x, y } = g;
    const cuerpo = [
        panel(caraFrente(a), x.p1, y.bodyT, g.L, g.H),
        panel(caraLateral(a), x.p2, y.bodyT, g.A, g.H),
        panel(caraDorso(a), x.p3, y.bodyT, g.L, g.H),
        panel(caraLateral(a), x.p4, y.bodyT, g.A, g.H),
        // La tapa va IMPRESA AL REVÉS, y no es un error: cuelga del dorso, así
        // que al plegarla su borde de arriba queda adelante. Impresa "derecha"
        // se leería de cabeza para quien mira la caja de frente. Se descubrió
        // mirando el mockup.
        panel(caraTapa(a), x.p3, y.unaTop, g.L, g.cierre, true),
        panel(caraFondo(), x.p1, y.bodyB, g.L, g.cierre),
    ].join('');

    const troquel = conTroquel ? `
      <svg class="troquel" width="${W}mm" height="${Ht}mm" viewBox="0 0 ${W} ${Ht}">
        <g transform="translate(${m},${m})">
          <path d="${contorno(g)}" fill="none" stroke="#e6007e" stroke-width="0.25"/>
          <path d="${hendidos(g)}" fill="none" stroke="#00a0e3" stroke-width="0.25" stroke-dasharray="4 2.5"/>
        </g>
      </svg>` : '';

    return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="${a.googleFonts}" rel="stylesheet">
    <style>
      ${estilos(a)}
      @page{size:${W}mm ${Ht}mm;margin:0;}
      body{width:${W}mm;height:${Ht}mm;position:relative;background:${a.papel};}
      .panel{position:absolute;overflow:hidden;}
      .troquel{position:absolute;left:0;top:0;pointer-events:none;}
    </style></head>
    <body>${cuerpo}${troquel}</body></html>`;
}

/** Ficha técnica: lo que la imprenta necesita saber y nadie se acuerda de decir. */
function htmlTroquel(a) {
    const { g } = a;
    const W = g.ancho + SANGRADO * 2;
    const alturaFicha = 52;
    const Ht = g.alto + SANGRADO * 2 + alturaFicha;
    const cm = (mm) => (mm / 10).toFixed(mm % 10 ? 1 : 0);

    const ficha = [
        ['Medida armada', `${cm(g.L)} × ${cm(g.A)} × ${cm(g.H)} cm (largo × ancho × alto)`],
        ['Desarrollo', `${g.ancho} × ${g.alto} mm + 3 mm de sangrado por lado`],
        ['Troquel', 'Plegadiza de solapas cruzadas (tuck end invertido), pestaña de pegado de 18 mm'],
        ['Material sugerido', 'Cartulina 300–350 g/m². Si la caja va con estuche rígido, 350 g'],
        ['Impresión', 'Frente del pliego. Interior sin imprimir'],
        ['Terminación', 'Laminado mate + relieve en seco en el logo del frente (opcional)'],
        ['Líneas', 'Magenta = corte · Celeste punteado = hendido. Las líneas NO se imprimen'],
    ].map(([k, v], i) => `
      <div class="fila" style="top:${8 + i * 6}mm">
        <span class="k">${esc(k)}</span><span class="v">${esc(v)}</span>
      </div>`).join('');

    return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <link href="${a.googleFonts}" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      @page{size:${W}mm ${Ht}mm;margin:0;}
      body{width:${W}mm;height:${Ht}mm;position:relative;background:#fff;color:#111;
           font-family:'Geist',-apple-system,sans-serif;}
      .ficha{position:absolute;left:${SANGRADO}mm;top:${g.alto + SANGRADO * 2}mm;
             width:${g.ancho}mm;height:${alturaFicha}mm;}
      .titulo{font-size:4.5mm;font-weight:700;letter-spacing:-0.01em;}
      .fila{position:absolute;left:0;font-size:3.4mm;display:flex;gap:4mm;}
      .k{width:44mm;font-weight:600;color:#666;}
      .sangrado{fill:none;stroke:#12b886;stroke-width:0.25;stroke-dasharray:2 2;}
    </style></head><body>
      <svg width="${W}mm" height="${g.alto + SANGRADO * 2}mm" viewBox="0 0 ${W} ${g.alto + SANGRADO * 2}">
        <g transform="translate(${SANGRADO},${SANGRADO})">
          <path d="${contorno(g)}" fill="none" stroke="#e6007e" stroke-width="0.25"/>
          <path d="${hendidos(g)}" fill="none" stroke="#00a0e3" stroke-width="0.25" stroke-dasharray="4 2.5"/>
        </g>
      </svg>
      <div class="ficha">
        <p class="titulo">Caja Atelier Óptica · ${cm(g.L)} × ${cm(g.A)} × ${cm(g.H)} cm</p>
        ${ficha}
      </div>
    </body></html>`;
}

/** Mockup: la caja armada, para aprobar el diseño sin imaginárselo. */
function htmlMockup(a) {
    const { g } = a;
    const W = 300, H = 230;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <link href="${a.googleFonts}" rel="stylesheet">
    <style>
      ${estilos(a)}
      body{width:${W}mm;height:${H}mm;background:#eeeae5;display:grid;place-items:center;}
      .escena{perspective:900mm;}
      .caja{position:relative;width:${g.L}mm;height:${g.H}mm;
            transform-style:preserve-3d;transform:rotateX(-16deg) rotateY(-30deg);}
      .f{position:absolute;overflow:hidden;box-shadow:0 0 0 0.2mm rgba(0,0,0,.06);}
      .f-frente{width:${g.L}mm;height:${g.H}mm;transform:translateZ(${g.A / 2}mm);}
      .f-lat{width:${g.A}mm;height:${g.H}mm;left:${g.L / 2 - g.A / 2}mm;
             transform:rotateY(90deg) translateZ(${g.L / 2}mm);filter:brightness(.93);}
      /* Sin giro extra a propósito: al plegar sobre X, la cara de arriba ya queda
         invertida respecto del pliego, que es exactamente el giro con el que se
         imprime la tapa. Agregarle un rotate(180deg) acá la mostraba de cabeza. */
      .f-tapa{width:${g.L}mm;height:${g.A}mm;top:${g.H / 2 - g.A / 2}mm;
              transform:rotateX(90deg) translateZ(${g.H / 2}mm);filter:brightness(1.03);}
      .sombra{position:absolute;left:50%;top:78%;width:${g.L * 1.15}mm;height:${g.A * 0.5}mm;
              transform:translate(-50%,0) rotateX(78deg);background:rgba(60,45,35,.28);
              filter:blur(9mm);border-radius:50%;}
    </style></head><body>
      <div class="escena">
        <div class="caja">
          <div class="sombra"></div>
          <div class="f f-frente">${caraFrente(a)}</div>
          <div class="f f-lat">${caraLateral(a)}</div>
          <div class="f f-tapa">${caraTapa(a)}</div>
        </div>
      </div>
    </body></html>`;
}

/* ── Corrida ─────────────────────────────────────────────────────────────── */

async function comoDataUri(ruta) {
    const bytes = await readFile(ruta);
    return `data:image/png;base64,${bytes.toString('base64')}`;
}

function leerArgs(argv) {
    const out = { tema: 'claro', ...MEDIDAS_POR_DEFECTO };
    for (let i = 0; i < argv.length; i++) {
        const [clave, pegado] = argv[i].replace(/^--/, '').split('=');
        const valor = pegado ?? argv[i + 1];
        if (!argv[i].startsWith('--')) continue;
        if (clave === 'tema') out.tema = valor;
        else if (['largo', 'ancho', 'alto'].includes(clave)) out[clave] = Number(valor);
    }
    if (!['claro', 'oscuro'].includes(out.tema)) throw new Error('--tema debe ser "claro" u "oscuro"');
    for (const k of ['largo', 'ancho', 'alto']) {
        if (!Number.isFinite(out[k]) || out[k] < 40) throw new Error(`--${k} inválido (mm, mínimo 40)`);
    }
    return out;
}

async function main() {
    const opciones = leerArgs(process.argv.slice(2));
    const id = await cargarIdentidad();
    const negocio = await datosDelNegocio();
    const g = geometria(opciones);

    const oscuro = opciones.tema === 'oscuro';
    const a = {
        g, negocio,
        googleFonts: id.googleFonts,
        // El bronce claro sobre fondo oscuro; el de marca sobre crema. Los dos
        // salen de globals.css, ninguno está escrito acá.
        papel: oscuro ? id.oscuro : id.colores.fondo,
        tinta: oscuro ? id.colores.fondo : id.colores.texto,
        detalle: oscuro ? id.colores.marcaClara : id.colores.marca,
        imagotipo: await comoDataUri(path.join(RAIZ, 'public', 'assets', 'ATELIEROptica Imagotipo ALT full color PNG.png')),
        icono: await comoDataUri(path.join(RAIZ, 'public', 'assets', 'ATELIEROptica Icono full color PNG.png')),
    };

    await mkdir(SALIDA, { recursive: true });
    const base = `caja-${g.L}x${g.A}x${g.H}-${opciones.tema}`;
    const salida = (sufijo) => path.join(SALIDA, `${base}-${sufijo}`);

    const navegador = await chromium.launch();
    const pagina = await navegador.newPage();

    const cargar = async (html) => {
        await pagina.setContent(html, { waitUntil: 'load' });
        await pagina.evaluate(() => document.fonts.ready).catch(() => { });
    };

    // 1. Arte para imprimir: sin las líneas del troquel encima.
    await cargar(htmlDesarrollo(a, { conTroquel: false }));
    await pagina.pdf({ path: salida('arte.pdf'), width: `${g.ancho + SANGRADO * 2}mm`, height: `${g.alto + SANGRADO * 2}mm`, printBackground: true });

    // 2. Preview: el mismo arte CON el troquel, para leerlo de un vistazo.
    await cargar(htmlDesarrollo(a, { conTroquel: true }));
    await pagina.setViewportSize({ width: Math.round((g.ancho + 6) * 3.78), height: Math.round((g.alto + 6) * 3.78) });
    await pagina.screenshot({ path: salida('preview.png'), fullPage: true });

    // 3. Troquel solo, con la ficha técnica.
    await cargar(htmlTroquel(a));
    await pagina.pdf({ path: salida('troquel.pdf'), width: `${g.ancho + SANGRADO * 2}mm`, height: `${g.alto + SANGRADO * 2 + 52}mm`, printBackground: true });

    // 4. Mockup de la caja armada. Va en su propia página con el doble de
    //    densidad: el texto de la tapa queda casi de canto y a 1x no se lee si
    //    está bien orientado o no, que es justo lo que hay que aprobar.
    const paginaMockup = await navegador.newPage({ viewport: { width: 1134, height: 869 }, deviceScaleFactor: 2 });
    await paginaMockup.setContent(htmlMockup(a), { waitUntil: 'load' });
    await paginaMockup.evaluate(() => document.fonts.ready).catch(() => { });
    await paginaMockup.screenshot({ path: salida('mockup.png') });

    await navegador.close();

    console.log(`\nCaja ${g.L} × ${g.A} × ${g.H} mm · tema ${opciones.tema}`);
    console.log(`Desarrollo: ${g.ancho} × ${g.alto} mm (+3 mm de sangrado)\n`);
    for (const s of ['arte.pdf', 'troquel.pdf', 'preview.png', 'mockup.png']) {
        console.log(`  ${path.relative(RAIZ, salida(s))}`);
    }
    console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); });
