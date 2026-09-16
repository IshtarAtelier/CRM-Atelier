// Genera las portadas de las carpetas del home (public/images/home/carpetas) desde
// los originales de la sesión de Agostina (Gutierrez sept/26). Solo escribe archivos
// en public/, no toca la base. Uso: node scripts/maintenance/home-carpetas/generar-portadas.mjs "<carpeta de la sesión>"
// Genera las portadas de las carpetas del home desde los originales de la sesión.
import { createRequire } from 'node:module';
const sharp = createRequire('/Users/ishtarpissano/proyectos/atelier-subida-qs/package.json')('sharp');
const S = process.argv[2], out = '/Users/ishtarpissano/proyectos/atelier-subida-qs/public/images/home/carpetas/';
// Luz pareja: se estira el rango de cada foto para que el fondo (la cortina)
// llegue a blanco en todas y las caras queden a la misma altura, sin quemar.
const LUZ = { brightness: 1.05, saturation: 1.03 };
const NORMALISE = { lower: 0.3, upper: 97.5 };
// Retoques puntuales, en fracciones del recorte final: se tapa con el fondo de al lado.
const PARCHES = { 'clipon-verona-frente': [{ x: 0.215, y: 0.48, w: 0.15, h: 0.25, desde: 0.06 }] };
async function parchar(img, k) {
  const lista = PARCHES[k]; if (!lista) return img;
  const buf = await img.toBuffer(); const m = await sharp(buf).metadata(); const capas = [];
  for (const p of lista) {
    const w = Math.round(p.w * m.width), h = Math.round(p.h * m.height), left = Math.round(p.x * m.width), top = Math.round(p.y * m.height);
    const desde = Math.round(p.desde * m.width);
    const patch = await sharp(buf).extract({ left: desde, top, width: w, height: h }).blur(10).ensureAlpha().png().toBuffer();
    // máscara con bordes suaves para que no se note el rectángulo
    // La máscara va en el canal ALFA (opacidad), no en el color: dest-in solo mira el alfa.
    const mask = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="40%" stop-color="#fff" stop-opacity="1"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`);
    const conMask = await sharp(patch).composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }]).png().toBuffer();
    capas.push({ input: conMask, left, top });
  }
  return sharp(buf).composite(capas);
}
async function topeCabeza(buf) {
  const { data, info } = await sharp(buf).resize({ width: 200 }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, x0 = Math.floor(w * 0.3), x1 = Math.floor(w * 0.7);
  for (let y = 0; y < h; y++) { let d = 0; for (let x = x0; x < x1; x++) if (data[y * w + x] < 95) d++; if (d > (x1 - x0) * 0.06) return y / h; }
  return 0;
}
// [archivo, tipo]: cara = desde el tope de la cabeza, con `alto` (fracción del resto) y ancho 0.86·alto; libre = entera
const M = {
  'receta-helena-c4-cerca': ['057 - HELENA C4.jpg',   'cara', 0.84],
  'sol-vega-c1-frente':     ['570 - VEGA C1.jpg',     'cara', 1],
  'clipon-verona-frente':   ['466 - VERONA C1.jpg',   'cara', 1],
  'tienda-victoria-manos':  ['081 - VICTORIA C1.jpg', 'libre'],
};
for (const [k, [f, tipo, alto]] of Object.entries(M)) {
  const buf = await sharp(S + '/' + f).rotate().toBuffer(); const meta = await sharp(buf).metadata();
  let region = { left: 0, top: 0, width: meta.width, height: meta.height };
  if (tipo === 'cara') {
    const t = await topeCabeza(buf); const top = Math.max(0, Math.round((t - 0.012) * meta.height));
    let height = Math.round((meta.height - top) * alto), width = meta.width;
    if (alto < 1) { width = Math.min(meta.width, Math.round(height * 0.86)); }
    region = { left: Math.round((meta.width - width) / 2), top, width, height };
  }
  const base = sharp(buf).extract(region).resize({ height: 1800, withoutEnlargement: true }).normalise(NORMALISE).modulate(LUZ);
  await (await parchar(base, k)).webp({ quality: 78 }).toFile(out + k + '.webp');
  console.log(k, tipo, alto ?? '');
}
