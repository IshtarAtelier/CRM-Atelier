#!/usr/bin/env node
// Censo SEO post-migración Tienda Nube → Next/Railway.
//
// 1) Junta TODAS las URLs históricas del dominio desde Wayback Machine (CDX)
//    + el último sitemap.xml de Tienda Nube archivado antes del cutover (7/7/2026).
// 2) Prueba cada path contra la web viva siguiendo los redirects a mano.
// 3) Clasifica: OK / REDIRECT / SOFT404 / NOT_FOUND / ERROR y escribe un reporte
//    en scratch/seo-audit-report.md con los redirects sugeridos para next.config.ts.
//
// Uso: node scripts/seo-audit.mjs [--base=https://atelieroptica.com.ar] [--limit=2000]
// Solo hace GETs (no escribe nada en ningún lado más que el reporte local).

import { writeFileSync, mkdirSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const BASE = (args.base || 'https://atelieroptica.com.ar').replace(/\/$/, '');
const LIMIT = Number(args.limit || 4000);
const CUTOVER_TS = '20260708'; // solo snapshots ANTERIORES al cutover del dominio

const ASSET_RE = /\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|mjs|json|xml|txt|woff2?|ttf|mp4|webm|pdf|zip)$/i;
const SKIP_RE = /^\/(checkout|account|admin|api|cart|carrito|login|password|_next|wp-)/i;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchText(url, timeoutMs = 25000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': 'AtelierSeoAudit/1.0 (+https://atelieroptica.com.ar)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.text();
}

// —— Fuente 1: Wayback CDX — todo lo que el archivo vio alguna vez del dominio ——
async function waybackPaths() {
  const api = `https://web.archive.org/cdx/search/cdx?url=atelieroptica.com.ar&matchType=domain&output=json&fl=original,mimetype,statuscode&collapse=urlkey&filter=statuscode:200&limit=${LIMIT}`;
  const rows = JSON.parse(await fetchText(api));
  const out = [];
  for (const [original, mimetype] of rows.slice(1)) {
    if (mimetype && !/text\/html/i.test(mimetype)) continue;
    try {
      const u = new URL(original);
      if (!/atelieroptica\.com\.ar$/i.test(u.hostname)) continue;
      const path = u.pathname.replace(/\/+$/, '') || '/';
      if (ASSET_RE.test(path) || SKIP_RE.test(path)) continue;
      const host = u.hostname.startsWith('promo.') ? 'promo' : u.hostname.startsWith('www.') ? 'www' : 'apex';
      out.push({ host, path });
    } catch { /* URL malformada del CDX: ignorar */ }
  }
  return out;
}

// —— Fuente 2: último sitemap de Tienda Nube archivado antes del cutover ——
async function oldSitemapPaths() {
  const api = `https://web.archive.org/cdx/search/cdx?url=atelieroptica.com.ar/sitemap.xml&output=json&fl=timestamp,statuscode&filter=statuscode:200&limit=300`;
  let rows;
  try { rows = JSON.parse(await fetchText(api)); } catch { return []; }
  const stamps = rows.slice(1).map(r => r[0]).filter(ts => ts < CUTOVER_TS).sort();
  const ts = stamps.at(-1);
  if (!ts) return [];

  const locRe = /<loc>\s*([^<\s]+)\s*<\/loc>/g;
  const readLocs = (xml) => [...xml.matchAll(locRe)].map(m => m[1]);

  const paths = [];
  const queue = [`https://web.archive.org/web/${ts}id_/https://atelieroptica.com.ar/sitemap.xml`];
  let hops = 0;
  while (queue.length && hops < 12) { // índice + hasta ~11 sub-sitemaps
    hops++;
    let xml;
    try { xml = await fetchText(queue.shift()); } catch { continue; }
    for (const loc of readLocs(xml)) {
      if (loc.endsWith('.xml')) { queue.push(`https://web.archive.org/web/${ts}id_/${loc}`); continue; }
      try {
        const u = new URL(loc);
        const path = u.pathname.replace(/\/+$/, '') || '/';
        if (!ASSET_RE.test(path) && !SKIP_RE.test(path)) paths.push({ host: 'apex', path });
      } catch { /* loc inválido */ }
    }
    await sleep(400); // no castigar a Wayback
  }
  return paths;
}

// —— Test en vivo: seguir redirects a mano y clasificar ——
async function classify(path) {
  let url = `${BASE}${path}`;
  let hops = 0;
  let res;
  try {
    while (hops <= 8) {
      res = await fetch(url, {
        redirect: 'manual', cache: 'no-store',
        signal: AbortSignal.timeout(12000),
        headers: { 'User-Agent': 'AtelierSeoAudit/1.0' },
      });
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) { url = new URL(loc, url).toString(); hops++; continue; }
      break;
    }
  } catch (e) {
    return { path, verdict: 'ERROR', detail: e?.message ?? String(e), hops };
  }
  const finalPath = new URL(url).pathname;
  if (res.status === 404 || res.status === 410) return { path, verdict: 'NOT_FOUND', detail: `HTTP ${res.status}`, hops, finalPath };
  if (res.status !== 200) return { path, verdict: 'ERROR', detail: `HTTP ${res.status}`, hops, finalPath };
  if (finalPath.startsWith('/producto/')) {
    const body = await res.text();
    if (body.includes('Producto no encontrado')) return { path, verdict: 'SOFT404', detail: '200 "Producto no encontrado"', hops, finalPath };
  }
  return { path, verdict: hops > 0 ? 'REDIRECT' : 'OK', hops, finalPath };
}

