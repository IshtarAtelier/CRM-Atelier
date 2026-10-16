/**
 * Lo que comparten los carruseles del feed con fotos de modelo:
 * generar-feed-modelos.mjs (un modelo por día, frente + perfil) y
 * generar-carrusel-seleccion.mjs (varios modelos en una publicación: "todos
 * los Victoria", "los de acetato"). Las sesiones, dónde está cada foto, cuál es
 * el frente y cuál el perfil, la detección de caras y la placa de cada slide.
 *
 * Las fotos fuente NO viven en el repo: la carpeta de Agos y la de originales
 * de Massaru se pasan con `--fotos-agos` / `--fotos-massaru` o se toman del
 * escritorio de Ishtar.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderizarPlacaFeed } from './placa-story-modelo.mjs';
import { MODELOS as AGOS, RECETA, SOL, CLIP } from './modelos-agostina.mjs';
import { MODELOS as MASSARU } from './modelos-massaru.mjs';
import { TEXTO_CUOTAS_POR_DEFECTO, textoCuotasLargasSinPrecio } from './condiciones-pago.mjs';
import { detectarCaras, correccionPerfil, recortarAlineado } from './alinear-cara.mjs';
import { retoque, retoqueCalido } from './retoque-foto.mjs';

export { RECETA, SOL, CLIP };
export const LEYENDA = { [RECETA]: 'Armazón de receta', [SOL]: 'Lentes de sol', [CLIP]: 'Clip-on · receta + sol' };
export const CONDICIONES = `${TEXTO_CUOTAS_POR_DEFECTO} o ${textoCuotasLargasSinPrecio()}. Envío sin cargo.`;
export const OPCIONES_FOTOS = ['--fotos-agos', '--fotos-massaru'];

const ESCRITORIO = path.join(os.homedir(), 'Desktop', 'Pagina web atelier');

/**
 * Qué foto es el frente y cuál el perfil en cada lista: receta y sol de Agos
 * van [frente, perfil, manos]; clip-on [sin clip, frente, perfil, manos] (el
 * frente CON clip, que es el que muestra el producto); Massaru [frente, perfil].
 */
function frenteYPerfil(familia, numeros) {
    if (familia === CLIP) return numeros.length >= 3 ? [numeros[1], numeros[2]] : null;
    if (numeros.length === 1) return [numeros[0]];   // solo frente (Andrómeda C7: el perfil no circula)
    return numeros.length >= 2 ? [numeros[0], numeros[1]] : null;
}

/**
 * Las dos sesiones con sus piezas resueltas: cada pieza trae
 * { piezaId, slug, nombre, color, familia, fotos: [frente, perfil?] } (un
 * modelo puede tener solo el frente) y la
 * sesión, las caras detectadas y la corrección de perfil. `args` son los
 * argumentos de la línea de comandos (para --fotos-agos / --fotos-massaru).
 */
export function cargarSesiones(args) {
    const valor = (op) => (args.includes(op) ? args[args.indexOf(op) + 1] : null);
    const FOTOS_AGOS = valor('--fotos-agos') || path.join(ESCRITORIO, 'Fotos-Agos-Gutierrez-2026');
    const FOTOS_MASSARU = valor('--fotos-massaru') || path.join(ESCRITORIO, 'Contenido de Atelier', 'Sesión Massaru - oct 2026 (originales)');
    for (const [c, op] of [[FOTOS_AGOS, '--fotos-agos'], [FOTOS_MASSARU, '--fotos-massaru']]) {
        if (!existsSync(c)) { console.error(`No encuentro la carpeta de fotos: ${c} (pasarla con ${op}).`); process.exit(1); }
    }
    const archivosAgos = readdirSync(FOTOS_AGOS);
    const fotoAgos = (numero) => {
        const f = archivosAgos.find(a => a.startsWith(`${numero} - `) && /\.jpe?g$/i.test(a));
        return f ? path.join(FOTOS_AGOS, f) : null;
    };
    const fotoMassaru = (numero) => {
        const f = path.join(FOTOS_MASSARU, `26.1 -${numero}.jpg`);
        return existsSync(f) ? f : null;
    };
    const sesiones = [
        { nombre: 'agos', pilar: 'agostina', fuente: 'fotos-agostina', marca: 'Cápsula Escarlata', modelos: AGOS, foto: fotoAgos, retocar: retoque },
        { nombre: 'massaru', pilar: 'massaru', fuente: 'fotos-massaru', marca: 'Atelier Óptica', modelos: MASSARU, foto: fotoMassaru, retocar: retoqueCalido },
    ];
    const salteados = [];
    for (const sesion of sesiones) {
        sesion.piezas = [];
        for (const [slug, nombre, color, familia, numeros] of sesion.modelos) {
            const piezaId = `feed-${sesion.nombre}-${slug}`;
            const par = frenteYPerfil(familia, numeros);
            if (!par) { salteados.push(`${piezaId}: no tiene frente ni perfil`); continue; }
            const fotos = par.map(sesion.foto);
            if (fotos.some(f => !f)) { salteados.push(`${piezaId}: falta la foto ${par[fotos.indexOf(null)]} en la carpeta de la sesión`); continue; }
            sesion.piezas.push({ piezaId, slug, nombre, color, familia, fotos });
        }
        // Las caras de TODAS: la corrección de perfil se mide sobre la sesión
        // entera, aunque después se rendericen dos modelos.
        const caras = detectarCaras(sesion.piezas.flatMap(p => p.fotos));
        sesion.correccion = correccionPerfil(sesion.piezas.map(p => p.fotos), caras);
        sesion.piezas = sesion.piezas.filter(p => {
            const sinCara = p.fotos.find(f => !caras[f]);
            if (sinCara) salteados.push(`${p.piezaId}: Vision no encontró la cara en ${path.basename(sinCara)}`);
            return !sinCara;
        });
        sesion.caras = caras;
        console.log(`${sesion.nombre}: ${sesion.piezas.length} modelos con las dos fotos · corrección de perfil ×${sesion.correccion.toFixed(2)}`);
    }
    return { sesiones, salteados };
}

export const titulo = (p) => `${p.nombre}${p.color ? ' ' + p.color : ''}`;
export const alt = (p, role, marca) => `${titulo(p)}, ${LEYENDA[p.familia].toLowerCase()}, de ${role} · ${marca}`;

/** Una slide: la foto alineada + la placa, escrita en `destino`. role = 'frente' | 'perfil'. */
export const rolesDe = (pieza) => pieza.fotos.length > 1 ? ['frente', 'perfil'] : ['frente'];

export async function renderizarSlide(page, identidad, sesion, pieza, role, destino) {
    const i = role === 'perfil' ? 1 : 0;
    const archivo = pieza.fotos[i];
    if (!archivo) throw new Error(`${pieza.piezaId} no tiene foto de ${role}`);
    const fotoJpg = await recortarAlineado(archivo, sesion.caras[archivo], {
        perfil: i === 1, correccion: sesion.correccion, retocar: sesion.retocar,
        referencia: i === 1 ? sesion.caras[pieza.fotos[0]] : null,   // el frente del mismo modelo fija el tamaño
    });
    await renderizarPlacaFeed(page, {
        id: identidad.id, logo: identidad.logo, fotoJpg,
        leyenda: LEYENDA[pieza.familia], nombre: pieza.nombre, color: pieza.color, destino,
    });
}

export function cargarLogo(id) {
    return 'data:image/png;base64,' + readFileSync(id.logo).toString('base64');
}
