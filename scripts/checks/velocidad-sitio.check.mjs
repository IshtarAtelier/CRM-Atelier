/**
 * Velocidad REAL de cada área del sitio, en las condiciones en las que compra
 * la gente: celular de gama media con 4G lento.
 *
 * Por qué existe: PageSpeed Insights mide de a una página y tiene cupo, así que
 * nadie mira las 20. Y un promedio no sirve — lo que importa es CUÁL área está
 * lenta y POR QUÉ. Este chequeo mide todas de una y, para cada una, además de
 * la nota parte el LCP en sus cuatro tramos (servidor / espera / descarga /
 * pintado), que es lo único que dice dónde tocar.
 *
 * Qué mide, con los mismos umbrales que usa Google (Core Web Vitals):
 *   LCP  ≤ 2,5 s bien · ≤ 4 s regular · > 4 s mal
 *   CLS  ≤ 0,1  bien · ≤ 0,25 regular
 *   TBT  ≤ 200 ms bien · ≤ 600 ms regular  (el proxy de INP en laboratorio)
 *   TTFB ≤ 800 ms bien
 *
 * Cómo emula el celular: 4x de freno de CPU y red "4G lento" (1,6 Mbps de
 * bajada, 150 ms de latencia), que es la receta de Lighthouse en móvil. Sin
 * frenar, una Mac con fibra da números que no le pasan a ningún cliente.
 *
 * Uso:
 *   node scripts/checks/velocidad-sitio.check.mjs                      # producción
 *   node scripts/checks/velocidad-sitio.check.mjs --base http://localhost:3000
 *   node scripts/checks/velocidad-sitio.check.mjs --escritorio         # sin frenos
 *   node scripts/checks/velocidad-sitio.check.mjs --ruta /tienda
 *   node scripts/checks/velocidad-sitio.check.mjs --json salida.json
 *
 * Solo LEE: navega páginas públicas. No toca la base ni publica nada.
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const valor = (b, d) => { const i = args.indexOf(b); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const tiene = (b) => args.includes(b);

const BASE = valor('--base', 'https://atelieroptica.com.ar').replace(/\/$/, '');
const SOLO = valor('--ruta', null);
const JSON_OUT = valor('--json', null);
const MOVIL = !tiene('--escritorio');
// Tres vueltas por defecto y se queda la MEDIANA. Con una sola, el 14/9 la
// tienda marcó 1,8 s y quedó como la única área en verde; repetida, da entre
// 2,1 y 3,5 s. Una muestra sola no mide una página, mide una casualidad.
const VUELTAS = Number(valor('--vueltas', 3));

/** Las áreas del sitio, con el nombre que usa Ishtar para cada una. */
const AREAS = [
  { area: 'Home', ruta: '/' },
  { area: 'Tienda (grilla)', ruta: '/tienda' },
  { area: 'Tienda filtrada', ruta: '/tienda?categoria=receta' },
  { area: 'Ficha de producto', ruta: '/producto/gala-c1' },
  { area: 'Armazones de receta', ruta: '/receta' },
  { area: 'Lentes de sol', ruta: '/lentes-de-sol' },
  { area: 'Clip-on', ruta: '/clip-on' },
  { area: 'Multifocales (landing)', ruta: '/multifocales' },
  { area: 'Armá tus lentes', ruta: '/arma-tus-lentes' },
  { area: 'Cristales', ruta: '/cristales-opticos' },
  { area: 'Checkout', ruta: '/checkout' },
  { area: 'Blog (índice)', ruta: '/blog' },
  { area: 'Blog (nota)', ruta: '/blog/guia-precios-multifocales-argentina' },
  { area: 'Reseñas', ruta: '/resenas' },
  { area: 'Nuestro local', ruta: '/nuestro-local' },
  { area: 'Contacto', ruta: '/contacto' },
  { area: 'Preguntas frecuentes', ruta: '/faq' },
  { area: 'Quiénes somos', ruta: '/quienes-somos' },
  { area: 'Mayorista (ingreso)', ruta: '/mayorista/ingreso' },
];

