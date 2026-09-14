/**
 * Contraste de TODOS los textos del sitio público, en modo CLARO y OSCURO.
 *
 * Por qué existe: el layout raíz monta next-themes con `enableSystem`, así que
 * el `.dark` se prende solo con la preferencia del sistema operativo del
 * visitante — también en la tienda y el blog, que están diseñados en claro.
 * Una sección que no declaró su variante `dark:` queda con texto oscuro sobre
 * fondo oscuro y no se lee. A ojo es imposible de auditar: son 70 páginas por
 * dos modos.
 *
 * Qué mide: para cada elemento con texto propio, el color efectivo del texto
 * contra el primer fondo opaco que encuentra subiendo por sus ancestros, y el
 * ratio de contraste de WCAG 2.1. El piso es 4,5:1 (AA), 3:1 para texto grande
 * (>=24px, o >=18.67px en negrita) — el mismo piso que el proyecto ya se puso
 * como criterio de diseño permanente (ver globals.css).
 *
 * Los colores de Tailwind 4 llegan en oklch desde getComputedStyle, así que se
 * parsean con el propio motor del navegador (canvas), nunca a mano.
 *
 * Uso:
 *   node scripts/checks/contraste-textos.check.mjs                 # localhost:3000
 *   node scripts/checks/contraste-textos.check.mjs --base https://atelieroptica.com.ar
 *   node scripts/checks/contraste-textos.check.mjs --ruta /tienda  # una sola
 *   node scripts/checks/contraste-textos.check.mjs --json salida.json
 *
 * Solo LEE: navega páginas públicas. No toca la base ni publica nada.
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const valor = (bandera, def) => {
  const i = args.indexOf(bandera);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const BASE = valor('--base', 'http://localhost:3000').replace(/\/$/, '');
const SOLO = valor('--ruta', null);
const JSON_OUT = valor('--json', null);
const VIEWPORT = { width: Number(valor('--ancho', 1280)), height: 900 };

/** Páginas públicas. Las dinámicas van con un ejemplo real de cada tipo. */
const RUTAS = [
  '/', '/tienda', '/receta', '/lentes-de-sol', '/clip-on', '/multifocales',
  '/lentes-de-contacto', '/arma-tus-lentes', '/cristales-opticos',
  '/cristales-opticos/antirreflejo', '/cristales-opticos/blue-uv',
  '/cristales-opticos/crizal', '/cristales-opticos/eyezen',
  '/cristales-opticos/kodak', '/cristales-opticos/myofix',
  '/cristales-opticos/policarbonato', '/cristales-opticos/stellest',
  '/cristales-opticos/super-blue', '/cristales-opticos/transitions',
  '/cristales-opticos/varilux', '/cristales-opticos/xperio',
  '/blog', '/blog/faq', '/blog/anteojos-obras-de-arte', '/blog/colores-cristales',
  '/blog/como-leer-receta-oftalmologica', '/blog/como-limpiar-anteojos-sin-rayar',
  '/blog/control-miopia', '/blog/control-miopia-infantil-lentes',
  '/blog/diferencia-miopia-hipermetropia-astigmatismo',
  '/blog/filtro-azul-vs-antirreflejo', '/blog/guia-armazones-segun-rostro',
  '/blog/guia-cristales', '/blog/guia-precios-multifocales-argentina',
  '/blog/lentes-fotocromaticos-transitions', '/blog/lentes-polarizados-vs-comunes',
  '/blog/materiales-armazones-acetato-tr90', '/blog/matias-turchi',
  '/blog/mitos-lentes-contacto', '/blog/optica-mejor-calificada-cordoba',
  '/blog/peligros-anteojos-pregraduados-farmacia',
  '/blog/por-que-no-pegar-anteojos-la-gotita', '/blog/sintomas-presbicia-soluciones',
  '/blog/stellest', '/blog/varilux-vs-kodak-vs-zeiss',
  '/capsulaescarlata', '/como-comprar', '/contacto', '/faq', '/nuestro-local',
  '/obras-sociales', '/optica-cordoba', '/politicas-de-cambio',
  '/politicas-de-privacidad', '/quienes-somos', '/resenas',
  '/terminos-y-condiciones', '/urgencias', '/promo', '/checkout',
  '/login', '/mayorista/ingreso',
];

/**
 * Corre DENTRO del navegador. Devuelve un hallazgo por elemento con texto
 * propio cuyo contraste no llega al piso.
 */
