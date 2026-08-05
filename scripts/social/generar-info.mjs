/**
 * Genera las piezas de "dónde estamos" y "horarios" leyendo los datos del
 * negocio de `src/lib/business-info.ts`.
 *
 *   node scripts/social/generar-info.mjs            → las dos
 *   node scripts/social/generar-info.mjs ubicacion  → solo una
 *
 * POR QUÉ NO SE ESCRIBEN A MANO, que es la única decisión importante de acá:
 *
 * `business-info.ts` tiene esta advertencia escrita en el propio archivo:
 *
 *   "Existe para que ese bloque no se vuelva a copiar a mano: ya pasó que
 *    quedara desactualizado en un lugar y el bot mandara horarios inventados."
 *
 * Una placa de horarios publicada es peor que un mensaje del bot: queda fija en
 * el perfil, la gente la guarda, y nadie se acuerda de que existe el día que se
 * cambia un horario. Generarla desde la fuente hace que la próxima salga bien
 * sola; copiarla a mano hace que quede mal para siempre.
 *
 * Es la misma lógica que `generar-producto.mjs` con los precios (regla R6) y
 * que `identidad.mjs` con los colores de globals.css.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './identidad.mjs';

const BUSINESS_INFO_TS = path.join(RAIZ, 'src', 'lib', 'business-info.ts');
const SALIDA = path.join(RAIZ, 'social', 'contenido');

/**
 * Lee un campo string de BUSINESS_INFO.
 *
 * Se parsea el .ts con regex en vez de importarlo porque es TypeScript y estos
 * scripts son .mjs sin build. Mismo enfoque que identidad.mjs con globals.css.
 * Si el campo no está, se corta: es preferible a publicar una placa a medias.
 */
function leerCampo(ts, campo) {
    const m = ts.match(new RegExp(`\\b${campo}:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
    if (!m) {
        throw new Error(
            `No se pudo leer "${campo}" de business-info.ts. ` +
            `Si se renombró el campo, actualizar scripts/social/generar-info.mjs.`
        );
    }
    return m[1].replace(/\\n/g, '\n');
}

/** Los horarios en dos líneas, tal como se muestran. */
function horariosEnLineas(ts) {
    const spec = [];
    const bloque = ts.slice(ts.indexOf('openingHoursSpecification'));
    const re = /dayOfWeek:\s*\[([^\]]+)\][\s\S]{0,80}?opens:\s*"([^"]+)"[\s\S]{0,40}?closes:\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(bloque)) !== null) {
        const dias = m[1].match(/"([A-Za-z]+)"/g)?.map(d => d.replace(/"/g, '')) || [];
        spec.push({ dias, abre: m[2], cierra: m[3] });
        if (spec.length >= 4) break;
    }
    if (!spec.length) throw new Error('No se pudo leer openingHoursSpecification de business-info.ts.');

    const ES = {
        Monday: 'lunes', Tuesday: 'martes', Wednesday: 'miércoles',
        Thursday: 'jueves', Friday: 'viernes', Saturday: 'sábados', Sunday: 'domingos',
    };
    // "08:00" se lee mejor como "8" en una placa; "09:30" se deja completo.
    const hora = (h) => h.endsWith(':00') ? String(Number(h.slice(0, 2))) : h;

    return spec.map(({ dias, abre, cierra }) => {
        const nombres = dias.map(d => ES[d] || d);
        const rango = nombres.length > 1
            ? `${nombres[0]} a ${nombres[nombres.length - 1]}`
            : nombres[0];
        return `${rango[0].toUpperCase()}${rango.slice(1)} de ${hora(abre)} a ${hora(cierra)}`;
    });
}

function piezaUbicacion(info) {
    const [calle, barrio] = info.address.split(',').map(s => s.trim());
    return {
        id: 'donde-estamos',
        format: '9:16',
        theme: 'dark',
        pilar: 'accion',
        fuente: 'business-info',
        caption: `Estamos en ${info.address}. Sin turno previo.`,
        slides: [
            {
                type: 'cover',
                role: 'portada',
                image: 'blog/fachada-ladrillo.jpg',
                title: `Estamos en *${calle}*`,
                subtitle: `${barrio}. Sin turno previo: entrás y te atendemos.`,
            },
        ],
    };
}

function piezaHorarios(info, lineas) {
    return {
        id: 'horarios',
        format: '9:16',
        theme: 'dark',
        pilar: 'accion',
        fuente: 'business-info',
        caption: `${info.hours}. ${info.address}.`,
        slides: [
            {
                type: 'cta',
                role: 'portada',
                image: 'blog/vidriera-atelier.jpg',
                title: 'Cuándo estamos abiertos',
                body: `${lineas.join('\n')}\n\n${info.address}`,
            },
        ],
    };
}

export async function generarInfo(cuales = ['ubicacion', 'horarios']) {
    const ts = await readFile(BUSINESS_INFO_TS, 'utf-8');
    const info = {
        address: leerCampo(ts, 'address'),
        hours: leerCampo(ts, 'hours'),
        phone: leerCampo(ts, 'phone'),
    };
    const lineas = horariosEnLineas(ts);

    console.log('\nDatos leídos de business-info.ts (fuente única):');
    console.log(`  dirección : ${info.address}`);
    lineas.forEach(l => console.log(`  horario   : ${l}`));

    const generadas = [];
    for (const cual of cuales) {
        const pieza = cual === 'ubicacion' ? piezaUbicacion(info) : piezaHorarios(info, lineas);
        const destino = path.join(SALIDA, `${pieza.id}.json`);
        await writeFile(destino, JSON.stringify(pieza, null, 2) + '\n', 'utf-8');
        console.log(`\n✅ ${path.relative(RAIZ, destino)}`);
        generadas.push(destino);
    }

    console.log('\nRenderizar con:');
    generadas.forEach(g => console.log(`  node scripts/social/render.mjs ${path.relative(RAIZ, g)}`));
    return generadas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
    const validos = ['ubicacion', 'horarios'];
    const pedidas = args.length ? args : validos;
    const malas = pedidas.filter(p => !validos.includes(p));
    if (malas.length) {
        console.error(`No conozco: ${malas.join(', ')}. Las que hay: ${validos.join(', ')}.`);
        process.exit(1);
    }
    try {
        await generarInfo(pedidas);
    } catch (e) {
        console.error(`\n❌ ${e.message}`);
        process.exit(1);
    }
}
