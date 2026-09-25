#!/usr/bin/env node
/**
 * Corre Lighthouse sobre TODAS las URLs del sitemap de producción, en celular y
 * escritorio (y opcionalmente tablet), y deja un resumen por URL con los cuatro
 * puntajes (performance, accesibilidad, buenas prácticas, SEO) y las auditorías
 * que fallan. Solo lee: no toca el sitio ni la base.
 *
 * Uso:
 *   node scripts/checks/lighthouse-todo-el-sitio.mjs                     → sitemap de producción, mobile + desktop
 *   node scripts/checks/lighthouse-todo-el-sitio.mjs --tablet             → agrega una emulación de tablet (768×1024)
 *   node scripts/checks/lighthouse-todo-el-sitio.mjs --solo=/tienda,/     → solo esas rutas
 *   node scripts/checks/lighthouse-todo-el-sitio.mjs --max=20             → las primeras N URLs
 *   node scripts/checks/lighthouse-todo-el-sitio.mjs --salida=/ruta/dir   → dónde dejar los JSON (default: ./logs/lighthouse/<fecha>)
 *
 * Las corridas son SECUENCIALES a propósito: Lighthouse en paralelo se roba CPU
 * a sí mismo y baja el puntaje de performance sin que el sitio tenga la culpa.
 * Requiere Chrome instalado (usa el de la Mac). Lighthouse se baja con npx.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const BASE = opt('base', 'https://atelieroptica.com.ar');
const TABLET = args.includes('--tablet');
const MAX = Number(opt('max', 0));
const SOLO = opt('solo', '').split(',').filter(Boolean);
const fecha = opt('fecha', 'corrida');
const OUT = opt('salida', path.join('logs', 'lighthouse', fecha));
mkdirSync(OUT, { recursive: true });

let urls;
if (SOLO.length) {
  urls = SOLO.map((r) => (r.startsWith('http') ? r : BASE + r));
} else {
  // curl -s devuelve 56 si la conexión se corta a mitad: reintentar antes de rendirse.
  let sitemap = '';
  for (let i = 0; i < 3 && !sitemap.includes('<loc>'); i++) {
    const r = spawnSync('curl', ['-sS', '--retry', '2', `${BASE}/sitemap.xml`], { encoding: 'utf8' });
    sitemap = r.stdout || '';
  }
  urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!urls.length) { console.error('No pude leer el sitemap'); process.exit(1); }
}
if (MAX) urls = urls.slice(0, MAX);
console.log(`${urls.length} URLs · salida en ${OUT}`);

const FORMAS = [
  { nombre: 'mobile', extra: [] },
  { nombre: 'desktop', extra: ['--preset=desktop'] },
  ...(TABLET ? [{ nombre: 'tablet', extra: ['--screenEmulation.mobile', '--screenEmulation.width=768', '--screenEmulation.height=1024', '--screenEmulation.deviceScaleFactor=2', '--throttling-method=simulate'] }] : []),
];
const resumenPath = path.join(OUT, 'resumen.csv');
if (!existsSync(resumenPath)) writeFileSync(resumenPath, 'url,forma,performance,accessibility,best-practices,seo,fallas\n');

for (const url of urls) {
  for (const f of FORMAS) {
    const slug = url.replace(BASE, '').replace(/^\/$/, 'home').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    const json = path.join(OUT, `${slug}__${f.nombre}.json`);
    if (existsSync(json)) continue; // reanudable
    const r = spawnSync('npx', ['--yes', 'lighthouse', url, '--output=json', `--output-path=${json}`, '--quiet',
      '--chrome-flags=--headless=new --no-sandbox', '--only-categories=performance,accessibility,best-practices,seo', ...f.extra],
      { stdio: ['ignore', 'ignore', 'pipe'], timeout: 180000 });
    if (r.status !== 0 || !existsSync(json)) { writeFileSync(resumenPath, `${url},${f.nombre},ERR,ERR,ERR,ERR,"${(r.stderr || '').toString().slice(0, 120).replace(/[\n",]/g, ' ')}"\n`, { flag: 'a' }); console.log(`✖ ${f.nombre} ${url}`); continue; }
    const lr = JSON.parse(readFileSync(json, 'utf8'));
    const c = lr.categories; const p = (k) => Math.round((c[k]?.score ?? 0) * 100);
    const fallas = Object.values(lr.audits).filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable').map((a) => a.id).join(' ');
    writeFileSync(resumenPath, `${url},${f.nombre},${p('performance')},${p('accessibility')},${p('best-practices')},${p('seo')},"${fallas}"\n`, { flag: 'a' });
    console.log(`${f.nombre.padEnd(7)} ${String(p('performance')).padStart(3)} ${String(p('accessibility')).padStart(3)} ${String(p('best-practices')).padStart(3)} ${String(p('seo')).padStart(3)}  ${url}`);
  }
}
console.log(`\nResumen: ${resumenPath}`);
