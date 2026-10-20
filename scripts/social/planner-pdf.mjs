#!/usr/bin/env node
/**
 * El planner de TODO el contenido programado, en PDF: feed (carruseles y
 * modelo del día), reels y stories (las dos tandas + feriados), día por día.
 *
 *   node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/social/planner-pdf.mjs
 *   ... --hasta 2026-12-31     # por defecto: la última fecha programada
 *   ... --salida docs/planner.pdf
 *
 * Solo lee archivos del repo (ninguna base, ninguna red) y usa EXACTAMENTE la
 * misma elección que los crons: feed-programacion.json + modelo-del-dia.ts para
 * el feed, y el PLAN de /api/cron/social-story-diaria para las stories
 * (contenido avanza de a 4 por día, Agostina de a 2; la tarde toma las 2
 * siguientes). Si el PLAN del cron cambia, cambiar PLAN acá también.
 *
 * Ishtar, 19/10/2026: "traeme en un pdf el planner de todo el contenido
 * programado para el feed, los reels y las stories".
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { RAIZ } from './identidad.mjs';
import { modeloDelDia, tocaHoy, DIAS } from '../../src/lib/social/modelo-del-dia.ts';
import { feriadosParaAvisarHoy, idPiezaFeriado } from '../../src/lib/social/stories-feriados.ts';

const args = process.argv.slice(2);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const leer = (...t) => JSON.parse(readFileSync(path.join(RAIZ, ...t), 'utf-8'));

const prog = leer('social', 'feed-programacion.json').programacion;
const feedModelos = leer('social', 'feed-modelos.json');
const stories = leer('social', 'stories-diarias.json').carriles;

// Espejo del PLAN del cron social-story-diaria (route.ts).
const PLAN = { manana: { contenido: 2, agostina: 2, 'massaru-sol': 2 }, tarde: { contenido: 2, 'massaru-receta': 2 } };
const TANDAS = Object.keys(PLAN);
const ORIGEN = Date.UTC(2026, 0, 1);

const hoyART = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const diasDesdeOrigen = (f) => Math.round((Date.parse(`${f}T00:00:00Z`) - ORIGEN) / 86400e3);
const sumar = (f, n) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ddmm = (f) => { const [a, m, d] = f.split('-'); return `${d}/${m}/${a}`; };
const diaSemana = (f) => DIAS[new Date(`${f}T12:00:00Z`).getUTCDay()];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const DESDE = arg('--desde') || hoyART();
const HASTA = arg('--hasta') || prog.map(e => e.fecha).sort().at(-1);
const SALIDA = path.resolve(RAIZ, arg('--salida') || `docs/planner-contenido-${DESDE}.pdf`);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function pieza(id) {
    try { return leer('social', 'contenido', `${id}.json`); } catch { return null; }
}
function tituloPieza(id) {
    const p = pieza(id);
    if (!p) return id;
    if (p.producto) return `${p.producto.nombre}${p.producto.color ? ' ' + p.producto.color : ''}`;
    const portada = p.slides?.find(s => s.title)?.title;
    return portada || (p.caption || '').split('\n')[0].slice(0, 90) || id;
}
function tituloReel(id) {
    try { const r = leer('social', 'contenido', 'reels', `${id}.json`); return (r.copy || '').split('\n')[0].slice(0, 110) || id; }
    catch { return id; }
}

// Miniaturas embebidas (chicas: 160 px de ancho) para que el PDF pese poco.
const miniaturas = new Map();
async function miniatura(rel) {
    if (miniaturas.has(rel)) return miniaturas.get(rel);
    const abs = path.join(RAIZ, 'public', rel);
    let out = '';
    if (existsSync(abs)) {
        const buf = await sharp(abs).resize({ width: 200 }).jpeg({ quality: 60 }).toBuffer();
        out = `data:image/jpeg;base64,${buf.toString('base64')}`;
    }
    miniaturas.set(rel, out);
    return out;
}
const portadaFeed = (id) => `social/${id}/01.jpg`;
const portadaReel = (id) => `social/reels/${id}-cover.jpg`;

/** Lo que el cron social-story-diaria elige para una fecha y tanda. */
function storiesDe(fecha, tanda) {
    const dia = diasDesdeOrigen(fecha);
    const porCarril = Object.entries(stories).map(([carril, lista]) => {
        const porDia = TANDAS.reduce((s, t) => s + (PLAN[t][carril] ?? 0), 0);
        const pide = PLAN[tanda][carril] ?? 0;
        if (!lista?.length || !porDia || !pide) return [];
        const base = (((dia * porDia) % lista.length) + lista.length) % lista.length;
        let despl = 0;
        for (const t of TANDAS) { if (t === tanda) break; despl += PLAN[t][carril] ?? 0; }
        return Array.from({ length: Math.min(pide, lista.length) }, (_, k) => ({ carril, ...lista[(base + despl + k) % lista.length] }));
    });
    const elegidas = [];
    for (let k = 0; porCarril.some(l => k < l.length); k++) for (const l of porCarril) if (k < l.length) elegidas.push(l[k]);
    if (tanda === 'manana') {
        for (const f of feriadosParaAvisarHoy(fecha).reverse()) elegidas.unshift({ carril: 'feriados', id: idPiezaFeriado(f.fecha), tipo: 'feriado', slides: 1 });
    }
    return elegidas;
}

