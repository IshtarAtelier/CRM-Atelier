/**
 * Arma un reel "desfile de modelos": todas las stories de producto ya
 * renderizadas, una atrás de otra con crossfade, música aparte.
 *
 *   node scripts/social/reel-desfile-modelos.mjs [--cantidad 24] [--segundos 1]
 *
 * Ishtar (28/8): "hace un videito que cambie muchos de los anteojos, como
 * todas las fotitos una atrás de la otra cambiando los modelitos".
 *
 * POR QUÉ USA LAS STORIES YA RENDERIZADAS Y NO FOTOS PELADAS
 * Cada story-producto-*.jpg ya tiene el nombre del modelo y el precio del día
 * (fuente:"base", regla R6) quemados en la imagen. Un desfile de fotos peladas
 * sería lindo pero mudo — así cada corte además vende. Sin red: son archivos
 * locales ya generados por generar-story-producto.mjs.
 *
 * SIN AUDIO A PROPÓSITO (-an), mismo criterio que render-reel.mjs: Instagram
 * banca peor un audio vacío que ningún audio. La música se agrega a mano en
 * la app al publicar.
 */
import { readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import { RAIZ } from './identidad.mjs';

const ejecutar = promisify(execFile);
const BANCO = path.join(RAIZ, 'public', 'social');
const SALIDA_DIR = path.join(RAIZ, 'social', 'contenido', 'reels', 'salida');

function arg(nombre, porDefecto) {
    const i = process.argv.indexOf(`--${nombre}`);
    return i >= 0 ? process.argv[i + 1] : porDefecto;
}

const CANTIDAD = Number(arg('cantidad', 24));
const SEGUNDOS_POR_FOTO = Number(arg('segundos', 1.1));
const CROSSFADE = 0.35; // segundos de transición, restados del tiempo "quieto" de cada foto

function fechaHoy() {
    const ART = new Date(Date.now() - 3 * 60 * 60 * 1000);
    return `${ART.getUTCFullYear()}${String(ART.getUTCMonth() + 1).padStart(2, '0')}${String(ART.getUTCDate()).padStart(2, '0')}`;
}

async function main() {
    const carpetas = (await readdir(BANCO, { withFileTypes: true }))
        .filter(d => d.isDirectory() && d.name.startsWith('story-producto-'))
        .map(d => d.name)
        .filter(n => existsSync(path.join(BANCO, n, '01.jpg')));

    if (carpetas.length < 2) throw new Error('No hay suficientes stories de producto renderizadas.');

    // Orden estable pero no alfabético puro (que no salgan todas las "A" juntas):
    // se mezcla determinísticamente por hash del nombre, para que dos corridas
    // del mismo día den el mismo video (reproducible) pero no siempre el mismo orden.
    const conHash = carpetas.map(n => {
        let h = 0;
        for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        return { n, h };
    });
    conHash.sort((a, b) => a.h - b.h);
    const elegidas = conHash.slice(0, Math.min(CANTIDAD, conHash.length)).map(x => x.n);

    console.log(`${elegidas.length} modelos en el desfile:`);
    elegidas.forEach(n => console.log('  -', n.replace('story-producto-', '')));

    await mkdir(SALIDA_DIR, { recursive: true });
    const salida = path.join(SALIDA_DIR, `${fechaHoy()}-desfile-modelos-reel.mp4`);
    const cover = path.join(SALIDA_DIR, `${fechaHoy()}-desfile-modelos-cover.jpg`);

    // Filtro xfade encadenado: cada input entra con un crossfade sobre el anterior.
    // offset acumulado = duración quieta de las fotos previas (sin solaparse).
    const duracionQuieta = SEGUNDOS_POR_FOTO;
    const inputs = [];
    elegidas.forEach(n => {
        inputs.push('-loop', '1', '-t', String(duracionQuieta + CROSSFADE), '-i', path.join(BANCO, n, '01.jpg'));
    });

    let filtro = '';
    let etiquetaPrevia = '0:v';
    let offset = duracionQuieta;
    for (let i = 1; i < elegidas.length; i++) {
        const etiquetaSalida = i === elegidas.length - 1 ? 'vout' : `v${i}`;
        filtro += `[${etiquetaPrevia}][${i}:v]xfade=transition=fade:duration=${CROSSFADE}:offset=${offset.toFixed(2)}[${etiquetaSalida}];`;
        etiquetaPrevia = etiquetaSalida;
        offset += duracionQuieta;
    }
    filtro = filtro.slice(0, -1); // saca el ; final

    console.log('\nRenderizando con ffmpeg (puede tardar un rato)...');
    await ejecutar(ffmpegPath, [
        '-y',
        ...inputs,
        '-filter_complex', filtro,
        '-map', '[vout]',
        // Las stories ya salen de render.mjs en 1080x1920 (formato "9:16"),
        // así que no hace falta escalar — un -vf junto a -filter_complex sobre
        // el mismo stream de salida es un error de ffmpeg, no una opción.
        '-r', '30',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-an',
        salida,
    ], { maxBuffer: 1024 * 1024 * 50 });

    // Portada: primer frame.
    await ejecutar(ffmpegPath, ['-y', '-i', salida, '-frames:v', '1', cover]);

    console.log('\n✅', salida);
    console.log('✅', cover);
    console.log(`\nDuración aprox: ${(offset).toFixed(1)}s`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
