#!/usr/bin/env node
/**
 * Revisa las fotos de FRENTE de las dos sesiones (Agostina y Massaru) y dice
 * cuáles tienen los ojos cerrados o la mirada baja, ANTES de que salgan en una
 * placa. Solo lee: las fotos del escritorio y Vision (macOS). Sin base ni red.
 *
 *   node scripts/checks/ojos-abiertos.mjs            # las dos sesiones
 *   node scripts/checks/ojos-abiertos.mjs --umbral 0.2
 *
 * Ishtar, 20/10/2026: Hermes C1 salió al feed con los ojos cerrados ("revisá si
 * hay alguna más así"). La apertura la mide ojos-abiertos.swift (alto/ancho del
 * contorno del ojo). Calibrado sobre la sesión de Agos: Hermes C1 (291) da ~0,24;
 * Nashira C3 (590) ~0,26 con la mirada algo baja; las fotos normales mirando a
 * cámara, 0,30 a 0,40. Con lentes de sol no se mide (Vision no ve los ojos).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELOS as AGOS, CLIP, SOL } from '../social/modelos-agostina.mjs';
import { MODELOS as MASSARU, SOL as SOL_M } from '../social/modelos-massaru.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const UMBRAL = Number(args[args.indexOf('--umbral') + 1]) || 0.25;
const ESCRITORIO = path.join(os.homedir(), 'Desktop', 'Pagina web atelier');
const FOTOS_AGOS = path.join(ESCRITORIO, 'Fotos-Agos-Gutierrez-2026');
const FOTOS_MASSARU = path.join(ESCRITORIO, 'Contenido de Atelier', 'Sesión Massaru - oct 2026 (cuadrados editados)');

const bin = path.join(AQUI, 'ojos-abiertos');
if (!existsSync(bin)) execFileSync('swiftc', ['-O', '-o', bin, path.join(AQUI, 'ojos-abiertos.swift')], { stdio: 'inherit' });

const archivosAgos = existsSync(FOTOS_AGOS) ? readdirSync(FOTOS_AGOS) : [];
const fotoAgos = (n) => { const f = archivosAgos.find(a => a.startsWith(`${n} - `) && /\.jpe?g$/i.test(a)); return f ? path.join(FOTOS_AGOS, f) : null; };
const fotoMassaru = (n) => { const f = path.join(FOTOS_MASSARU, `${n}-cuadrado.jpg`); return existsSync(f) ? f : null; };

const frentes = [];
// Con lentes de sol Vision no ve los ojos y adivina: no se miden.
for (const [slug, nombre, color, familia, nums] of AGOS) {
    if (familia === SOL) continue;
    const n = familia === CLIP ? nums[1] : nums[0];
    const f = n && fotoAgos(n); if (f) frentes.push({ sesion: 'agos', id: `${nombre}${color ? ' ' + color : ''}`, slug, foto: f });
}
for (const [slug, nombre, color, familia, nums] of MASSARU) {
    if (familia === SOL_M) continue;
    const f = fotoMassaru(nums[0]); if (f) frentes.push({ sesion: 'massaru', id: `${nombre}${color ? ' ' + color : ''}`, slug, foto: f });
}
if (!frentes.length) { console.error('No encuentro las carpetas de fotos en el escritorio.'); process.exit(1); }

const medidas = JSON.parse(execFileSync(bin, frentes.map(f => f.foto), { maxBuffer: 64 * 1024 * 1024 }).toString());
const filas = frentes.map(f => { const m = medidas[f.foto]; const ap = m ? Math.min(m.izq ?? 9, m.der ?? 9) : null; return { ...f, apertura: ap, yaw: m?.yaw ?? null }; })
    .sort((a, b) => (a.apertura ?? 9) - (b.apertura ?? 9));

const sospechosas = filas.filter(f => f.apertura === null || f.apertura < UMBRAL);
console.log(`\n  Ojos abiertos — ${frentes.length} fotos de frente (umbral ${UMBRAL})\n`);
for (const f of filas.slice(0, 15)) {
    const marca = f.apertura === null ? '?' : f.apertura < UMBRAL ? '✗' : ' ';
    console.log(`  ${marca} ${(f.apertura ?? 0).toFixed(2)}  ${f.sesion.padEnd(7)} ${f.id.padEnd(16)} ${path.basename(f.foto)}`);
}
console.log(sospechosas.length ? `\n  ✗ ${sospechosas.length} con los ojos cerrados o sin cara: ${sospechosas.map(f => f.id).join(', ')}\n` : '\n  ✓ Todas con los ojos abiertos.\n');
process.exit(sospechosas.length ? 1 : 0);
