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
 * Si el encuadre pedido se sale de la foto (poco aire arriba o a los
 * costados), primero se corre la ventana hacia adentro y, si la ventana es
 * más grande que la foto entera, lo que falta se completa con el borde
 * DESENFOCADO (la misma idea que el fondo de las stories): queda como fondo
 * fuera de foco. No con espejo: espejar una cara que está contra el borde
 * dejaba una segunda cara fantasma. Nunca se achica la cabeza para que entre.
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
export const ALTO_CARA = 0.40;
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

/**
 * La foto con sus bordes continuados hacia afuera, desenfocados. `falta` dice
 * cuántos píxeles agregar de cada lado; devuelve un Buffer con la foto derecha.
 */
async function extenderSuave(base, { W, H }, falta) {
    const foto = await base.toBuffer();
    if (!falta.left && !falta.top && !falta.right && !falta.bottom) return foto;
    const ancho = W + falta.left + falta.right, alto = H + falta.top + falta.bottom;
    const capas = [];
    const franja = (lado, tamano) => {
        if (!tamano) return;
        const grosor = Math.max(8, Math.round((lado === 'left' || lado === 'right' ? W : H) * 0.08));
        const recorte = lado === 'left' ? { left: 0, top: 0, width: grosor, height: H }
            : lado === 'right' ? { left: W - grosor, top: 0, width: grosor, height: H }
                : lado === 'top' ? { left: 0, top: 0, width: W, height: grosor }
                    : { left: 0, top: H - grosor, width: W, height: grosor };
        const medida = lado === 'left' || lado === 'right' ? { width: tamano, height: H } : { width: W, height: tamano };
        const posicion = lado === 'left' ? { left: 0, top: falta.top }
            : lado === 'right' ? { left: falta.left + W, top: falta.top }
                : lado === 'top' ? { left: falta.left, top: 0 }
                    : { left: falta.left, top: falta.top + H };
        capas.push((async () => ({
            input: await sharp(foto).extract(recorte).resize({ ...medida, fit: 'fill' }).blur(40).toBuffer(),
            ...posicion,
        }))());
    };
    franja('left', falta.left); franja('right', falta.right); franja('top', falta.top); franja('bottom', falta.bottom);
    const bordes = await Promise.all(capas);
    // Las esquinas quedan del color medio de la foto; las tapa el degradado o son fondo liso.
    const { dominant } = await sharp(foto).stats();
    return sharp({ create: { width: ancho, height: alto, channels: 3, background: dominant } })
        .composite([...bordes, { input: foto, left: falta.left, top: falta.top }])
        .jpeg({ quality: 95 }).toBuffer();
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
    // El corrimiento que hizo falta se informa para poder revisar esas fotos a mano.
    const base = sharp(archivo).rotate();
    const { W, H } = await dimensiones(base);
    const [, , cw, ch] = cara.caja;
    // De perfil, el tamaño sale de la foto de FRENTE del mismo modelo
    // (`referencia`): es la misma persona a la misma distancia de la cámara,
    // así que la cabeza mide lo mismo, y la caja de Vision de un perfil puro
    // (Atenea C3, a 90°) es tan chica que la corrección mediana la agrandaba
    // de más. Sin frente, vale la corrección mediana de la sesión.
    const altoCara = perfil && referencia ? referencia.caja[3] * H : ch * H * (perfil ? correccion : 1);
    const s = (ALTO_CARA * ALTO) / altoCara;                  // píxeles de placa por píxel de foto
    const wS = ANCHO / s, hS = ALTO / s;                      // la ventana, en píxeles de la foto
    const haciaLaNuca = perfil ? -Math.sign(cara.yaw || 1) * CORRIMIENTO_PERFIL * cw * W : 0;
    const cx = (cara.caja[0] + cw / 2) * W + haciaLaNuca;
    // Si la ventana se sale de la foto por un costado o por arriba, primero se
    // CORRE hacia adentro (la cabeza queda unos píxeles descentrada o más baja,
    // que no se nota) y solo se rellena con espejo cuando la ventana es más
    // grande que la foto entera. Rellenar con espejo donde hay una cara dejaba
    // una segunda cara fantasma en el borde (Andrómeda C7 de perfil, 16/10).
    const dentro = (v, tamanoVentana, tamanoFoto) =>
        tamanoVentana >= tamanoFoto ? v : Math.max(0, Math.min(tamanoFoto - tamanoVentana, v));
    let left = dentro(Math.round(cx - wS / 2), Math.round(wS), W);
    // De perfil con la ventana más ancha que la foto, todo lo que falta va del
    // lado de la NUCA (la foto queda pegada al borde del lado de la cara): el
    // fondo desenfocado detrás del pelo pasa desapercibido; delante de la cara
    // dejaba una mancha del color del armazón (Andrómeda C7, 16/10).
    if (perfil && wS > W) left = (cara.yaw || 0) > 0 ? Math.round(W - wS) : 0;
    const top = dentro(Math.round(cara.ojos[1] * H - (OJOS_Y * ALTO) / s), Math.round(hS), H);
    const falta = {
        left: Math.max(0, -left),
        top: Math.max(0, -top),
        right: Math.max(0, left + Math.round(wS) - W),
        bottom: Math.max(0, top + Math.round(hS) - H),
    };
    // En dos pasos a propósito: sharp aplica las operaciones en un orden fijo
    // (extract antes que extend, rotate antes que extract), no en el orden en
    // que se llaman. Primero la foto derecha y extendida, recién después el recorte.
    const pedidoLeft = Math.round(cx - wS / 2), pedidoTop = Math.round(cara.ojos[1] * H - (OJOS_Y * ALTO) / s);
    const corrido = { x: left - pedidoLeft, y: top - pedidoTop };
    if (Math.abs(corrido.x) > W * 0.02 || Math.abs(corrido.y) > H * 0.02) {
        console.log(`   ↔ ${path.basename(archivo)}: corrida ${Math.round(corrido.x / W * 100)} % en x, ${Math.round(corrido.y / H * 100)} % en y para no salirse de la foto`);
    }
    const extendida = await extenderSuave(base, { W, H }, falta);
    const img = sharp(extendida)
        .extract({ left: left + falta.left, top: top + falta.top, width: Math.round(wS), height: Math.round(hS) })
        .resize(ANCHO, ALTO);
    return retocar(img).jpeg({ quality: 90 }).toBuffer();
}