/** Se instala ANTES de cualquier script de la página para no perderse el LCP. */
const SONDA = () => {
  window.__m = { lcp: 0, lcpUrl: null, lcpTag: null, cls: 0, tareasLargas: 0, bloqueo: 0 };
  try {
    new PerformanceObserver((l) => {
      const e = l.getEntries().at(-1);
      if (!e) return;
      window.__m.lcp = e.startTime;
      window.__m.lcpUrl = e.url || null;
      window.__m.lcpTag = e.element ? e.element.tagName + (e.element.className ? '.' + String(e.element.className).split(/\s+/)[0] : '') : null;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__m.tareasLargas++;
        // TBT = lo que cada tarea larga pasa de 50 ms.
        window.__m.bloqueo += Math.max(0, e.duration - 50);
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
};

const COSECHAR = () => {
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  const recursos = performance.getEntriesByType('resource');

  const porTipo = {};
  let pesoTotal = 0;
  for (const r of recursos) {
    const bytes = r.transferSize || r.encodedBodySize || 0;
    pesoTotal += bytes;
    // Se clasifica por EXTENSIÓN primero y por `initiatorType` solo después.
    // Al revés, `initiatorType === 'link'` se llevaba a "css" todo lo que entra
    // por un <link>: los preload de fuentes y de imágenes incluidos. Así
    // /quienes-somos aparecía con 220 KB de CSS cuando en realidad carga 53 KB,
    // como todas — el resto eran una tipografía y la foto del hero precargada.
    let t;
    if (/\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/i.test(r.name) || /\/_next\/image\?/.test(r.name)) t = 'imagen';
    else if (/\.(woff2?|ttf|otf)(\?|$)/i.test(r.name)) t = 'tipografia';
    else if (/\.m?js(\?|$)/i.test(r.name)) t = 'javascript';
    else if (/\.css(\?|$)/i.test(r.name)) t = 'css';
    else if (r.initiatorType === 'img') t = 'imagen';
    else if (r.initiatorType === 'script') t = 'javascript';
    else t = r.initiatorType || 'otros';
    porTipo[t] = porTipo[t] || { bytes: 0, pedidos: 0 };
    porTipo[t].bytes += bytes;
    porTipo[t].pedidos++;
  }

  // Terceros: todo lo que no sale del propio dominio.
  const propio = location.hostname;
  const terceros = {};
  for (const r of recursos) {
    let h; try { h = new URL(r.name).hostname; } catch { continue; }
    if (h === propio || h === 'localhost') continue;
    terceros[h] = terceros[h] || { bytes: 0, pedidos: 0 };
    terceros[h].bytes += r.transferSize || r.encodedBodySize || 0;
    terceros[h].pedidos++;
  }

  const m = window.__m || {};
  // Los cuatro tramos del LCP, que es lo que dice DÓNDE está el problema.
  const ttfb = nav.responseStart || 0;
  let recurso = null;
  if (m.lcpUrl) recurso = recursos.find((r) => r.name === m.lcpUrl) || null;

  return {
    ttfb: Math.round(ttfb),
    respuestaHtml: Math.round((nav.responseEnd || 0) - (nav.responseStart || 0)),
    domInteractivo: Math.round(nav.domInteractive || 0),
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
    cargaCompleta: Math.round(nav.loadEventEnd || 0),
    fcp: Math.round(fcp ? fcp.startTime : 0),
    lcp: Math.round(m.lcp || 0),
    lcpUrl: m.lcpUrl,
    lcpTag: m.lcpTag,
    lcpTramos: recurso ? {
      servidor: Math.round(ttfb),
      espera: Math.round(Math.max(0, recurso.startTime - ttfb)),
      descarga: Math.round(Math.max(0, recurso.responseEnd - recurso.startTime)),
      pintado: Math.round(Math.max(0, (m.lcp || 0) - recurso.responseEnd)),
      pesoKb: Math.round((recurso.transferSize || recurso.encodedBodySize || 0) / 1024),
    } : null,
    cls: Math.round((m.cls || 0) * 1000) / 1000,
    bloqueo: Math.round(m.bloqueo || 0),
    tareasLargas: m.tareasLargas || 0,
    pedidos: recursos.length,
    pesoKb: Math.round(pesoTotal / 1024),
    porTipo: Object.fromEntries(Object.entries(porTipo).map(([k, v]) => [k, { kb: Math.round(v.bytes / 1024), pedidos: v.pedidos }])),
    terceros: Object.fromEntries(
      Object.entries(terceros).sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 8)
        .map(([k, v]) => [k, { kb: Math.round(v.bytes / 1024), pedidos: v.pedidos }])
    ),
  };
};

const UMBRALES = {
  lcp: [2500, 4000],
  cls: [0.1, 0.25],
  bloqueo: [200, 600],
  ttfb: [800, 1800],
};
const nota = (clave, v) => {
  const [bien, regular] = UMBRALES[clave];
  return v <= bien ? 'bien' : v <= regular ? 'regular' : 'MAL';
};
const marca = (n) => (n === 'bien' ? '🟢' : n === 'regular' ? '🟡' : '🔴');

const navegador = await chromium.launch();
const objetivos = SOLO ? [{ area: SOLO, ruta: SOLO }] : AREAS;
const resultados = [];

for (const { area, ruta } of objetivos) {
  const vueltas = [];
  for (let i = 0; i < VUELTAS; i++) {
    const ctx = await navegador.newContext({
      viewport: MOVIL ? { width: 390, height: 844 } : { width: 1366, height: 900 },
      deviceScaleFactor: MOVIL ? 2 : 1,
      isMobile: MOVIL,
      hasTouch: MOVIL,
      userAgent: MOVIL
        ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
        : undefined,
    });
    await ctx.addInitScript(SONDA);
    const pagina = await ctx.newPage();
    const cdp = await ctx.newCDPSession(pagina);
    if (MOVIL) {
      // La receta de Lighthouse en móvil: 4x de freno de CPU y 4G lento.
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      });
    }
    try {
      const resp = await pagina.goto(BASE + ruta, { waitUntil: 'load', timeout: 90000 });
      const estado = resp?.status() ?? 0;
      if (estado >= 400) { vueltas.push({ error: `HTTP ${estado}` }); await ctx.close(); continue; }
      // Margen para que cierren el LCP y las tareas largas del arranque.
      await pagina.waitForTimeout(4000);
      vueltas.push(await pagina.evaluate(COSECHAR));
    } catch (e) {
      vueltas.push({ error: String(e.message || e).split('\n')[0] });
    }
    await ctx.close();
  }

  // Con varias vueltas se queda la MEDIANA del LCP (la peor y la mejor mienten).
  const buenas = vueltas.filter((v) => !v.error);
  const m = buenas.length
    ? buenas.slice().sort((a, b) => a.lcp - b.lcp)[Math.floor(buenas.length / 2)]
    : vueltas[0];
  resultados.push({ area, ruta, ...m });

  if (m.error) { console.log(`  ERR  ${area.padEnd(24)} ${m.error}`); continue; }
  console.log(
    `${marca(nota('lcp', m.lcp))} ${area.padEnd(24)} LCP ${String((m.lcp / 1000).toFixed(1) + 's').padStart(6)}` +
    `  TTFB ${String(m.ttfb + 'ms').padStart(7)}  bloqueo ${String(m.bloqueo + 'ms').padStart(7)}` +
    `  CLS ${String(m.cls).padStart(5)}  ${String(m.pesoKb + ' KB').padStart(8)}  ${m.pedidos} pedidos`
  );
}
await navegador.close();

