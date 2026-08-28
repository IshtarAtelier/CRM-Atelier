/**
 * Recolorea una imagen de fabricante a los tonos de Atelier.
 *
 *   node scripts/social/recolorear-imagen.mjs <entrada> <salida>
 *
 * POR QUÉ EXISTE
 * Las gráficas oficiales (Essilor Stellest, etc.) vienen en el celeste del
 * fabricante. Ishtar (28/8/26): "usá las imágenes pero cambiale el celeste por
 * otro tono" — la información es de ellos, la estética es nuestra. Esto rota
 * los tonos fríos (azules/celestes) hacia la gama cálida de la marca
 * (#7d6249 bronce / #d6bfae arena, leídos de globals.css vía identidad.mjs)
 * sin tocar los tonos que ya son cálidos ni los neutros (blancos, la piel de
 * una foto no se arruina porque no es azul).
 *
 * Cómo: pasa píxel por píxel a HSL; si el matiz cae en el rango frío
 * (170°–260°), lo mapea al matiz de la marca (~28°) conservando luminosidad
 * y bajando un poco la saturación (el celeste Essilor es muy saturado y en
 * bronce quedaría naranja chillón).
 */
import sharp from 'sharp';

const [entrada, salida] = process.argv.slice(2);
if (!entrada || !salida) {
    console.error('Uso: node scripts/social/recolorear-imagen.mjs <entrada> <salida>');
    process.exit(1);
}

const MATIZ_MARCA = 28;      // #7d6249 en HSL ≈ 28°
const FRIO_DESDE = 150;      // desde el verde-cian…
const FRIO_HASTA = 270;      // …hasta el violeta: todo eso es "celeste ajeno"

function rgbAHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
    }
    return [h * 360, s, l];
}

function hslARgb(h, s, l) {
    h /= 360;
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255));
}

const img = sharp(entrada);
const { width, height } = await img.metadata();
const buf = await img.raw().toBuffer({ resolveWithObject: true });
const px = buf.data;
const canales = buf.info.channels;

for (let i = 0; i < px.length; i += canales) {
    const [h, s, l] = rgbAHsl(px[i], px[i + 1], px[i + 2]);
    if (h >= FRIO_DESDE && h <= FRIO_HASTA && s > 0.08) {
        const [r, g, b] = hslARgb(MATIZ_MARCA, Math.min(s * 0.75, 0.55), l);
        px[i] = r; px[i + 1] = g; px[i + 2] = b;
    }
}

await sharp(px, { raw: { width: buf.info.width, height: buf.info.height, channels: canales } })
    .jpeg({ quality: 92 })
    .toFile(salida);
console.log('✅', salida);
