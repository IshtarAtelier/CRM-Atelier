/**
 * Voz en off para los reels, generada con las voces neuronales de Gemini.
 *
 *   node scripts/social/generar-voz.mjs social/contenido/reels/stellest-frena-miopia.json
 *   node scripts/social/generar-voz.mjs <reel.json> --voz Sulafat --aplicar
 *   node scripts/social/generar-voz.mjs --muestras "texto de prueba"
 *
 * Qué hace: lee el campo `guion` del reel (si no está, usa el copy), lo narra
 * con una voz femenina cálida en castellano rioplatense, y lo mezcla sobre el
 * video. Sin --aplicar deja el resultado como *-con-voz.mp4 en salida/ para
 * escucharlo; con --aplicar reemplaza el mp4 HOSTEADO (el que publica el cron).
 *
 * --muestras genera un clip corto con varias voces candidatas para elegir.
 *
 * EL TIEMPO ES LA PARTE DELICADA: el video dura 14 s fijos y la narración sale
 * del TTS con la duración que sale. Si el audio queda más largo que 13.3 s se
 * acelera hasta un 12% (imperceptible); si ni así entra, el script corta con
 * error para que se acorte el guion — meter una narración apurada arruina
 * exactamente lo que la voz viene a aportar.
 *
 * La voz por defecto es Sulafat (cálida). El acento se pide por instrucción
 * ("castellano rioplatense, cálida y cercana"), que es como se controla el
 * estilo en estas voces.
 */
import 'dotenv/config';
import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { RAIZ } from './identidad.mjs';

const ejecutar = promisify(execFile);
const SALIDA = path.join(RAIZ, 'social', 'contenido', 'reels', 'salida');
const HOSTEO = path.join(RAIZ, 'public', 'social', 'reels');

// Aoede: la eligio el usuario escuchando el comparador (6/8/2026).
const VOZ_DEFAULT = 'Aoede';
const VOCES_CANDIDATAS = ['Sulafat', 'Aoede', 'Leda'];
// La duración se mide del video REAL: los educativos duran 14 s y las promos
// 9. Con el valor fijo de antes, mezclar una promo dejaba 5 s de video
// congelado en negro al final.

/**
 * La dirección actoral importa más que la voz elegida: sin ella, cualquier voz
 * neural cae en dicción de locutora neutra, que es lo que suena "robótico".
 * Se le pide explícitamente el acento (yeísmo rehilado: la ll/y como "sh"),
 * la entonación y el registro conversacional.
 */
const ESTILO = 'Sos una locutora argentina. Hablá con acento rioplatense auténtico: ' +
    'la "ll" y la "y" suenan "sh" (yeísmo rehilado), entonación melódica que baja al final ' +
    'de las frases, y voseo natural. Registro cálido e íntimo, como si le contaras algo ' +
    'a una amiga tomando un café: conversacional, con pausas naturales donde hay comas, ' +
    'levemente sonriente. NADA de dicción neutra de locutora comercial, nada robótico, ' +
    'sin sobreactuar. Este es el texto: ';

async function tts(texto, voz) {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) throw new Error('Falta GOOGLE_GENAI_API_KEY en el .env');

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    // El modelo pro narra con mucha más naturalidad que el flash — la
    // diferencia se oye exactamente en lo "robótico". Si no está disponible
    // para la cuenta, se cae al flash avisando.
    const generar = (model) => ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: ESTILO + '\n\n' + texto }] }],
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } } },
        },
    });

    let resp;
    try {
        resp = await generar('gemini-2.5-pro-preview-tts');
    } catch (e) {
        console.log('  (pro-tts no disponible, usando flash: ' + String(e.message).slice(0, 80) + ')');
        resp = await generar('gemini-2.5-flash-preview-tts');
    }

    const parte = resp.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
    if (!parte) throw new Error('El TTS no devolvió audio. Respuesta sin inlineData.');
    // PCM crudo: s16le, 24 kHz, mono
    return Buffer.from(parte.inlineData.data, 'base64');
}

