/**
 * Refresca el número real de reseñas y lo hornea en las piezas que lo declaran.
 *
 *   node scripts/social/actualizar-resenas.mjs               → consulta y hornea
 *   node scripts/social/actualizar-resenas.mjs --sin-red     → solo hornea con el último dato
 *   node scripts/social/actualizar-resenas.mjs --sin-render  → no re-renderiza las placas
 *
 * Lo corre la regeneración semanal de los viernes (social-regeneracion.yml),
 * junto con los precios: mismo problema, misma solución. Hace tres cosas:
 *
 *   1. Lee el endpoint público /api/reviews del sitio (rating y total reales,
 *      que el sitio ya trae de Google) y guarda el dato en social/resenas.json.
 *      SOLO red pública: acá no se toca ninguna base.
 *   2. Resuelve los campos `_plantilla` de las piezas de social/contenido/
 *      ({{RESENAS}} / {{RATING}}, ver resenas.mjs) y ESCRIBE el resultado en el
 *      JSON. Escribirlo no es opcional: el cron de producción publica `caption`
 *      tal cual está commiteado y no sabe de plantillas.
 *   3. Re-renderiza SOLO las piezas cuyo texto resuelto cambió (si el número
 *      no se movió de escalón, no hay nada que regenerar y no se ensucia git).
 *
 * SI EL ENDPOINT NO RESPONDE: se avisa fuerte y se sigue con el último dato
 * conocido — la pieza conserva su número y `npm run check:social` avisa cuando
 * el dato queda viejo. Peor que un número de la semana pasada sería que un
 * viernes caído tumbe también la regeneración de precios.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './identidad.mjs';
import {
    ARCHIVO_RESENAS,
    ENDPOINT_RESENAS,
    leerResenasConocidas,
    redondearParaPublicar,
    resolverPiezaResenas,
} from './resenas.mjs';

const CONTENIDO = path.join(RAIZ, 'social', 'contenido');
const sinRed = process.argv.includes('--sin-red');
const sinRender = process.argv.includes('--sin-render');

const hoyART = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Cordoba' });

/** El dato real, del endpoint. Devuelve null si no se pudo (y ya avisó). */
async function consultarEndpoint() {
    try {
        const res = await fetch(ENDPOINT_RESENAS, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) throw new Error(`respondió ${res.status}`);
        const json = await res.json();
        const total = json.userRatingCount;
        const rating = json.rating;
        if (!Number.isInteger(total) || total <= 0 || typeof rating !== 'number' || rating < 1 || rating > 5) {
            throw new Error(`payload inesperado: total=${total}, rating=${rating}`);
        }
        return { total, rating };
    } catch (e) {
        console.error(`\n⚠️  No se pudo leer ${ENDPOINT_RESENAS} (${e.message}).`);
        console.error('   Las piezas conservan el último número conocido; check:social va a avisar si envejece.');
        return null;
    }
}

const previos = await leerResenasConocidas();
const consulta = sinRed ? null : await consultarEndpoint();

let datos = previos;
if (consulta) {
    datos = {
        actualizado: hoyART(),
        total: consulta.total,
        rating: consulta.rating,
        fuente: ENDPOINT_RESENAS,
    };
    // Se escribe siempre que la consulta anduvo, aunque el número no cambie:
    // `actualizado` es lo que le dice al check que el refresco sigue vivo.
    await writeFile(ARCHIVO_RESENAS, `${JSON.stringify(datos, null, 2)}\n`);
    const movio = previos && previos.total !== datos.total ? ` (antes ${previos.total})` : '';
    console.log(`\n✅ Reseñas reales: ${datos.total}${movio}, rating ${datos.rating} — se publica "más de ${redondearParaPublicar(datos.total)}".`);
}

if (!datos) {
    console.error('\n❌ No hay dato de reseñas: ni el endpoint respondió ni existe social/resenas.json.');
    process.exit(1);
}

// ── Hornear las piezas que declaran el número por plantilla ─────────────────
const paraRender = [];
for (const nombre of (await readdir(CONTENIDO)).filter(f => f.endsWith('.json')).sort()) {
    const ruta = path.join(CONTENIDO, nombre);
    const original = await readFile(ruta, 'utf-8');
    const pieza = JSON.parse(original);

    const { usa, cambios } = resolverPiezaResenas(pieza, datos);
    if (!usa) continue;

    const serializada = `${JSON.stringify(pieza, null, 2)}\n`;
    if (serializada !== original) await writeFile(ruta, serializada);

    if (cambios.length) {
        paraRender.push(ruta);
        console.log(`  ✏️  ${nombre}: ${cambios.join(', ')}`);
    } else {
        console.log(`  ·  ${nombre}: sin cambios (ya decía lo mismo)`);
    }
}

if (!paraRender.length) {
    console.log('\nNinguna placa que re-renderizar: el número publicado no cambió de escalón.');
    process.exit(0);
}

if (sinRender) {
    console.log(`\n${paraRender.length} pieza(s) cambiaron; falta re-renderizarlas (se pasó --sin-render):`);
    for (const r of paraRender) console.log(`  node scripts/social/render.mjs ${path.relative(RAIZ, r)}`);
    process.exit(0);
}

const { renderizarPieza } = await import('./render.mjs');
for (const ruta of paraRender) {
    console.log(`\n▶ render: ${path.relative(RAIZ, ruta)}`);
    const r = await renderizarPieza(ruta);
    if (!r.ok) {
        console.error('❌ El render falló: la pieza quedó con el texto nuevo pero la placa vieja.');
        process.exit(1);
    }
}
console.log(`\n✅ ${paraRender.length} pieza(s) al día con ${datos.total} reseñas reales.`);