/** Lo que sale al feed ese día. */
function feedDe(fecha) {
    const e = prog.find(x => x.fecha === fecha);
    if (e?.reel) return { clase: 'reel', id: e.reel, titulo: tituloReel(e.reel), img: portadaReel(e.reel) };
    if (e?.pieza) {
        const fotos = e.pieza.startsWith('carrusel-') || e.pieza.startsWith('feed-');
        return { clase: fotos ? 'fotos' : 'carrusel', id: e.pieza, titulo: tituloPieza(e.pieza), img: portadaFeed(e.pieza), pieza: pieza(e.pieza) };
    }
    if (tocaHoy(feedModelos.dias, fecha)) {
        const m = modeloDelDia(feedModelos.carriles, diasDesdeOrigen(fecha));
        if (m) return { clase: 'fotos', id: m.id, titulo: `${tituloPieza(m.id)} · modelo del día (${m.carril})`, img: portadaFeed(m.id), pieza: pieza(m.id) };
    }
    return null;
}

const avisos = [];
function frescura(fecha, p, id) {
    if (!p || p.fuente !== 'base') return '';
    if (!p.generadoEl) { avisos.push(`${ddmm(fecha)} · ${id}: trae precios y no tiene fecha de generación.`); return '⚠ sin fecha'; }
    const edad = Math.round((Date.parse(`${fecha}T12:00:00Z`) - Date.parse(p.generadoEl)) / 86400e3);
    if (edad > 10) { avisos.push(`${ddmm(fecha)} · ${id}: generado el ${ddmm(p.generadoEl.slice(0, 10))}, a esa fecha tendría ${edad} días (>10). Regenerar antes.`); return `⚠ regenerar (${edad} d)`; }
    return '';
}

