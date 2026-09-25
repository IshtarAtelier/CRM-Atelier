/**
 * Fotos de producto listas para las piezas: el anteojo solo y el anteojo puesto.
 *
 * Dos funciones, compartidas por las piezas que muestran productos (placas y
 * stories de Instagram, reels de la tienda) para que todas recorten igual:
 *
 *  - fotoDeCatalogo(): la foto del catálogo recortada al borde del anteojo, con
 *    el fondo apenas gris blanqueado. null si no es de catálogo (una persona,
 *    una captura de pantalla de baja resolución, algo que no tiene forma de
 *    anteojo).
 *
 *  - fotoPuesta(): la foto del mismo modelo PUESTO (las "look" de la sesión de
 *    estudio, public/images/products/<slug>-look-N.webp), cortada como pidió
 *    Ishtar el 25/9/26: "que estén bien cortadas e iluminadas" y "donde empieza
 *    la cabeza empiece la foto". Se detecta el borde superior del pelo contra
 *    el fondo claro del estudio, el corte arranca ahí y se centra en la cara.
 *    La luz se ajusta suave (niveles y un punto de brillo), sin quemar la piel.
 *    Prefiere la de frente (look-1) y después la de perfil (look-2); la de las
 *    manos (look-3) no sirve para "el producto en el rostro".
 *
 * Todo se cachea al lado del original (recortes derivados, en .gitignore).
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from './identidad.mjs';

const PRODUCTOS = path.join(RAIZ, 'public', 'images', 'products');
const CACHE = path.join(RAIZ, 'public', 'images', 'catalogo-social');

async function sharpDe() {
    return (await import('sharp')).default;
}

/** Foto de catálogo recortada al borde del anteojo, o null si no es de catálogo. */
export async function fotoDeCatalogo(rutaAbs, nombre) {
    const sharp = await sharpDe();
    const destino = path.join(path.dirname(rutaAbs), `${nombre}-recorte.jpg`);
    if (existsSync(destino)) return destino;
    const meta = await sharp(rutaAbs).metadata();
    if ((meta.width || 0) < 900) return null; // baja resolución: una captura o una miniatura
    const { data, info } = await sharp(rutaAbs).resize(60, 60, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const esquina = (x0, y0) => {
        let s = 0, n = 0;
        for (let y = y0; y < y0 + 6; y++) for (let x = x0; x < x0 + 6; x++) {
            const i = (y * info.width + x) * info.channels; s += Math.min(data[i], data[i + 1], data[i + 2]); n++;
        }
        return s / n;
    };
    if (Math.min(esquina(0, 0), esquina(54, 0), esquina(0, 54), esquina(54, 54)) < 236) return null;
    const t = await sharp(rutaAbs).trim({ background: '#ffffff', threshold: 22 }).toBuffer({ resolveWithObject: true });
    if (t.info.width / t.info.height < 1.3) return null;
    // Blanqueo del fondo apenas gris (solo píxeles neutros y casi blancos).
    const crudo = await sharp(t.data).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = crudo.data;
    for (let i = 0; i < px.length; i += crudo.info.channels) {
        const min = Math.min(px[i], px[i + 1], px[i + 2]), max = Math.max(px[i], px[i + 1], px[i + 2]);
        if (min < 222 || max - min > 14) continue;
        const k = Math.min(1, (min - 222) / 14);
        for (let c = 0; c < 3; c++) px[i + c] = Math.round(px[i + c] + (255 - px[i + c]) * k);
    }
    const m = Math.round(t.info.width * 0.04);
    await sharp(px, { raw: crudo.info }).extend({ top: m, bottom: m, left: m, right: m, background: '#ffffff' }).jpeg({ quality: 92 }).toFile(destino);
    return destino;
}

/**
 * Dónde empieza la cabeza y dónde está su centro, en una foto de estudio con
 * fondo claro. Se mira una miniatura: la primera franja de filas, en el centro
 * de la foto, donde aparecen píxeles que se separan del color del fondo.
 */
async function cabezaEn(rutaAbs) {
    const sharp = await sharpDe();
    const A = 300;
    const { data, info } = await sharp(rutaAbs).resize(A, A, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
    // Color del fondo: las dos esquinas de arriba (el estudio es parejo).
    const muestra = [];
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { muestra.push(px(x, y)); muestra.push(px(A - 1 - x, y)); }
    const fondo = [0, 1, 2].map(c => muestra.reduce((s, p) => s + p[c], 0) / muestra.length);
    // Solo fotos de ESTUDIO: fondo claro y frío (la cortina blanca de la
    // sesión). Una selfie en un auto o en un living (pasó con Onix carey y
    // Escarlata II oval) tiene el fondo oscuro o cálido y no se usa.
    const esquinas = [[0, 0], [A - 12, 0]].map(([x0]) => {
        const p = muestra.filter((_, i) => (x0 === 0 ? i % 2 === 0 : i % 2 === 1));
        return [0, 1, 2].map(c => p.reduce((s, q) => s + q[c], 0) / p.length);
    });
    if (esquinas.some(([r, g, b]) => Math.min(r, g, b) < 185 || b - r < -4)) return null;
    const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    const lumFondo = lum(fondo);
    const distinto = (p) => Math.hypot(p[0] - fondo[0], p[1] - fondo[1], p[2] - fondo[2]) > 48;
    // La coronilla es PELO: una mancha oscura y ancha. Los pliegues de la
    // cortina son líneas finas apenas más oscuras y confundían a una regla que
    // contaba píxeles sueltos (Onix negro salía con aire arriba de la cabeza).
    const oscuro = (p) => lum(p) < lumFondo - 55;
    const x0 = Math.round(A * 0.15), x1 = Math.round(A * 0.85);
    let arriba = null;
    let seguidas = 0;
    for (let y = 0; y < A; y++) {
        let tramo = 0, mayor = 0;
        for (let x = x0; x < x1; x++) { tramo = oscuro(px(x, y)) ? tramo + 1 : 0; mayor = Math.max(mayor, tramo); }
        seguidas = mayor > (x1 - x0) * 0.05 ? seguidas + 1 : 0;
        if (seguidas === 3) { arriba = y - 2; break; }
    }
    if (arriba === null) return null;
    // Centro y ancho de la cabeza en la franja que va de la coronilla hasta un
    // poco debajo de los ojos: el ancho mayor (de oreja a oreja, o de patilla a
    // patilla con los anteojos puestos) da la escala de la cara en ESA foto.
    let suma = 0, n = 0, ancho = 0;
    for (let y = arriba; y < Math.min(A, arriba + Math.round(A * 0.32)); y++) {
        let izq = null, der = null;
        for (let x = Math.round(A * 0.08); x < Math.round(A * 0.92); x++) {
            if (!distinto(px(x, y))) continue;
            suma += x; n++;
            if (izq === null) izq = x;
            der = x;
        }
        if (izq !== null) ancho = Math.max(ancho, der - izq);
    }
    return { arriba: arriba / A, centroX: n ? (suma / n) / A : 0.5, ancho: ancho / A };
}

/**
 * La foto del modelo puesto para una pieza de ancho×alto: la coronilla en el
 * borde de arriba ("donde empieza la cabeza empiece la foto") y el MENTÓN en la
 * altura `menton` (px desde arriba), para que la pera quede siempre entera por
 * encima del bloque de producto y precio ("no me gusta que le cortes la pera",
 * Ishtar 25/9/26). La escala sale de esas dos marcas, así que una foto de cerca
 * se achica y una de lejos se acerca (tope 1,35×).
 *
 * Si al achicarla no llega a cubrir el ancho o el alto, lo que falta se
 * completa con el color del fondo del estudio y el borde de la foto se funde
 * (sin corte recto). La luz se ajusta suave: niveles y un punto de brillo.
 * null si el modelo no tiene foto puesta de estudio usable.
 */
export async function fotoPuesta(slug, { ancho, alto, menton, cubrir = false }) {
    const sharp = await sharpDe();
    for (const n of [1, 2]) {
        const origen = path.join(PRODUCTOS, `${slug}-look-${n}.webp`);
        if (!existsSync(origen)) continue;
        const destino = path.join(CACHE, `${slug}-puesta-${n}-${ancho}x${alto}-${cubrir ? 'cubre' : `m${menton}`}.jpg`);
        if (existsSync(destino)) return destino;
        const meta = await sharp(origen).metadata();
        const W = meta.width, H = meta.height;
        if (!W || !H || W < 900) continue;
        const cabeza = await cabezaEn(origen);
        if (!cabeza) continue;

        const coronilla = cabeza.arriba * H - H * 0.01;
        // Mentón estimado: la cabeza mide ~1,35 veces su ancho; + un 5% del alto
        // para que entre la pera con un poco de cuello.
        const pera = cabeza.arriba * H + cabeza.ancho * W * 1.35 + H * 0.05;
        // cubrir: la foto llena toda la pieza desde la coronilla (la diapositiva
        // "bien limpia" del carrusel). Sin relleno: si se achicara para ubicar
        // la pera, quedaba un tercio vacío abajo y parecía una cabeza flotando.
        const escala = cubrir
            ? Math.max(alto / (H - coronilla), ancho / W)
            : Math.min(1.35, menton / (pera - coronilla));
        if (cubrir && pera > H * 0.99) continue; // la pera ya viene cortada en la foto original
        const w = Math.round(W * escala), h = Math.round(H * escala);
        const x = Math.round(ancho / 2 - cabeza.centroX * w);
        const y = -Math.round(coronilla * escala);

        // Foto escalada con la luz ajustada, en RGBA para poder fundir bordes.
        const foto = await sharp(origen).normalise({ lower: 1, upper: 99.5 })
            .modulate({ brightness: 1.04, saturation: 1.02 }).resize(w, h).ensureAlpha()
            .raw().toBuffer({ resolveWithObject: true });
        // Parte visible dentro de la pieza.
        const vx0 = Math.max(0, x), vy0 = Math.max(0, y);
        const vx1 = Math.min(ancho, x + w), vy1 = Math.min(alto, y + h);
        const vw = vx1 - vx0, vh = vy1 - vy0;
        const recorte = Buffer.alloc(vw * vh * 4);
        const F = 70; // ancho del fundido, en px
        for (let yy = 0; yy < vh; yy++) {
            for (let xx = 0; xx < vw; xx++) {
                const sx = vx0 - x + xx, sy = vy0 - y + yy;
                const si = (sy * w + sx) * 4, di = (yy * vw + xx) * 4;
                recorte[di] = foto.data[si]; recorte[di + 1] = foto.data[si + 1]; recorte[di + 2] = foto.data[si + 2];
                // Se funde solo el borde que queda ADENTRO de la pieza (si la
                // foto no llega al costado o al pie). El de arriba nunca: ahí
                // está la coronilla, pegada al borde a propósito.
                let a = 1;
                if (x > 0) a = Math.min(a, xx / F);
                if (x + w < ancho) a = Math.min(a, (vw - 1 - xx) / F);
                if (y + h < alto) a = Math.min(a, (vh - 1 - yy) / F);
                recorte[di + 3] = Math.round(255 * Math.max(0, Math.min(1, a)));
            }
        }
        // Fondo: el color del estudio (esquinas de arriba de la foto original).
        const { data: esq } = await sharp(origen).resize(20, 20, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const fondo = [0, 1, 2].map(c => Math.round((esq[c] + esq[(19) * 3 + c]) / 2));
        await sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: fondo[0], g: fondo[1], b: fondo[2] } } })
            .composite([{ input: recorte, raw: { width: vw, height: vh, channels: 4 }, left: vx0, top: vy0 }])
            .jpeg({ quality: 92 })
            .toFile(destino);
        return destino;
    }
    return null;
}
