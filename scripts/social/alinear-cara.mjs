/**
 * Recorte 4:5 con la cabeza SIEMPRE en el mismo lugar y del mismo tamaño.
 *
 * Ishtar, 16/10/2026, viendo las primeras placas del feed: "que la cabeza de
 * todos esté perfectamente a la misma altura, en el feed se nota mucho". En
 * una grilla de feed las placas quedan una al lado de la otra, y una cabeza
 * dos dedos más arriba o un 10 % más grande se ve enseguida. Así que acá no se
 * recorta "desde el pelo" como en las stories: se detecta la cara con Vision
 * (macOS, `caras.swift`) y se escala y se corre la foto para que la LÍNEA DE
 * LOS OJOS caiga en `OJOS_Y` del alto y la cara mida `ALTO_CARA` del alto, en
 * todas las fotos, de frente o de perfil.
 *
 * De perfil Vision devuelve una caja más chica que de frente para la misma
 * cabeza (no ve la otra mitad). Para que el perfil no salga más grande, el
 * tamaño del perfil se toma de la foto de frente del mismo modelo (misma
 * persona, misma distancia); si no hay frente, se corrige por la relación
 * mediana frente/perfil de la sesión (`correccionPerfil`).
 *
 * La ventana NUNCA se sale de la foto (Ishtar, 19/10/2026: "que no tengan
 * ningún recuadro raro": el relleno desenfocado del borde se veía en el feed).
 * Si a la escala pedida la ventana no entra, la escala sube lo justo para que
 * entre (la cabeza queda apenas más grande en esa foto) y después la ventana
 * se corre hacia adentro. Nunca se agrega borde, ni espejado ni desenfocado.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sharp = createRequire(import.meta.url)('sharp');

export const ANCHO = 1080, ALTO = 1350;
/** Dónde cae la línea de los ojos, en fracción del alto de la placa. */
export const OJOS_Y = 0.40;
/** Cuánto mide la cara (la caja de Vision), en fracción del alto de la placa. */
export const ALTO_CARA = 0.50;
/** De perfil, cuánto se corre el centro hacia la nuca, en anchos de cara. */
const CORRIMIENTO_PERFIL = 0.12;

/** Compila caras.swift una sola vez (queda en la carpeta temporal del sistema). */
function binario() {
    const src = path.join(path.dirname(fileURLToPath(import.meta.url)), 'caras.swift');
    const bin = path.join(os.tmpdir(), 'atelier-caras');
    if (!existsSync(bin) || statSync(bin).mtimeMs < statSync(src).mtimeMs) {
        console.log('Compilando el detector de caras (una sola vez)…');
        execFileSync('swiftc', ['-O', '-o', bin, src], { stdio: ['ignore', 'ignore', 'inherit'] });
    }
    return bin;
}

/** { ruta → { caja: [x, y, w, h], ojos: [x, y], yaw } | null } en fracciones de la imagen derecha. */
export function detectarCaras(rutas) {
    const bin = binario();
    const salida = {};
    // De a tandas: la línea de comandos tiene tope y Vision carga cada foto entera.
    for (let i = 0; i < rutas.length; i += 40) {
        const tanda = rutas.slice(i, i + 40);
        const json = execFileSync(bin, tanda, { maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
        Object.assign(salida, JSON.parse(json.toString('utf-8')));
    }
    return salida;
}

/** Mediana de alto de cara frente ÷ perfil sobre los pares que tienen las dos. */
export function correccionPerfil(pares, caras) {
    const r = pares
        .map(([f, p]) => caras[f] && caras[p] ? caras[f].caja[3] / caras[p].caja[3] : null)
        .filter(Boolean).sort((a, b) => a - b);
    return r.length ? r[Math.floor(r.length / 2)] : 1;
}

async function dimensiones(base) {
    const m = await base.metadata();
    const girada = (m.orientation ?? 1) >= 5;
    return { W: girada ? m.height : m.width, H: girada ? m.width : m.height };
}

/**
 * La foto recortada a ANCHO×ALTO con la cara en su lugar. `cara` es la
 * detección de esa foto; `perfil` dice si hay que corregir la caja y correr el
 * centro hacia la nuca; `retocar(img)` se aplica sobre el recorte final.
 */
export async function recortarAlineado(archivo, cara, { perfil = false, correccion = 1, referencia = null, retocar = (x) => x } = {}) {
    if (!cara) throw new Error(`Sin cara detectada en ${archivo}`);
    const base = sharp(archivo).rotate();
    const { W, H } = await dimensiones(base);
    const [, , cw, ch] = cara.caja;
    // De perfil, el tamaño sale de la foto de FRENTE del mismo modelo
    // (`referencia`): es la misma persona a la misma distancia de la cámara,
    // así que la cabeza mide lo mismo, y la caja de Vision de un perfil puro
    // (Atenea C3, a 90°) es tan chica que la corrección mediana la agrandaba
    // de más. Sin frente, vale la corrección mediana de la sesión.
    const altoCara = perfil && referencia ? referencia.caja[3] * H : ch * H * (perfil ? correccion : 1);
    // Escala pedida, y si con ella la ventana no entra en la foto, la mínima que entra.
    const sPedida = (ALTO_CARA * ALTO) / altoCara;
    const s = Math.max(sPedida, ANCHO / W, ALTO / H);
    if (s > sPedida * 1.03) console.log(`   🔍 ${path.basename(archivo)}: cabeza ${Math.round((s / sPedida - 1) * 100)} % más grande para que la ventana entre en la foto`);
    const wS = Math.min(W, Math.round(ANCHO / s)), hS = Math.min(H, Math.round(ALTO / s));
    const haciaLaNuca = perfil ? -Math.sign(cara.yaw || 1) * CORRIMIENTO_PERFIL * cw * W : 0;
    const cx = (cara.caja[0] + cw / 2) * W + haciaLaNuca;
    const dentro = (v, tamanoVentana, tamanoFoto) => Math.max(0, Math.min(tamanoFoto - tamanoVentana, v));
    const pedidoLeft = Math.round(cx - wS / 2), pedidoTop = Math.round(cara.ojos[1] * H - (OJOS_Y * ALTO) / s);
    const left = dentro(pedidoLeft, wS, W), top = dentro(pedidoTop, hS, H);
    const corrido = { x: left - pedidoLeft, y: top - pedidoTop };
    if (Math.abs(corrido.x) > W * 0.02 || Math.abs(corrido.y) > H * 0.02) {
        console.log(`   ↔ ${path.basename(archivo)}: corrida ${Math.round(corrido.x / W * 100)} % en x, ${Math.round(corrido.y / H * 100)} % en y para no salirse de la foto`);
    }
    // En dos pasos a propósito: sharp aplica rotate antes que extract, no en el
    // orden en que se llaman; primero la foto derecha, después el recorte.
    const derecha = await base.toBuffer();
    const img = sharp(derecha).extract({ left, top, width: wS, height: hS }).resize(ANCHO, ALTO);
    return retocar(img).jpeg({ quality: 90 }).toBuffer();
}