async function pool(items, worker, size = 8) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx]);
      if (idx % 25 === 0) process.stdout.write(`\r  probadas ${idx}/${items.length}...`);
    }
  }));
  process.stdout.write(`\r  probadas ${items.length}/${items.length}    \n`);
  return results;
}

// —— Main ——
console.log('1/3 Censando Wayback Machine (CDX + sitemap viejo de Tienda Nube)...');
const [cdx, smap] = await Promise.all([waybackPaths(), oldSitemapPaths()]);
const promo = [...new Set(cdx.filter(p => p.host === 'promo').map(p => p.path))].sort();
const seen = new Set();
const paths = [...cdx, ...smap]
  .filter(p => p.host !== 'promo')
  .map(p => p.path)
  .filter(p => (seen.has(p) ? false : (seen.add(p), true)))
  .sort();
console.log(`  ${paths.length} paths únicos históricos (apex/www) + ${promo.length} en promo.`);

console.log(`2/3 Probando cada path contra ${BASE} ...`);
const results = await pool(paths, classify);

console.log('3/3 Armando reporte...');
const buckets = { NOT_FOUND: [], SOFT404: [], ERROR: [], REDIRECT: [], OK: [] };
for (const r of results) buckets[r.verdict].push(r);

const fmt = (r) => `| \`${r.path}\` | ${r.detail ?? ''} | ${r.finalPath ?? ''} (${r.hops} saltos) |`;
const suggestions = [...buckets.NOT_FOUND, ...buckets.SOFT404]
  .map(r => `      { source: '${r.path}', destination: '/tienda', permanent: true }, // TODO: elegir mejor destino`)
  .join('\n');

const report = `# Censo SEO — ${new Date().toISOString().slice(0, 10)}
Base probada: ${BASE} · Fuentes: Wayback CDX + sitemap TN pre-cutover

## Resumen
- 🔴 ROTAS (404/410): **${buckets.NOT_FOUND.length}**
- 🟠 SOFT-404: **${buckets.SOFT404.length}**
- 🟡 Error/timeout: **${buckets.ERROR.length}**
- 🟢 Redirigen bien: **${buckets.REDIRECT.length}**
- ⚪ Directas 200: **${buckets.OK.length}**

## 🔴 Rotas — necesitan redirect en next.config.ts
| Path histórico | Detalle | Destino actual |
|---|---|---|
${buckets.NOT_FOUND.map(fmt).join('\n') || '| (ninguna) | | |'}

## 🟠 Soft-404
| Path histórico | Detalle | Destino actual |
|---|---|---|
${buckets.SOFT404.map(fmt).join('\n') || '| (ninguna) | | |'}

## 🟡 Errores de red / 5xx (re-probar)
${buckets.ERROR.map(r => `- \`${r.path}\` — ${r.detail}`).join('\n') || '- (ninguno)'}

## Sugerencia para next.config.ts (revisar destino uno a uno)
\`\`\`ts
${suggestions || '// nada que agregar 🎉'}
\`\`\`

## promo.atelieroptica.com.ar (decisión pendiente: redirigir o dar de baja)
${promo.map(p => `- \`${p}\``).join('\n') || '- (sin páginas archivadas)'}

## 🟢 Redirigen bien (verificación completa)
${buckets.REDIRECT.map(r => `- \`${r.path}\` → \`${r.finalPath}\``).join('\n') || '- (ninguna)'}
`;

mkdirSync(new URL('../scratch/', import.meta.url), { recursive: true });
const out = new URL('../scratch/seo-audit-report.md', import.meta.url);
writeFileSync(out, report);
console.log(`\nListo → scratch/seo-audit-report.md`);
console.log(`ROTAS: ${buckets.NOT_FOUND.length} · SOFT404: ${buckets.SOFT404.length} · ERROR: ${buckets.ERROR.length} · REDIRECT: ${buckets.REDIRECT.length} · OK: ${buckets.OK.length}`);
if (buckets.NOT_FOUND.length || buckets.SOFT404.length) process.exitCode = 2;
