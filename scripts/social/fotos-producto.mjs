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
 * La foto del modelo puesto, cortada desde la coronilla y centrada en la cara,
 * con el tamaño pedido. null si el modelo no tiene foto puesta usable.
 */
export async function fotoPuesta(slug, { ancho, alto }) {
    const sharp = await sharpDe();
    for (const n of [1, 2]) {
        const origen = path.join(PRODUCTOS, `${slug}-look-${n}.webp`);
        if (!existsSync(origen)) continue;
        const destino = path.join(CACHE, `${slug}-puesta-${n}-${ancho}x${alto}.jpg`);
        if (existsSync(destino)) return destino;
        const meta = await sharp(origen).metadata();
        const W = meta.width, H = meta.height;
        if (!W || !H || W < 900) continue;
        const cabeza = await cabezaEn(origen);
        if (!cabeza) continue;
        // "Donde empieza la cabeza empiece la foto": un margen mínimo (1%) para
        // no rozar el pelo, y nada de aire vacío arriba.
        const top = Math.max(0, Math.round(cabeza.arriba * H - H * 0.01));
        const aspecto = ancho / alto;
        // Encuadre según el tamaño de la cabeza EN ESTA FOTO: de la coronilla
        // hasta un poco debajo del mentón (cabeza ≈ 1,35 × su ancho; +20% para
        // que el mentón no quede pegado al borde). Así una foto de cerca no
        // queda cortada a la altura de los anteojos y una de lejos no deja
        // medio torso: se acerca. Nunca se agranda más de 1,6×.
        const deseada = cabeza.ancho * W * 1.35 * 1.2;
        let ch = Math.round(Math.min(Math.max(deseada, (ancho / 1.6) / aspecto), H - top, W / aspecto));
        let cw = Math.round(ch * aspecto);
        if (cw > W) { cw = W; ch = Math.round(W / aspecto); }
        const left = Math.min(Math.max(0, Math.round(cabeza.centroX * W - cw / 2)), W - cw);
        await sharp(origen)
            .extract({ left, top, width: cw, height: ch })
            .resize(ancho, alto)
            // Luz: niveles (estira el rango sin recortar extremos) y un toque de brillo.
            .normalise({ lower: 1, upper: 99.5 })
            .modulate({ brightness: 1.04, saturation: 1.02 })
            .jpeg({ quality: 92 })
            .toFile(destino);
        return destino;
    }
    return null;
}
