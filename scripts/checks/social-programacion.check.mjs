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
 *
 * La regla de vencimiento no se reescribe acá: sale del mismo helper que usa el
 * mail diario (`src/lib/social/salud-programacion.ts`), que a su vez usa la
 * misma guarda que corre el día D. Si divergieran, este chequeo daría verde
 * mientras la publicación falla — que es justo el modo de fallar a eliminar.
 */
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    evaluarSaludProgramacion,
    diasEntre,
    DIAS_COBERTURA_MINIMA,
} from '../../src/lib/social/salud-programacion.ts';

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

const salud = await evaluarSaludProgramacion();
const { programacion } = JSON.parse(
    await readFile(path.join(RAIZ, 'social', 'feed-programacion.json'), 'utf-8'),
);
const faltantes = archivosFaltantes(programacion, salud.hoy);

console.log(`\n  Programación de redes — ${salud.hoy}\n`);
console.log(`  Feed:    ${salud.entradasFuturas} entradas por delante, hasta el ${salud.ultimaFecha || '—'}` +
    gris(`  (${salud.diasDeCobertura} días)`));
console.log(`  Precios: ${salud.piezasConPrecio} piezas con precio, regeneradas el ${salud.ultimaRegeneracion || '—'}` +
    gris(`  (hace ${salud.diasDesdeRegeneracion ?? '—'} días)`));

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

if (salud.regenerarAntesDel) {
    const faltan = diasEntre(salud.hoy, salud.regenerarAntesDel);
    const texto = `  → Los precios actuales alcanzan hasta el ${salud.regenerarAntesDel} (${faltan} días). ` +
        'El viernes se regeneran solos.';
    console.log(faltan <= 3 ? rojo(`\n${texto}`) : `\n${texto}`);
}

const roto = faltantes.length > 0 || salud.enRiesgo.length > 0 || salud.regeneracionCaida;
console.log(roto ? rojo('\n  Hay huecos que corregir.\n') : verde('\n  ✓ Todo lo programado puede salir.\n'));
process.exit(roto ? 1 : 0);
