/**
 * Identidad de marca para las piezas de redes.
 *
 * Los colores NO se escriben acá: se LEEN de `src/app/globals.css`, que es donde
 * ya viven para toda la web y el CRM. Una sola fuente de verdad.
 *
 * Por qué importa: el día que se ajuste el bronce de la marca, las piezas nuevas
 * salen con el color nuevo sin que nadie se acuerde de tocar dos archivos. Si
 * acá hubiera un `#9e7f65` escrito a mano, en seis meses estaría desactualizado
 * y nadie sabría por qué las piezas no matchean con el sitio.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..');

const GLOBALS_CSS = path.join(RAIZ, 'src', 'app', 'globals.css');

/**
 * Lee una variable CSS del PRIMER bloque `:root` (el tema claro).
 *
 * Se aísla el bloque de verdad en vez de cortar el archivo por `.dark`: en
 * globals.css la línea 4 es `@custom-variant dark (...)`, o sea que la palabra
 * ".dark" aparece ANTES del primer `:root` y cortar por ahí dejaba el bloque
 * entero afuera. Lo detecté porque la guarda de abajo dijo que no encontraba
 * ningún color.
 */
function leerVariable(css, nombre) {
    const inicio = css.indexOf(':root');
    if (inicio === -1) return null;
    const abre = css.indexOf('{', inicio);
    const cierra = css.indexOf('}', abre);
    if (abre === -1 || cierra === -1) return null;

    const bloque = css.slice(abre, cierra);
    const m = bloque.match(new RegExp(`--${nombre}\\s*:\\s*([^;]+);`));
    return m ? m[1].trim() : null;
}

/**
 * Lee una variable del bloque `.dark` (el tema oscuro).
 *
 * Se busca con regex de inicio de línea y no con `indexOf('.dark')` por el mismo
 * pozo de arriba: la línea 4 de globals.css es `@custom-variant dark (&:where(.dark, ...))`
 * y cortar por ahí devolvía basura.
 *
 * Hace falta para las piezas impresas: sobre fondo oscuro el bronce del tema
 * claro (#9e7f65) queda en 4,3:1 y el del tema oscuro pasa de 9:1.
 */
function leerVariableOscura(css, nombre) {
    const m0 = css.match(/^\s*\.dark\s*\{/m);
    if (!m0) return null;
    const abre = css.indexOf('{', m0.index);
    const cierra = css.indexOf('}', abre);
    if (abre === -1 || cierra === -1) return null;

    const m = css.slice(abre, cierra).match(new RegExp(`--${nombre}\\s*:\\s*([^;]+);`));
    return m ? m[1].trim().split(/\s*\/\*/)[0].trim() : null;
}

export async function cargarIdentidad() {
    const css = await readFile(GLOBALS_CSS, 'utf-8');

    const colores = {
        fondo: leerVariable(css, 'background'),
        texto: leerVariable(css, 'foreground'),
        marca: leerVariable(css, 'primary'),
        sobreMarca: leerVariable(css, 'primary-foreground'),
        // El bronce claro del tema oscuro. Lo usan las piezas impresas sobre
        // fondo oscuro; las de redes siguen usando `marca`.
        marcaClara: leerVariableOscura(css, 'primary'),
        fondoOscuro: leerVariableOscura(css, 'background'),
    };

    const faltantes = Object.entries(colores).filter(([, v]) => !v).map(([k]) => k);
    if (faltantes.length) {
        throw new Error(
            `No se pudieron leer estos colores de globals.css: ${faltantes.join(', ')}. ` +
            `Si se renombraron las variables CSS, actualizar scripts/social/identidad.mjs.`
        );
    }

    return {
        colores,
        // Oscuro propio para las piezas: el --background del sitio es casi blanco
        // y en el feed de Instagram una pieza clara se pierde entre las demás.
        oscuro: '#2a211c',
        fuentes: {
            // Geist es la del sitio (layout.tsx). Se carga de Google Fonts en el
            // HTML del render; si no hay internet, cae a la del sistema.
            titulo: "'Geist', -apple-system, 'Helvetica Neue', sans-serif",
            texto: "'Geist', -apple-system, 'Helvetica Neue', sans-serif",
        },
        googleFonts: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;700;900&display=swap',
        logo: path.join(RAIZ, 'public', 'assets', 'logo-atelier-optica.png'),
        handle: '@atelieroptica',
        // Formato por defecto: 4:5 es el que más pantalla ocupa en el feed.
        // Una pieza puede pedir otro con su campo `format` (ver FORMATOS).
        formato: FORMATOS['4:5'],
    };
}

/**
 * Los formatos que sabemos renderizar.
 *
 * `9:16` se agregó para las stories, que son otro producto: duran 24 horas, se
 * ven a pantalla completa y nadie las lee con detenimiento. Por eso llevan una
 * sola idea por placa y texto grande — el carrusel del feed explica, la story
 * avisa.
 */
export const FORMATOS = {
    '4:5': { nombre: '4:5', ancho: 1080, alto: 1350 },
    '9:16': { nombre: '9:16', ancho: 1080, alto: 1920 },
};

/**
 * El formato que pide la pieza, o el 4:5 por defecto.
 * Falla fuerte con un formato desconocido: mejor que renderizar 1080x1350 en
 * silencio y descubrirlo cuando la story ya salió cortada.
 */
export function formatoDePieza(pieza) {
    const pedido = pieza?.format;
    if (!pedido) return FORMATOS['4:5'];
    const f = FORMATOS[pedido];
    if (!f) {
        throw new Error(
            `Formato desconocido: "${pedido}". Los que existen: ${Object.keys(FORMATOS).join(', ')}.`
        );
    }
    return f;
}

/** Para inspeccionar rápido: `node scripts/social/identidad.mjs` */
if (import.meta.url === `file://${process.argv[1]}`) {
    const id = await cargarIdentidad();
    console.log('Identidad leída de globals.css:\n');
    console.log('  colores :', JSON.stringify(id.colores));
    console.log('  oscuro  :', id.oscuro);
    console.log('  formato :', `${id.formato.nombre} (${id.formato.ancho}x${id.formato.alto})`);
    console.log('  logo    :', id.logo.replace(RAIZ, '.'));
}
