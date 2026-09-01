#!/usr/bin/env node --experimental-strip-types
/**
 * ¿Lo que está programado en redes va a poder salir?  `npm run check:social`
 *
 * Solo LEE archivos del repo — ninguna base, ninguna red.
 *
 * Contesta lo que nadie mira hasta que ya pasó:
 *   1. ¿Existe el archivo de cada pieza y de cada reel programado? Un id mal
 *      escrito en el JSON no se nota hasta el día que le toca salir.
 *   2. ¿Lo que sale en los próximos días puede salir, con los precios de hoy?
 *   3. ¿La regeneración de los viernes sigue corriendo? Es la que mantiene
 *      frescos los precios de acá a octubre; si se cayó, lo de más adelante
 *      está condenado aunque hoy se vea bien.
 *   4. ¿Cuántos días de programación quedan por delante?
 *   5. ¿El número de reseñas que declaran las piezas sigue siendo verdad?
 *      Falla si alguna dice MÁS que el real conocido (inflar jamás) o quedó a
 *      más de 25 del real; avisa si el dato conocido en sí está viejo (el
 *      refresco de los viernes no corrió, o el endpoint no respondió).
 *      El dato real vive en social/resenas.json (ver scripts/social/resenas.mjs).
 *
 * La regla de vencimiento no se reescribe acá: sale del mismo helper que usa el
 * mail diario (`src/lib/social/salud-programacion.ts`), que a su vez usa la
 * misma guarda que corre el día D. Si divergieran, este chequeo daría verde
 * mientras la publicación falla — que es justo el modo de fallar a eliminar.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    evaluarSaludProgramacion,
    diasEntre,
    DIAS_COBERTURA_MINIMA,
} from '../../src/lib/social/salud-programacion.ts';
import {
    leerResenasConocidas,
    resolverTextoResenas,
    redondearParaPublicar,
    SUFIJO_PLANTILLA,
    UMBRAL_DESACTUALIZADO,
} from '../social/resenas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const rojo = (t) => `\x1b[31m${t}\x1b[0m`;
const verde = (t) => `\x1b[32m${t}\x1b[0m`;
const amarillo = (t) => `\x1b[33m${t}\x1b[0m`;
const gris = (t) => `\x1b[90m${t}\x1b[0m`;
const diaDe = (fecha) => DIAS[new Date(`${fecha}T12:00:00Z`).getUTCDay()];

/** Sin el JPEG del carrusel o el mp4 del reel no hay nada que publicar. */
function archivosFaltantes(programacion, hoy) {
    const faltan = [];
    for (const e of programacion.filter(x => x.fecha >= hoy)) {
        if (e.reel) {
            if (!existsSync(path.join(RAIZ, 'public', 'social', 'reels', `${e.reel}.mp4`))) {
                faltan.push({ fecha: e.fecha, id: e.reel, que: 'no existe el .mp4' });
            }
            continue;
        }
        const dir = path.join(RAIZ, 'public', 'social', e.pieza);
        if (!existsSync(dir)) {
            faltan.push({ fecha: e.fecha, id: e.pieza, que: 'no existe la carpeta en public/social' });
        } else if (!readdirSync(dir).some(f => f.endsWith('.jpg'))) {
            faltan.push({ fecha: e.fecha, id: e.pieza, que: 'la carpeta no tiene ningún JPEG' });
        }
    }
    return faltan;
}

/**
 * El número de reseñas que declara cada pieza, contra el real conocido.
 *
 * Sin red, a propósito (es el contrato de este check): el "real" es el último
 * dato que trajo `actualizar-resenas.mjs` a social/resenas.json. Si ESE dato
 * está viejo, acá se avisa — es la señal de que el refresco de los viernes se
 * cayó o el endpoint no respondió, y de que los números publicados pueden
 * estar quedándose atrás sin que nadie lo vea.
 */