async function pcmAWav(pcm, destinoWav) {
    const ffmpeg = (await import('ffmpeg-static')).default;
    const tmp = destinoWav.replace(/\.wav$/, '.pcm');
    await writeFile(tmp, pcm);
    await ejecutar(ffmpeg, ['-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', tmp, destinoWav]);
    await rm(tmp, { force: true });
}

async function duracionDe(archivo) {
    const ffmpeg = (await import('ffmpeg-static')).default;
    // ffmpeg escribe el progreso a stderr y sale con 0: la duración hay que
    // leerla del stderr del caso EXITOSO (el primer intento solo miraba el
    // catch y por eso "no podía medir" un wav perfectamente sano).
    let stderr = '';
    try {
        const r = await ejecutar(ffmpeg, ['-i', archivo, '-f', 'null', '-']);
        stderr = String(r.stderr || '');
    } catch (e) {
        stderr = String(e.stderr || '');
    }
    const m = stderr.match(/time=(\d+):(\d+):(\d+\.\d+)/g);
    if (m) {
        const u = m[m.length - 1].match(/time=(\d+):(\d+):(\d+\.\d+)/);
        return Number(u[1]) * 3600 + Number(u[2]) * 60 + Number(u[3]);
    }
    throw new Error(`No se pudo medir la duración de ${archivo}`);
}

export async function generarVoz(rutaJson, { voz = VOZ_DEFAULT, aplicar = false } = {}) {
    const reel = JSON.parse(await readFile(rutaJson, 'utf-8'));
    const texto = (reel.guion || reel.copy || '').trim();
    if (!texto) throw new Error('El reel no tiene ni guion ni copy para narrar.');

    const videoHosteado = path.join(HOSTEO, `${reel.tema}.mp4`);
    await mkdir(SALIDA, { recursive: true });

    const durVideo = await duracionDe(videoHosteado);
    const tope = durVideo - 0.7;

    console.log(`\nNarrando "${reel.tema}" con la voz ${voz}… (video: ${durVideo.toFixed(1)} s)`);
    const pcm = await tts(texto, voz);
    const wav = path.join(SALIDA, `.voz-${reel.tema}.wav`);
    await pcmAWav(pcm, wav);

    let dur = await duracionDe(wav);
    console.log(`  narración: ${dur.toFixed(1)} s (tope: ${tope.toFixed(1)} s)`);

    // Si no entra, acelerar hasta 12%. Más que eso se nota y es peor que nada.
    let filtroTempo = '';
    if (dur > tope) {
        const factor = dur / tope;
        if (factor > 1.12) {
            throw new Error(
                `La narración dura ${dur.toFixed(1)} s y ni acelerada al 12% entra en ${tope.toFixed(1)} s. ` +
                `Acortar el campo "guion" del reel (hoy: ${texto.split(/\s+/).length} palabras).`
            );
        }
        filtroTempo = `,atempo=${factor.toFixed(4)}`;
        console.log(`  se acelera ${((factor - 1) * 100).toFixed(0)}% para que entre`);
    }

    const ffmpeg = (await import('ffmpeg-static')).default;
    const salidaMp4 = path.join(SALIDA, `${reel.tema}-con-voz.mp4`);
    // 400 ms de aire antes de arrancar a hablar + apad para cubrir el resto
    // del video en silencio (el outro del logo queda sin voz, como debe ser).
    await ejecutar(ffmpeg, [
        '-y', '-i', videoHosteado, '-i', wav,
        // loudnorm: los 14 reels al mismo volumen (-16 LUFS). Sin esto habia
        // 5.5 dB de dispersion entre piezas y dos quedaban 'bajitas'.
        '-filter_complex', `[1:a]adelay=400|400${filtroTempo},loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]`,
        '-map', '0:v', '-map', '[a]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
        '-t', durVideo.toFixed(2),
        salidaMp4,
    ]);
    await rm(wav, { force: true });

    console.log(`\n✅ ${path.relative(RAIZ, salidaMp4)}`);

    if (aplicar) {
        await copyFile(salidaMp4, videoHosteado);
        console.log(`✅ aplicado al hosteado: ${path.relative(RAIZ, videoHosteado)} (es lo que publica el cron)`);
    } else {
        console.log('   (sin --aplicar: el mp4 hosteado sigue mudo)');
    }
    return salidaMp4;
}

