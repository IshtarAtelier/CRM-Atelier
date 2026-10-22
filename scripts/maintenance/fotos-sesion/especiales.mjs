// Fotos especiales (armazón en la mano / primer plano sin cara detectable): recorte manual, mismo
// color que el resto (balance con calidez, exposición, curva suave), SIN reemplazar el fondo.
import sharp from 'sharp';
import path from 'node:path';
import { readFileSync } from 'node:fs';
const [,, dirFull, salida, configJson] = process.argv;
if (!configJson) { console.error('Uso: node especiales.mjs <originales> <salida> <config.json> [números...]'); process.exit(2); }
const CONFIG = JSON.parse(readFileSync(configJson, 'utf8'));
const CORTES = CONFIG.cortes, GRANITO = CONFIG.granito || {};
const CALIDEZ = [1.035, 1.0, 0.95], CONTRASTE = 0.12, OBJ = 0.56;
// pincel corrector: tono = entorno del granito (sin el granito); textura = piel limpia desplazada
function corregirGranito(buf, [gx, gy, r]) {
  const L = 1200, at = (x, y, ch) => buf[(y * L + x) * 3 + ch];
  const R = Math.ceil(r * 1.5), anillo = (cx, cy, rr) => { const s = [0, 0, 0]; let k = 0; for (let a = 0; a < 32; a++) { const x = Math.round(cx + Math.cos(a / 32 * 6.283) * rr), y = Math.round(cy + Math.sin(a / 32 * 6.283) * rr); for (let ch = 0; ch < 3; ch++) s[ch] += at(x, y, ch); k++; } return s.map(v => v / k); };
  const dest = anillo(gx, gy, R + 2);
  let mejor = null;
  for (const dist of [R * 2 + 4, R * 3 + 6]) for (let a = 0; a < 16; a++) {
    const ox = Math.round(Math.cos(a / 16 * 6.283) * dist), oy = Math.round(Math.sin(a / 16 * 6.283) * dist);
    const src = anillo(gx + ox, gy + oy, R + 2), cen = anillo(gx + ox, gy + oy, R * 0.5);
    const d = [0, 1, 2].reduce((t, ch) => t + Math.abs(src[ch] - dest[ch]) + Math.abs(cen[ch] - dest[ch]), 0);
    if (!mejor || d < mejor.d) mejor = { ox, oy, d, src };
  }
  const ajuste = [0, 1, 2].map(ch => dest[ch] - mejor.src[ch]);
  const out = Buffer.from(buf);
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const d = Math.hypot(x, y) / R; if (d >= 1) continue;
    const al = d < 0.55 ? 1 : (1 - (d - 0.55) / 0.45) ** 1.5;
    for (let ch = 0; ch < 3; ch++) { const ti = ((gy + y) * L + gx + x) * 3 + ch, si = ((gy + y + mejor.oy) * L + gx + x + mejor.ox) * 3 + ch;
      out[ti] = Math.round(buf[ti] * (1 - al) + (buf[si] + ajuste[ch]) * al); }
  }
  return out;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SOLO = process.argv.slice(5).map(Number);
for (const [n, [fx, fy, fl]] of Object.entries(CORTES)) {
  if (SOLO.length && !SOLO.includes(Number(n))) continue;
  const md = await sharp(path.join(dirFull, `${n}.jpg`)).metadata(); const girada = (md.orientation || 1) >= 5;
  const W = girada ? md.height : md.width, H = girada ? md.width : md.height;
  const side = Math.round(W * fl), left = clamp(Math.round(W * fx - side / 2), 0, W - side), top = clamp(Math.round(H * fy - side / 2), 0, H - side);
  const { data } = await sharp(path.join(dirFull, `${n}.jpg`)).rotate().extract({ left, top, width: side, height: side }).resize(1200, 1200, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  // balance: el promedio de la foto como gris (son fondos de cortina), parcial, con la misma calidez
  let s = [0, 0, 0]; for (let i = 0; i < data.length; i += 3) for (let c = 0; c < 3; c++) s[c] += data[i + c];
  const m = s.map(v => v / (data.length / 3)), g = (m[0] + m[1] + m[2]) / 3, gan = m.map((v, i) => (1 + 0.6 * (g / v - 1)) * CALIDEZ[i]);
  const lums = []; for (let i = 0; i < data.length; i += 30) lums.push((0.2126 * data[i] * gan[0] + 0.7152 * data[i + 1] * gan[1] + 0.0722 * data[i + 2] * gan[2]) / 255);
  lums.sort((a, b) => a - b); const med = lums[lums.length >> 1], k = clamp(OBJ / med, 0.85, 1.3);
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) { let x = data[i] * gan[i % 3] * k / 255; if (x > 0.82) x = 0.82 + 0.18 * (1 - Math.exp(-(x - 0.82) / 0.18)); x = clamp(x, 0, 1); x = x * (1 - CONTRASTE) + CONTRASTE * x * x * (3 - 2 * x); out[i] = Math.round(x * 255); }
  const final = GRANITO[n] ? corregirGranito(out, GRANITO[n]) : out;
  await sharp(final, { raw: { width: 1200, height: 1200, channels: 3 } }).sharpen({ sigma: 0.6 }).webp({ quality: 82, effort: 5 }).toFile(path.join(salida, `${n}.webp`));
  console.log(n, { side, left, top, ganancia: +k.toFixed(2) });
}