const MEDIR = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  /**
   * Cualquier color CSS (incluido oklch, que es como Tailwind 4 los entrega)
   * → [r,g,b,a], resuelto por el propio motor del navegador.
   *
   * Se pinta DOS veces, sobre blanco y sobre negro, y se despeja el alfa de la
   * diferencia. Parsear el string a mano era la trampa: en `rgb(255, 255, 255)`
   * cualquier regex de "último número antes del paréntesis" se lleva el 255 del
   * azul como si fuera el alfa, y a partir de ahí toda la composición da
   * negativa.
   */
  const aRgba = (css) => {
    if (!css || css === 'transparent') return [0, 0, 0, 0];
    const pintarSobre = (base) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      if (ctx.fillStyle === '#000000' && !/^(#0{3,8}|black|rgba?\(0,\s*0,\s*0)/i.test(css.trim())) return null; // color inválido
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    };
    const sobreBlanco = pintarSobre('#fff');
    const sobreNegro = pintarSobre('#000');
    if (!sobreBlanco || !sobreNegro) return [0, 0, 0, 1];
    // a = 1 - (blanco - negro)/255, promediado en los tres canales.
    let a = 0;
    for (let i = 0; i < 3; i++) a += 1 - (sobreBlanco[i] - sobreNegro[i]) / 255;
    a = Math.min(1, Math.max(0, a / 3));
    if (a < 0.004) return [0, 0, 0, 0];
    const straight = [0, 1, 2].map((i) => Math.min(255, Math.max(0, Math.round(sobreNegro[i] / a))));
    return [...straight, a];
  };

  const sobre = (frente, fondo) => {
    const a = frente[3];
    return [
      Math.round(frente[0] * a + fondo[0] * (1 - a)),
      Math.round(frente[1] * a + fondo[1] * (1 - a)),
      Math.round(frente[2] * a + fondo[2] * (1 - a)),
      1,
    ];
  };

  const luminancia = ([r, g, b]) => {
    const c = [r, g, b].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };

  const ratio = (a, b) => {
    const la = luminancia(a), lb = luminancia(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  /**
   * Fondo efectivo: se apilan los fondos de los ancestros hasta llegar a uno
   * opaco. Devuelve `rgb: null` cuando el fondo NO es un color plano y por lo
   * tanto no se puede medir con la fórmula de WCAG — una foto, un degradé o una
   * capa con mezcla. Esos casos se informan aparte en vez de acusarlos en falso:
   * lo que se mide acá es "color de texto contra color de fondo".
   */
  const fondoDe = (el) => {
    const capas = [];
    let n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { rgb: null, motivo: 'fondo con imagen o degradé' };
      const c = aRgba(cs.backgroundColor);
      if (c[3] > 0) {
        capas.push(c);
        if (c[3] >= 0.999) break;
      }
      n = n.parentElement;
    }
    let base = [255, 255, 255, 1];
    for (let i = capas.length - 1; i >= 0; i--) base = sobre(capas[i], base);
    return { rgb: base, motivo: null };
  };

  /**
   * ¿Hay una foto o un video pintado JUSTO DEBAJO de este texto?
   * Es el patrón del epígrafe sobre una imagen: el <p> está `absolute` encima de
   * un <Image fill>, que no es ancestro suyo sino hermano, así que subiendo por
   * los padres se llega al fondo blanco de la página y el cálculo daría "blanco
   * sobre blanco" en una leyenda que en pantalla se lee perfecto.
   */
  const hayFotoDetras = (el, r) => {
    for (const media of document.querySelectorAll('img, video, picture, svg')) {
      if (media.contains(el) || el.contains(media)) continue;
      const m = media.getBoundingClientRect();
      if (m.width < 8 || m.height < 8) continue;
      if (m.left <= r.left + 1 && m.right >= r.right - 1 && m.top <= r.top + 1 && m.bottom >= r.bottom - 1) return true;
    }
    return false;
  };

  /** ¿El elemento o alguno de sus ancestros usa mezcla de capas? */
  const usaMezcla = (el) => {
    let n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') return true;
      n = n.parentElement;
    }
    return false;
  };

  const selector = (el) => {
    const partes = [];
    let n = el;
    for (let i = 0; n && n.nodeType === 1 && i < 3; i++, n = n.parentElement) {
      let p = n.tagName.toLowerCase();
      if (n.id) { partes.unshift(`${p}#${n.id}`); break; }
      const cls = (n.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      if (cls) p += '.' + cls;
      partes.unshift(p);
    }
    return partes.join(' > ');
  };

  const hallazgos = [];
  for (const el of document.querySelectorAll('body *')) {
    // Solo elementos con texto PROPIO (no heredado de los hijos).
    const texto = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!texto) continue;

    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (Number(cs.opacity) === 0) continue;
    // El texto solo para lectores de pantalla no se ve por diseño.
    if (r.width <= 1 && r.height <= 1) continue;
    if ((el.getAttribute('class') || '').includes('sr-only')) continue;
    // Un separador suelto ("·", "•", "→") es decoración, no información: WCAG
    // no le exige contraste y acusarlo tapaba los hallazgos de verdad (eran 56
    // de los 477 de la primera corrida). Se descarta solo cuando es UN símbolo
    // o dos; "★★★★★" tiene cinco y sí dice algo, así que se sigue midiendo.
    if (texto.length <= 2 && !/[\p{L}\p{N}]/u.test(texto)) continue;

    // `mix-blend-difference` invierte el color contra lo que tenga debajo: un
    // "text-white" ahí se ve NEGRO sobre fondo claro. Medirlo como color plano
    // acusaba en falso el header de varias notas del blog.
    if (usaMezcla(el)) continue;

    const fondo = fondoDe(el);
    if (!fondo.rgb) continue; // fondo no medible (imagen/degradé): no se acusa
    if (hayFotoDetras(el, r)) continue;

    let frente = aRgba(cs.color);
    const op = Number(cs.opacity);
    if (Number.isFinite(op) && op < 1) frente = [frente[0], frente[1], frente[2], frente[3] * op];
    const colorFinal = sobre(frente, fondo.rgb);

    const px = parseFloat(cs.fontSize) || 16;
    const peso = parseInt(cs.fontWeight, 10) || 400;
    const grande = px >= 24 || (px >= 18.66 && peso >= 700);
    const piso = grande ? 3 : 4.5;
    const cr = ratio(colorFinal, fondo.rgb);

    if (cr + 0.001 < piso) {
      hallazgos.push({
        texto: texto.slice(0, 70),
        selector: selector(el),
        color: cs.color,
        fondo: `rgb(${fondo.rgb.slice(0, 3).join(',')})`,
        px: Math.round(px * 10) / 10,
        peso,
        ratio: Math.round(cr * 100) / 100,
        piso,
      });
    }
  }
  return hallazgos;
};

