#!/usr/bin/env node
/**
 * El planner del feed: qué sale cada día de acá a N semanas, con el carrusel
 * programado (feed-programacion.json), los reels y el modelo del día
 * (feed-modelos.json). Solo lee archivos del repo: ninguna base, ninguna red.
 *
 *   node scripts/social/planner-feed.mjs            # 8 semanas
 *   node scripts/social/planner-feed.mjs --semanas 4
 *
 * Ishtar, 19/10/2026: "mostrame el planner de los carruseles antes". Lo que
 * dice acá es exactamente lo que van a hacer los crons, porque usa la misma
 * elección (src/lib/social/modelo-del-dia.ts) con los mismos datos.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from './identidad.mjs';
import { modeloDelDia, tocaHoy, DIAS } from '../../src/lib/social/modelo-del-dia.ts';

const args = process.argv.slice(2);
const SEMANAS = Number(args[args.indexOf('--semanas') + 1]) || 8;
const leer = (...t) => JSON.parse(readFileSync(path.join(RAIZ, ...t), 'utf-8'));
const prog = leer('social', 'feed-programacion.json').programacion;
const { carriles, dias } = leer('social', 'feed-modelos.json');

const hoyART = () => { const d = new Date(Date.now() - 3 * 3600e3); return d.toISOString().slice(0, 10); };
const diasDesdeOrigen = (f) => Math.round((Date.parse(`${f}T00:00:00Z`) - Date.UTC(2026, 0, 1)) / 86400e3);
const titulo = (id) => { try { const p = leer('social', 'contenido', `${id}.json`); return p.producto ? `${p.producto.nombre}${p.producto.color ? ' ' + p.producto.color : ''}` : (p.caption || '').split('\n')[0]; } catch { return '(sin pieza)'; } };

console.log(`\n  Planner del feed — ${SEMANAS} semanas desde hoy (${hoyART()}). Lunes = fotos de modelo.\n`);
let f = hoyART();
for (let i = 0; i < SEMANAS * 7; i++) {
    const dia = DIAS[new Date(`${f}T12:00:00Z`).getUTCDay()];
    const e = prog.find(x => x.fecha === f);
    let linea = '';
    if (e?.reel) linea = `reel · ${e.reel}`;
    else if (e?.pieza) linea = `${e.pieza.startsWith('carrusel-') || e.pieza.startsWith('feed-') ? '📸' : '🗂'} ${e.pieza}${e.pieza.startsWith('carrusel-') ? `  (${titulo(e.pieza)})` : ''}`;
    else if (tocaHoy(dias, f)) { const m = modeloDelDia(carriles, diasDesdeOrigen(f)); if (m) linea = `📸 modelo del día · ${m.carril} · ${m.id}  (${titulo(m.id)})`; }
    if (linea || dia === 'lun') console.log(`  ${f} ${dia.padEnd(3)}  ${linea || '—'}`);
    const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); f = d.toISOString().slice(0, 10);
}
console.log('\n  📸 = carrusel de fotos de modelo · 🗂 = carrusel de contenido · reel\n');