function verificarResenas(datos, hoy) {
    const errores = [];
    const avisos = [];
    const dirContenido = path.join(RAIZ, 'social', 'contenido');

    if (!datos) {
        errores.push({ pieza: 'social/resenas.json', que: 'no existe o es ilegible — correr node scripts/social/actualizar-resenas.mjs' });
        return { errores, avisos };
    }

    const diasViejo = diasEntre(datos.actualizado, hoy);
    if (diasViejo > 9) {
        avisos.push(
            `El número de reseñas conocido (${datos.total}) es del ${datos.actualizado}, hace ${diasViejo} días. ` +
            `El refresco de los viernes no está corriendo o el endpoint no respondió.`
        );
    }

    // Un número pegado a "reseñas" se revisa siempre; "más de N" y "N gracias"
    // solo si la pieza habla de reseñas/Google (para no acusar un "más de 100
    // obras de arte"). Los campos _plantilla no se miran: no traen números,
    // traen {{RESENAS}} — lo que se revisa es lo que quedó horneado.
    const PATRON_DIRECTO = /(\d{3,5})\s+(?:reseñas?|resenas?|opiniones)\b/gi;
    const PATRONES_CONTEXTO = [/(?:más|mas)\s+de\s+(\d{3,5})\b/gi, /(\d{3,5})\s+gracias\b/gi];

    for (const nombre of readdirSync(dirContenido).filter(f => f.endsWith('.json')).sort()) {
        let pieza;
        try { pieza = JSON.parse(readFileSync(path.join(dirContenido, nombre), 'utf-8')); }
        catch { errores.push({ pieza: nombre, que: 'JSON ilegible' }); continue; }

        const planos = [];      // [clave, texto] de todo campo string que se publica
        const plantillas = [];  // [claveDelCampo, plantilla, valorHorneado]
        (function recorrer(nodo) {
            if (Array.isArray(nodo)) return nodo.forEach(recorrer);
            if (!nodo || typeof nodo !== 'object') return;
            for (const [k, v] of Object.entries(nodo)) {
                if (typeof v === 'string') {
                    if (k.endsWith(SUFIJO_PLANTILLA)) {
                        const campo = k.slice(0, -SUFIJO_PLANTILLA.length);
                        plantillas.push([campo, v, nodo[campo]]);
                    } else {
                        planos.push([k, v]);
                    }
                } else recorrer(v);
            }
        })(pieza);

        // ¿Lo horneado coincide con lo que la plantilla resolvería HOY?
        for (const [campo, plantilla, horneado] of plantillas) {
            let esperado;
            try { esperado = resolverTextoResenas(plantilla, datos); }
            catch (e) { errores.push({ pieza: nombre, que: e.message }); continue; }
            if (horneado !== esperado) {
                errores.push({
                    pieza: nombre,
                    que: `\`${campo}\` quedó atrás de su plantilla — correr node scripts/social/actualizar-resenas.mjs`,
                });
            }
        }

        const textoEntero = planos.map(([, v]) => v).join(' ');
        const hablaDeResenas = /reseñ|resena|opinione|calificaci|google/i.test(textoEntero);

        for (const [clave, texto] of planos) {
            // Un placeholder fuera del mecanismo: el cron publicaría "{{RESENAS}}" literal.
            if (/\{\{[A-ZÁÉÍÓÚÑ_]+\}\}/.test(texto)) {
                errores.push({
                    pieza: nombre,
                    que: `\`${clave}\` tiene un placeholder sin resolver — el texto va en \`${clave}${SUFIJO_PLANTILLA}\` y se hornea con actualizar-resenas.mjs`,
                });
                continue;
            }
            const patrones = hablaDeResenas ? [PATRON_DIRECTO, ...PATRONES_CONTEXTO] : [PATRON_DIRECTO];
            for (const patron of patrones) {
                for (const m of texto.matchAll(patron)) {
                    const declarado = Number(m[1]);
                    if (declarado > datos.total) {
                        errores.push({
                            pieza: nombre,
                            que: `dice "${m[0].trim()}" y las reseñas reales conocidas son ${datos.total} — el número jamás se infla`,
                        });
                    } else if (datos.total - declarado > UMBRAL_DESACTUALIZADO) {
                        errores.push({
                            pieza: nombre,
                            que: `dice "${m[0].trim()}" con ${datos.total} reales (${datos.total - declarado} de atraso, tope ${UMBRAL_DESACTUALIZADO}) — declararlo por {{RESENAS}} en \`${clave}${SUFIJO_PLANTILLA}\``,
                        });
                    }
                }
            }
        }
    }
    return { errores, avisos };
}

