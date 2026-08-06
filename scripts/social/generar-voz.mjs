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

const VOZ_DEFAULT = 'Sulafat';
const VOCES_CANDIDATAS = ['Sulafat', 'Aoede', 'Leda'];
const DURACION_VIDEO_S = 14;
const TOPE_NARRACION_S = 13.3;

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

    console.log(`\nNarrando "${reel.tema}" con la voz ${voz}…`);
    const pcm = await tts(texto, voz);
    const wav = path.join(SALIDA, `.voz-${reel.tema}.wav`);
    await pcmAWav(pcm, wav);

    let dur = await duracionDe(wav);
    console.log(`  narración: ${dur.toFixed(1)} s (video: ${DURACION_VIDEO_S} s)`);

    // Si no entra, acelerar hasta 12%. Más que eso se nota y es peor que nada.
    let filtroTempo = '';
    if (dur > TOPE_NARRACION_S) {
        const factor = dur / TOPE_NARRACION_S;
        if (factor > 1.12) {
            throw new Error(
                `La narración dura ${dur.toFixed(1)} s y ni acelerada al 12% entra en ${TOPE_NARRACION_S} s. ` +
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
        '-filter_complex', `[1:a]adelay=400|400${filtroTempo},apad[a]`,
        '-map', '0:v', '-map', '[a]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
        '-t', String(DURACION_VIDEO_S),
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

/** Un clip corto por cada voz candidata, para elegir escuchando. */
export async function generarMuestras(texto) {
    await mkdir(SALIDA, { recursive: true });
    const archivos = [];
    for (const voz of VOCES_CANDIDATAS) {
        console.log(`\nMuestra con ${voz}…`);
        const pcm = await tts(texto, voz);
        const wav = path.join(SALIDA, `muestra-voz-${voz.toLowerCase()}.wav`);
        await pcmAWav(pcm, wav);
        // a m4a para que pese poco y se escuche en cualquier lado
        const ffmpeg = (await import('ffmpeg-static')).default;
        const m4a = wav.replace(/\.wav$/, '.m4a');
        await ejecutar(ffmpeg, ['-y', '-i', wav, '-c:a', 'aac', '-b:a', '96k', m4a]);
        await rm(wav, { force: true });
        console.log(`  ✅ ${path.relative(RAIZ, m4a)}`);
        archivos.push(m4a);
    }
    return archivos;
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