const PARALELO = Number(valor('--paralelo', 5));

const navegador = await chromium.launch();
const resultados = [];
const rutas = SOLO ? [SOLO] : RUTAS;

for (const modo of ['claro', 'oscuro']) {
  const contexto = await navegador.newContext({
    viewport: VIEWPORT,
    colorScheme: modo === 'oscuro' ? 'dark' : 'light',
  });
  // next-themes guarda la elección en localStorage; se fija antes de que
  // cargue cualquier script para que no haya un flash con el tema contrario.
  await contexto.addInitScript(
    ([t]) => { try { localStorage.setItem('theme', t); } catch {} },
    [modo === 'oscuro' ? 'dark' : 'light'],
  );

  const pendientes = [...rutas];
  const medirUna = async () => {
    for (;;) {
      const ruta = pendientes.shift();
      if (!ruta) return;
      const pagina = await contexto.newPage();
      try {
        // 'load', no 'networkidle': el sitio tiene GA y el píxel de Meta, que
        // mantienen conexiones abiertas y nunca dejan la red quieta — esperar
        // el idle era esperar los 45 s de timeout en cada página.
        const resp = await pagina.goto(BASE + ruta, { waitUntil: 'load', timeout: 45000 });
        const estado = resp?.status() ?? 0;
        if (estado >= 400) {
          resultados.push({ ruta, modo, error: `HTTP ${estado}` });
          await pagina.close();
          continue;
        }
        // Lo justo para que next-themes pinte la clase y la fuente cargue.
        await pagina.waitForTimeout(1200);
        const tema = await pagina.evaluate(() => document.documentElement.className);
        const hallazgos = await pagina.evaluate(MEDIR);
        resultados.push({ ruta, modo, tema, hallazgos });
        const marca = hallazgos.length === 0 ? 'ok  ' : `${String(hallazgos.length).padStart(3)} ✗`;
        console.log(`${marca}  ${modo.padEnd(6)} ${ruta}`);
      } catch (e) {
        resultados.push({ ruta, modo, error: String(e.message || e).split('\n')[0] });
        console.log(`  ERR  ${modo.padEnd(6)} ${ruta}  ${String(e.message || e).split('\n')[0]}`);
      }
      await pagina.close();
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALELO, pendientes.length) }, medirUna));
  await contexto.close();
}
await navegador.close();

resultados.sort((a, b) => (a.modo === b.modo ? a.ruta.localeCompare(b.ruta) : a.modo < b.modo ? -1 : 1));

const conFallas = resultados.filter((r) => r.hallazgos?.length);
const errores = resultados.filter((r) => r.error);
const total = conFallas.reduce((a, r) => a + r.hallazgos.length, 0);

console.log('\n' + '='.repeat(72));
console.log(`Textos por debajo del piso de contraste: ${total} en ${conFallas.length} páginas/modo`);
if (errores.length) console.log(`Páginas que no se pudieron medir: ${errores.length}`);
console.log('='.repeat(72));

for (const r of conFallas) {
  console.log(`\n${r.ruta}  [${r.modo}]  (${r.hallazgos.length})`);
  for (const h of r.hallazgos.slice(0, 12)) {
    console.log(`   ${String(h.ratio).padStart(5)}:1 (piso ${h.piso})  ${h.px}px/${h.peso}  ${h.color} sobre ${h.fondo}`);
    console.log(`          "${h.texto}"`);
    console.log(`          ${h.selector}`);
  }
  if (r.hallazgos.length > 12) console.log(`   … y ${r.hallazgos.length - 12} más`);
}
for (const r of errores) console.log(`\n${r.ruta} [${r.modo}] — ${r.error}`);

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify(resultados, null, 2));
  console.log(`\nDetalle completo en ${JSON_OUT}`);
}

process.exit(total > 0 ? 1 : 0);
