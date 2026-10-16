// Arma la carpeta final con el nombre del producto y las láminas de auditoría (original | editada | ficha).
import sharp from 'sharp';
import { readFileSync, mkdirSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const [,, S, destino, auditoria, publico] = process.argv;
const clave = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const usables = JSON.parse(readFileSync(`${S}/usables.json`));
const fichas = JSON.parse(readFileSync(`${S}/fichas.json`));
mkdirSync(destino, { recursive: true }); mkdirSync(auditoria, { recursive: true });
const cuenta = {}, indice = [];
const EXCLUIR = new Set((process.env.EXCLUIR || '').split(',').filter(Boolean).map(Number));
for (const [n, etiqueta] of usables) {
  if (EXCLUIR.has(n)) continue;
  const k = clave(etiqueta); cuenta[k] = (cuenta[k] || 0) + 1;
  const nombre = `${k}-massaru-${cuenta[k]}.webp`;
  const fuente = existsSync(`${S}/lote-esp/${n}.webp`) && [74, 76, 80, 81, 95].includes(n) ? `${S}/lote-esp/${n}.webp` : `${S}/${process.env.LOTE || 'lote4'}/${n}.webp`;
  if (!existsSync(fuente)) { console.log('FALTA', n, etiqueta); continue; }
  copyFileSync(fuente, path.join(destino, nombre));
  const ficha = fichas[k];
  indice.push({ archivo: nombre, foto_original: `26.1 -${n}.jpg`, producto: ficha?.nombre || etiqueta, lamina: `${String(n).padStart(3, '0')}_${nombre.replace('.webp', '.jpg')}` });
  // lámina: original entera | editada | foto de la ficha
  const H = 760, P = 10, HDR = 44;
  const o = await sharp(`${S}/full/${n}.jpg`).rotate().resize({ height: H, width: H, fit: 'inside' }).toBuffer({ resolveWithObject: true });
  const e = await sharp(fuente).resize(H, H).toBuffer();
  const fPath = ficha ? path.join(publico, ficha.foto) : null;
  const f = fPath && existsSync(fPath) ? await sharp(fPath).resize(H, H, { fit: 'contain', background: '#fff' }).toBuffer() : await sharp({ create: { width: H, height: H, channels: 3, background: '#ddd' } }).png().toBuffer();
  const W = o.info.width + 2 * H + 4 * P;
  const lab = (t, w) => Buffer.from(`<svg width="${w}" height="${HDR}"><rect width="100%" height="100%" fill="#1d1d1d"/><text x="10" y="29" font-size="20" font-family="Arial" fill="#fff">${t.replace(/&/g, '&amp;')}</text></svg>`);
  await sharp({ create: { width: W, height: H + HDR + 2 * P, channels: 3, background: '#3a3a3a' } }).composite([
    { input: lab(`ORIGINAL ${n}`, o.info.width), left: P, top: P }, { input: o.data, left: P, top: P + HDR },
    { input: lab(`EDITADA · ${nombre}`, H), left: 2 * P + o.info.width, top: P }, { input: e, left: 2 * P + o.info.width, top: P + HDR },
    { input: lab(ficha ? `FICHA DE LA TIENDA · ${ficha.nombre}` : `SIN FICHA (${etiqueta})`, H), left: 3 * P + o.info.width + H, top: P }, { input: f, left: 3 * P + o.info.width + H, top: P + HDR },
  ]).jpeg({ quality: 84 }).toFile(path.join(auditoria, indice.at(-1).lamina));
}
writeFileSync(path.join(auditoria, 'indice.json'), JSON.stringify(indice, null, 1));
console.log(indice.length, 'fotos con nombre de producto ·', Object.keys(cuenta).length, 'productos');