const ok = resultados.filter((r) => !r.error);
const mal = ok.filter((r) => nota('lcp', r.lcp) === 'MAL');
const regu = ok.filter((r) => nota('lcp', r.lcp) === 'regular');

console.log('\n' + '='.repeat(78));
console.log(`${MOVIL ? 'CELULAR (4x CPU, 4G lento)' : 'ESCRITORIO (sin frenos)'} — ${BASE}`);
console.log(`${ok.length} áreas medidas · 🔴 ${mal.length} mal · 🟡 ${regu.length} regular · 🟢 ${ok.length - mal.length - regu.length} bien`);
console.log('='.repeat(78));

for (const r of [...mal, ...regu].sort((a, b) => b.lcp - a.lcp)) {
  console.log(`\n${marca(nota('lcp', r.lcp))} ${r.area}  (${r.ruta})`);
  console.log(`   LCP ${(r.lcp / 1000).toFixed(1)}s — lo que tarda en aparecer lo más grande de la pantalla`);
  if (r.lcpTag) console.log(`   es: ${r.lcpTag}${r.lcpUrl ? '  ' + r.lcpUrl.split('/').pop().slice(0, 60) : ''}`);
  if (r.lcpTramos) {
    const t = r.lcpTramos;
    const total = t.servidor + t.espera + t.descarga + t.pintado || 1;
    const pct = (v) => String(Math.round((v / total) * 100)).padStart(3) + '%';
    console.log(`   servidor ${String(t.servidor + 'ms').padStart(7)} ${pct(t.servidor)}   ` +
                `espera ${String(t.espera + 'ms').padStart(7)} ${pct(t.espera)}   ` +
                `descarga ${String(t.descarga + 'ms').padStart(7)} ${pct(t.descarga)} (${t.pesoKb} KB)   ` +
                `pintado ${String(t.pintado + 'ms').padStart(7)} ${pct(t.pintado)}`);
  }
  const tipos = Object.entries(r.porTipo || {}).sort((a, b) => b[1].kb - a[1].kb).slice(0, 4);
  console.log('   peso: ' + tipos.map(([k, v]) => `${k} ${v.kb} KB (${v.pedidos})`).join(' · '));
  const terc = Object.entries(r.terceros || {}).slice(0, 3);
  if (terc.length) console.log('   terceros: ' + terc.map(([k, v]) => `${k} ${v.kb} KB`).join(' · '));
  if (nota('bloqueo', r.bloqueo) !== 'bien') console.log(`   ⚠ bloqueo ${r.bloqueo}ms en ${r.tareasLargas} tareas largas — la pantalla no responde al toque mientras tanto`);
  if (nota('cls', r.cls) !== 'bien') console.log(`   ⚠ CLS ${r.cls} — el contenido se mueve solo mientras carga`);
}

console.log('\n── Las 5 más pesadas ──');
for (const r of [...ok].sort((a, b) => b.pesoKb - a.pesoKb).slice(0, 5)) {
  console.log(`   ${String(r.pesoKb + ' KB').padStart(9)}  ${r.pedidos} pedidos   ${r.area}`);
}

const errores = resultados.filter((r) => r.error);
if (errores.length) {
  console.log('\n── No se pudieron medir ──');
  for (const r of errores) console.log(`   ${r.area} (${r.ruta}) — ${r.error}`);
}

if (JSON_OUT) { writeFileSync(JSON_OUT, JSON.stringify(resultados, null, 2)); console.log(`\nDetalle en ${JSON_OUT}`); }
process.exit(mal.length ? 1 : 0);
