#!/usr/bin/env node
/**
 * ⚠️ REESCRIBE las fotos de `public/assets/products/` (con --aplicar).
 *
 * Achica al lado largo de 2000 px las fotos de producto que vienen en 5000 a
 * 6000 px (284 de 299 archivos, 23 MB). El sitio nunca las muestra a más de
 * 1600 px (`deviceSizes` en next.config.ts), así que no se pierde ni un píxel
 * visible; lo que se gana es el optimizador: en producción, generar la
 * primera variante de un AVIF de 6104 px tarda 1,9 s (medido 16/9/2026),
 * y eso lo paga el primer visitante de cada foto en cada ancho. Con un
 * original de 2000 px decodifica 9 veces menos píxeles.
 *
 * Se conserva el formato de cada archivo y su perfil de color. No se toca
 * nada que ya esté en 2000 px o menos. Git guarda los originales.
 *
 * Uso:
 *   node scripts/maintenance/achicar-fotos-producto.mjs            (simula)
 *   node scripts/maintenance/achicar-fotos-producto.mjs --aplicar
 */
import sharp from 'sharp';
import { readdirSync, statSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DIR = 'public/assets/products';
const LADO = 2000;
const APLICAR = process.argv.includes('--aplicar');

const archivos = [];
(function caminar(d) { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) caminar(p); else if (/\.(avif|webp|jpe?g|png)$/i.test(f)) archivos.push(p); } })(DIR);

let antes = 0, despues = 0, n = 0, saltadas = 0;
for (const p of archivos) {
  const m = await sharp(p).metadata();
  if (Math.max(m.width, m.height) <= LADO) { saltadas++; continue; }
  const tam = statSync(p).size;
  let img = sharp(p).rotate().resize({ width: LADO, height: LADO, fit: 'inside' }).keepIccProfile();
  if (m.format === 'heif') img = img.avif({ quality: 68, effort: 4 });
  else if (m.format === 'webp') img = img.webp({ quality: 84, effort: 5 });
  else if (m.format === 'jpeg') img = img.jpeg({ quality: 86, mozjpeg: true });
  else img = img.png();
  const buf = await img.toBuffer();
  const v = await sharp(buf).metadata();
  if (Math.max(v.width, v.height) !== LADO) throw new Error(`${p}: quedó de ${v.width}x${v.height}`);
  antes += tam; despues += buf.length; n++;
  if (APLICAR) { writeFileSync(`${p}.tmp`, buf); renameSync(`${p}.tmp`, p); }
}
console.log(`Achicadas: ${n} · ya estaban en ≤${LADO}px: ${saltadas}`);
console.log(`Peso: ${(antes / 1048576).toFixed(1)} MB → ${(despues / 1048576).toFixed(1)} MB`);
if (!APLICAR) console.log('SIMULACIÓN — no se escribió nada.');