async function main() {
    const dias = [];
    for (let f = DESDE; f <= HASTA; f = sumar(f, 1)) {
        const feed = feedDe(f);
        if (feed) { feed.imgData = await miniatura(feed.img); feed.aviso = frescura(f, feed.pieza, feed.id); if (!feed.imgData) avisos.push(`${ddmm(f)} · ${feed.id}: falta la imagen ${feed.img}.`); }
        const tandas = {};
        for (const t of TANDAS) {
            tandas[t] = await Promise.all(storiesDe(f, t).map(async s => ({ ...s, titulo: tituloPieza(s.id), imgData: await miniatura(`social/${s.id}/01.jpg`) })));
            for (const s of tandas[t]) if (!s.imgData) avisos.push(`${ddmm(f)} · story ${s.id}: falta la imagen social/${s.id}/01.jpg.`);
        }
        dias.push({ fecha: f, feed, tandas });
    }

    // DUPLICADOS (Ishtar, 19/10/2026: "asegurate que lo programado no esté
    // duplicado"): misma story dos veces el mismo día, el mismo modelo en el
    // feed y en stories el mismo día, y repeticiones del feed antes del plazo
    // (21 días los carruseles, 42 los reels; desfile-modelos se exime a propósito).
    const modelo = (id) => id.replace(/^(story|feed)-(agos|massaru)-/, '');
    for (const d of dias) {
        const todas = Object.values(d.tandas).flat();
        const vistos = new Set();
        for (const s of todas) { if (vistos.has(s.id)) avisos.push(`${ddmm(d.fecha)} · story ${s.id} sale dos veces el mismo día.`); vistos.add(s.id); }
        if (d.feed?.clase === 'fotos') for (const s of todas) if (modelo(s.id) === modelo(d.feed.id)) avisos.push(`${ddmm(d.fecha)} · ${modelo(s.id)} sale en el feed y en stories el mismo día.`);
    }
    const ultima = new Map();
    for (const d of dias) {
        if (!d.feed) continue;
        const k = `${d.feed.clase}:${d.feed.id}`, plazo = d.feed.clase === 'reel' ? 42 : 21;
        if (ultima.has(k)) { const gap = diasDesdeOrigen(d.fecha) - diasDesdeOrigen(ultima.get(k)); if (gap < plazo && d.feed.id !== 'desfile-modelos') avisos.push(`${ddmm(d.fecha)} · ${d.feed.id} repite a los ${gap} días (mínimo ${plazo}).`); }
        ultima.set(k, d.fecha);
    }

    const resumen = {
        carruseles: dias.filter(d => d.feed?.clase === 'carrusel').length,
        fotos: dias.filter(d => d.feed?.clase === 'fotos').length,
        reels: dias.filter(d => d.feed?.clase === 'reel').length,
        stories: dias.reduce((s, d) => s + Object.values(d.tandas).flat().reduce((a, x) => a + (x.slides ?? 1), 0), 0),
    };

    // Agrupar por semana (lunes a domingo).
    const semanas = [];
    for (const d of dias) {
        const lunes = sumar(d.fecha, -((new Date(`${d.fecha}T12:00:00Z`).getUTCDay() + 6) % 7));
        let s = semanas.at(-1);
        if (!s || s.lunes !== lunes) { s = { lunes, dias: [] }; semanas.push(s); }
        s.dias.push(d);
    }

    const ETIQUETA = { carrusel: 'Carrusel', fotos: 'Carrusel de fotos', reel: 'Reel' };
    const storyHtml = (s) => `
        <div class="story ${s.carril}">
            ${s.imgData ? `<img src="${s.imgData}">` : '<div class="falta">sin imagen</div>'}
            <div class="st">${esc(s.titulo)}${(s.slides ?? 1) > 1 ? ` <span class="n">×${s.slides}</span>` : ''}</div>
        </div>`;

    // ANEXO (Ishtar, 19/10/2026: "mostrame los carruseles programados, todas las
    // fotos que incluye"): cada carrusel que va al feed, una vez, con todas sus slides.
    const anexo = [];
    const yaEnAnexo = new Set();
    for (const d of dias) {
        const f = d.feed;
        if (!f || f.clase === 'reel' || yaEnAnexo.has(f.id)) continue;
        yaEnAnexo.add(f.id);
        const slides = f.pieza?.slides?.length || 1;
        const fotos = [];
        for (let i = 1; i <= slides; i++) fotos.push(await miniatura(`social/${f.id}/${String(i).padStart(2, '0')}.jpg`));
        const fechas = dias.filter(x => x.feed?.id === f.id).map(x => ddmm(x.fecha).slice(0, 5));
        anexo.push({ ...f, fotos, fechas, caption: f.pieza?.caption || '' });
    }
    const anexoHtml = `<div class="anexo"><h2>Anexo · los carruseles del feed, foto por foto (${anexo.length})</h2>
      ${anexo.map(a => `<div class="car"><div class="cab"><span class="tag ${a.clase}">${ETIQUETA[a.clase]}</span> <b>${esc(a.titulo)}</b> <span class="id">${esc(a.id)}</span> · ${a.fotos.length} ${a.fotos.length === 1 ? 'foto' : 'fotos'} · sale: ${a.fechas.join(', ')}</div>
        <div class="fotos">${a.fotos.map((m, i) => m ? `<div class="f"><img src="${m}"><small>${i + 1}</small></div>` : `<div class="f falta">falta ${i + 1}</div>`).join('')}</div>
        ${a.caption ? `<div class="cap">${esc(a.caption.split('\n')[0].slice(0, 160))}</div>` : ''}</div>`).join('')}</div>`;

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Planner de contenido</title>
    <style>
      @page { size: A4 landscape; margin: 12mm 12mm 14mm; }
      body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; font-size: 9.5px; margin: 0; }
      h1 { font-size: 22px; margin: 0 0 4px; } .sub { color: #555; font-size: 11px; margin-bottom: 10px; }
      .resumen { display: flex; gap: 18px; margin: 8px 0 14px; } .resumen div { border: 1px solid #ddd; border-radius: 6px; padding: 6px 12px; }
      .resumen b { display: block; font-size: 18px; }
      .leyenda { color: #555; font-size: 9px; margin-bottom: 10px; }
      .semana { margin-bottom: 14px; } tr { page-break-inside: avoid; } thead { display: table-header-group; }
      .semana h2 { font-size: 12px; margin: 0 0 4px; padding: 3px 6px; background: #1a1a1a; color: #c8a55c; border-radius: 4px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th { text-align: left; font-size: 9px; color: #666; font-weight: 600; padding: 2px 4px; border-bottom: 1px solid #ccc; }
      td { vertical-align: top; padding: 4px; border-bottom: 1px solid #e5e5e5; }
      tr.finde td { background: #faf8f3; }
      .fecha { width: 52px; font-weight: 700; } .fecha small { display: block; color: #777; font-weight: 400; }
      .feedcol { width: 215px; }
      .feed { display: flex; gap: 6px; align-items: flex-start; } .feed img { width: 54px; height: 54px; object-fit: cover; border-radius: 4px; }
      .feed.reel img { width: 36px; height: 64px; }
      .tag { display: inline-block; font-size: 8px; padding: 1px 5px; border-radius: 3px; color: #fff; margin-bottom: 2px; }
      .tag.carrusel { background: #8a6d3b; } .tag.fotos { background: #4a6b8a; } .tag.reel { background: #a33; }
      .feed .t { font-weight: 600; } .feed .id { color: #777; font-size: 8px; } .aviso { color: #a33; font-weight: 700; font-size: 8.5px; }
      .nada { color: #999; }
      .stories { display: flex; gap: 4px; flex-wrap: wrap; }
      .story { width: 78px; } .story img { width: 78px; height: 48px; object-fit: cover; object-position: center 28%; border-radius: 3px; display: block; }
      .story .st { font-size: 7.5px; line-height: 1.2; margin-top: 2px; max-height: 2.4em; overflow: hidden; }
      .story.agostina .st { color: #4a6b8a; } .story.massaru-sol .st, .story.massaru-receta .st { color: #8a6d3b; } .story.feriados img { outline: 2px solid #a33; } .n { color: #777; }
      .falta { width: 78px; height: 48px; background: #eee; color: #a33; font-size: 7px; display: flex; align-items: center; justify-content: center; border-radius: 3px; }
      .anexo { page-break-before: always; } .anexo h2 { font-size: 14px; }
      .car { page-break-inside: avoid; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #ddd; }
      .cab { font-size: 10px; margin-bottom: 4px; } .cab .id { color: #777; font-size: 8px; }
      .fotos { display: flex; gap: 5px; flex-wrap: wrap; } .f { position: relative; } .f img { width: 96px; height: 120px; object-fit: cover; border-radius: 4px; display: block; }
      .f small { position: absolute; left: 3px; top: 3px; background: rgba(0,0,0,.6); color: #fff; font-size: 8px; padding: 0 4px; border-radius: 3px; }
      .f.falta { width: 96px; height: 120px; background: #eee; color: #a33; font-size: 8px; display: flex; align-items: center; justify-content: center; }
      .cap { color: #555; font-size: 8.5px; margin-top: 3px; }
      .avisos { page-break-before: always; } .avisos h2 { font-size: 14px; } .avisos li { margin: 3px 0; font-size: 10px; }
    </style></head><body>
    <h1>Planner de contenido · Atelier Óptica</h1>
    <div class="sub">Del ${ddmm(DESDE)} al ${ddmm(HASTA)} · generado el ${ddmm(hoyART())}. Es exactamente lo que van a publicar los crons con los datos de hoy (feed-programacion.json, feed-modelos.json, stories-diarias.json).</div>
    <div class="resumen">
      <div><b>${resumen.carruseles}</b>carruseles de contenido</div>
      <div><b>${resumen.fotos}</b>carruseles de fotos de modelo</div>
      <div><b>${resumen.reels}</b>reels</div>
      <div><b>${resumen.stories}</b>stories (placas) en ${dias.length} días</div>
    </div>
    <div class="leyenda">Feed: martes, jueves, sábado y domingo carrusel · miércoles y viernes reel · lunes fotos de modelo (Agostina / Massaru alternados). Stories: mañana 8:00 (2 de contenido + 2 modelos de Agostina + 2 de Massaru sol, intercaladas; antes, la del feriado si hay) y tarde 18:05 (2 de contenido + 2 de Massaru receta). ×n = cantidad de placas seguidas del mismo modelo. Borde rojo = story de feriado.</div>
    ${semanas.map(s => `
      <div class="semana"><h2>Semana del ${ddmm(s.lunes)} al ${ddmm(sumar(s.lunes, 6))} · ${MESES[Number(s.lunes.slice(5, 7)) - 1]}</h2>
      <table><thead><tr><th class="fecha">Día</th><th class="feedcol">Feed (FB + IG)</th><th>Stories · mañana 8:00</th><th>Stories · tarde 18:05</th></tr></thead><tbody>
      ${s.dias.map(d => {
        const ds = diaSemana(d.fecha);
        const f = d.feed;
        return `<tr class="${['sáb', 'dom'].includes(ds) ? 'finde' : ''}">
          <td class="fecha">${ddmm(d.fecha).slice(0, 5)}<small>${ds}</small></td>
          <td class="feedcol">${f ? `<div class="feed ${f.clase}">${f.imgData ? `<img src="${f.imgData}">` : '<div class="falta">sin imagen</div>'}<div><span class="tag ${f.clase}">${ETIQUETA[f.clase]}</span><div class="t">${esc(f.titulo)}</div><div class="id">${esc(f.id)}</div>${f.aviso ? `<div class="aviso">${f.aviso}</div>` : ''}</div></div>` : '<span class="nada">— el feed descansa</span>'}</td>
          <td><div class="stories">${d.tandas.manana.map(storyHtml).join('')}</div></td>
          <td><div class="stories">${d.tandas.tarde.map(storyHtml).join('')}</div></td>
        </tr>`; }).join('')}
      </tbody></table></div>`).join('')}
    ${avisos.length ? `<div class="avisos"><h2>Avisos (${avisos.length})</h2><p>Lo que a su fecha NO va a salir como está, o va a salir sin imagen. Los carruseles con precio (fuente: base) de más de 10 días el cron no los publica: hay que regenerarlos antes.</p><ul>${avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
    ${anexoHtml}
    </body></html>`;

    mkdirSync(path.dirname(SALIDA), { recursive: true });
    const { chromium } = await import('playwright');
    const navegador = await chromium.launch();
    const pagina = await navegador.newPage();
    await pagina.setContent(html, { waitUntil: 'load' });
    await pagina.pdf({ path: SALIDA, format: 'A4', landscape: true, printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;color:#777;width:100%;text-align:center;">Planner de contenido · Atelier Óptica · página <span class="pageNumber"></span> de <span class="totalPages"></span></div>' });
    await navegador.close();
    console.log(`PDF: ${path.relative(RAIZ, SALIDA)}  (${dias.length} días, ${resumen.carruseles + resumen.fotos} carruseles, ${resumen.reels} reels, ${resumen.stories} stories; ${avisos.length} avisos)`);
    for (const a of avisos) console.log(`  ⚠ ${a}`);
}

main().catch(e => { console.error(e); process.exit(1); });