const salud = await evaluarSaludProgramacion();
const { programacion } = JSON.parse(
    await readFile(path.join(RAIZ, 'social', 'feed-programacion.json'), 'utf-8'),
);
const faltantes = archivosFaltantes(programacion, salud.hoy);
const datosResenas = await leerResenasConocidas();
const resenas = verificarResenas(datosResenas, salud.hoy);

console.log(`\n  Programación de redes — ${salud.hoy}\n`);
console.log(`  Feed:    ${salud.entradasFuturas} entradas por delante, hasta el ${salud.ultimaFecha || '—'}` +
    gris(`  (${salud.diasDeCobertura} días)`));
console.log(`  Precios: ${salud.piezasConPrecio} piezas con precio, regeneradas el ${salud.ultimaRegeneracion || '—'}` +
    gris(`  (hace ${salud.diasDesdeRegeneracion ?? '—'} días)`));
if (datosResenas) {
    console.log(`  Reseñas: ${datosResenas.total} reales en Google al ${datosResenas.actualizado}` +
        gris(`  (se publica "más de ${redondearParaPublicar(datosResenas.total)}")`));
}

if (salud.diasDeCobertura < DIAS_COBERTURA_MINIMA) {
    console.log(amarillo(`\n  ⚠ Quedan menos de ${DIAS_COBERTURA_MINIMA} días de programación: hay que cargar más fechas.`));
}

if (faltantes.length) {
    console.log(rojo(`\n  ✗ ${faltantes.length} programadas sin archivo:`));
    for (const f of faltantes) console.log(`      ${f.fecha} ${diaDe(f.fecha)}  ${f.id} — ${f.que}`);
}

if (salud.regeneracionCaida) {
    console.log(rojo('\n  ✗ La regeneración semanal de precios no está corriendo.'));
    console.log('      Es la que mantiene publicables las piezas con precio de acá en adelante.');
    console.log(gris('      gh run list --workflow=social-regeneracion.yml    ← ver si corrió'));
    console.log(gris('      gh workflow run social-regeneracion.yml           ← forzarla ahora'));
}

if (salud.enRiesgo.length) {
    console.log(rojo(`\n  ✗ ${salud.enRiesgo.length} piezas no pueden salir (hasta el ${salud.horizonte}):`));
    for (const c of salud.enRiesgo) {
        console.log(`      ${c.fecha} ${diaDe(c.fecha)}  ${c.id.padEnd(26)} ${c.motivo}`);
    }
}

if (resenas.errores.length) {
    console.log(rojo(`\n  ✗ ${resenas.errores.length} problema(s) con el número de reseñas:`));
    for (const e of resenas.errores) console.log(`      ${e.pieza} — ${e.que}`);
}
for (const a of resenas.avisos) console.log(amarillo(`\n  ⚠ ${a}`));

if (salud.regenerarAntesDel) {
    const faltan = diasEntre(salud.hoy, salud.regenerarAntesDel);
    const texto = `  → Los precios actuales alcanzan hasta el ${salud.regenerarAntesDel} (${faltan} días). ` +
        'El viernes se regeneran solos.';
    console.log(faltan <= 3 ? rojo(`\n${texto}`) : `\n${texto}`);
}

const roto = faltantes.length > 0 || salud.enRiesgo.length > 0 || salud.regeneracionCaida
    || resenas.errores.length > 0;
console.log(roto ? rojo('\n  Hay huecos que corregir.\n') : verde('\n  ✓ Todo lo programado puede salir.\n'));
process.exit(roto ? 1 : 0);