/**
 * Las voces candidatas, en UN SOLO VIDEO: cada una con su tarjeta con nombre,
 * una tras otra. Un video se reproduce en cualquier lado; los archivos de
 * audio sueltos no — ya pasó que no se podían escuchar desde el chat.
 */
export async function generarMuestras(texto) {
    await mkdir(SALIDA, { recursive: true });
    const ffmpeg = (await import('ffmpeg-static')).default;
    const { chromium } = await import('playwright');

    const nav = await chromium.launch();
    const pg = await nav.newPage({ viewport: { width: 1080, height: 1920 } });
    const segmentos = [];
    const DESC = { Sulafat: 'cálida', Aoede: 'fresca', Leda: 'joven' };

    try {
        for (const [i, voz] of VOCES_CANDIDATAS.entries()) {
            console.log(`\nMuestra con ${voz}…`);
            const pcm = await tts(texto, voz);
            const wav = path.join(SALIDA, `.muestra-${voz}.wav`);
            await pcmAWav(pcm, wav);

            const card = path.join(SALIDA, `.card-${voz}.png`);
            await pg.setContent(
                '<body style="margin:0;width:1080px;height:1920px;background:#2a211c;color:#fff;' +
                'font-family:-apple-system,sans-serif;display:flex;flex-direction:column;' +
                'align-items:center;justify-content:center;gap:30px">' +
                `<div style="font-size:44px;opacity:.6;letter-spacing:.1em">VOZ ${i + 1} DE ${VOCES_CANDIDATAS.length}</div>` +
                `<div style="font-size:130px;font-weight:900;color:#9e7f65">${voz}</div>` +
                `<div style="font-size:52px;opacity:.85">${DESC[voz] || ''}</div>` +
                '<div style="position:absolute;bottom:140px;font-size:38px;opacity:.5">¿Cuál te gusta más?</div></body>'
            );
            await pg.screenshot({ path: card });

            const seg = path.join(SALIDA, `.seg-${voz}.mp4`);
            await ejecutar(ffmpeg, ['-y', '-loop', '1', '-i', card, '-i', wav,
                '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-r', '30',
                '-c:a', 'aac', '-b:a', '128k', '-shortest', seg]);
            segmentos.push(seg);
            await rm(wav, { force: true });
            await rm(card, { force: true });
            console.log(`  ✅ ${voz}`);
        }
    } finally {
        await nav.close();
    }

    const lista = path.join(SALIDA, '.lista-muestras.txt');
    await writeFile(lista, segmentos.map(s => `file '${s}'`).join('\n') + '\n');
    const final = path.join(SALIDA, 'comparacion-voces.mp4');
    await ejecutar(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', final]);
    for (const s of [...segmentos, lista]) await rm(s, { force: true });

    console.log(`\n✅ ${path.relative(RAIZ, final)} — las ${VOCES_CANDIDATAS.length} voces en un solo video`);
    return [final];
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    const val = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
    try {
        if (args.includes('--muestras')) {
            await generarMuestras(val('--muestras') || 'Hola, soy la voz de Atelier Óptica. Medimos tu vista sin apuro, en Cerro de las Rosas.');
        } else {
            const ruta = args.find(a => !a.startsWith('--') && a.endsWith('.json'));
            if (!ruta) { console.error('Falta el reel .json'); process.exit(1); }
            await generarVoz(path.resolve(ruta), {
                voz: val('--voz') || VOZ_DEFAULT,
                aplicar: args.includes('--aplicar'),
            });
        }
    } catch (e) {
        console.error(`\n❌ ${e.message}`);
        process.exit(1);
    }
}
