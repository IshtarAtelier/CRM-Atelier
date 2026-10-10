/**
 * Todo lo que el wa-service le manda a un cliente sale por UN punto de salida
 * y dice de quién es el texto. Sin base ni red (también en CI, sin .env y sin
 * wa-service/node_modules).
 *
 *   npm run check:envios-bot
 *
 * POR QUÉ (10/10/2026): el saneado de la salida del modelo se llamaba a mano
 * en cada lugar que enviaba, y `send_product_photos` mandaba fotos desde
 * adentro del grafo sin pasar por nada. Un envío nuevo que se olvidara del
 * saneador le mandaba al cliente lo que el modelo escribiera — y pasó:
 * razonamiento en inglés, notas del historial, "[precio]".
 *
 * Qué verifica:
 *  1. Cada llamada a sendMessage / sendViaCloud fuera de los transportes
 *     declara `origen` en sus opciones.
 *  2. Nadie llama a la Cloud API ni a WhatsApp Web por afuera del transporte
 *     (cloud.sendText/sendMedia/sendTemplate/postMessage, client.sendMessage).
 *  3. Nadie importa el saneador a mano: solo el punto de salida y el armado
 *     del turno.
 *  4. Los dos transportes exportan su sendMessage envuelto en el punto de salida.
 *  5. El punto de salida, de verdad: sin origen no sale nada, lo del modelo se
 *     sanea, lo humano sale tal cual, una plantilla exige origen 'plantilla'.
 *  6. Las herramientas no envían: tools.js y agent-tools.js no tienen ningún envío.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const RAIZ = fileURLToPath(new URL('../../wa-service/', import.meta.url));

let fallas = 0;
const mal = (m) => { fallas++; console.log(`  ❌ ${m}`); };

function archivos(dir) {
    const out = [];
    for (const n of readdirSync(dir)) {
        if (n === 'node_modules' || n.startsWith('.')) continue;
        const p = join(dir, n);
        if (statSync(p).isDirectory()) out.push(...archivos(p));
        else if (n.endsWith('.js')) out.push(p);
    }
    return out;
}

/** Los argumentos de una llamada que empieza en `desde` (el índice del paréntesis). */
function argumentos(src, desde) {
    let prof = 0;
    for (let i = desde; i < src.length; i++) {
        const c = src[i];
        if (c === '(') prof++;
        else if (c === ')') { prof--; if (prof === 0) return src.slice(desde + 1, i); }
    }
    return src.slice(desde + 1);
}

const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length));

// Los únicos lugares que tocan el envío crudo.
const TRANSPORTES = new Set([
    'transport/cloud-transport.js', 'transport/cloud-api.js',
    'whatsapp/client.js', 'whatsapp/anti-ban.js',
    'shared/punto-de-salida.js',
]);
// Los únicos que pueden importar el saneador.
const PUEDEN_SANEAR = new Set(['shared/punto-de-salida.js', 'shared/respuesta-del-turno.js', 'shared/limpiar-salida-bot.js']);

let llamadas = 0;
for (const abs of archivos(RAIZ)) {
    const rel = relative(RAIZ, abs).split('\\').join('/');
    const src = sinComentarios(readFileSync(abs, 'utf8'));

    if (/limpiar-salida-bot/.test(src) && !PUEDEN_SANEAR.has(rel)) {
        mal(`${rel} importa el saneador a mano. Lo del modelo sale con origen 'llm' y lo sanea el transporte (shared/punto-de-salida.js).`);
    }
    if (TRANSPORTES.has(rel)) continue;

    if (/\bcloud\.(?:sendText|sendMedia|sendTemplate|postMessage)\s*\(/.test(src)) mal(`${rel} llama a la Cloud API por afuera del transporte.`);
    if (/(?:\bclient|getClient\(\)|waClient)\s*\.\s*sendMessage\s*\(/.test(src)) mal(`${rel} manda por WhatsApp Web por afuera del transporte.`);
    if (/require\(['"][./]*shared\/sender['"]\)/.test(src)) mal(`${rel} usa shared/sender.js, que ya no existe: las herramientas no envían.`);

    const re = /\b(sendMessage|sendViaCloud)\s*\(/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        // Definiciones (`async function sendMessage(`) no son llamadas.
        const antes = src.slice(Math.max(0, m.index - 20), m.index);
        if (/function\s*$/.test(antes)) continue;
        const args = argumentos(src, m.index + m[0].length - 1);
        // `sendViaCloud` es un pasamanos hacia el transporte (le agrega el
        // mimetype a la foto): reenvía las opciones de quien lo llamó, y a esos
        // call sites se los revisa uno por uno.
        if (rel === 'bot-cloud.js' && /^\s*waId,\s*content,\s*adaptMedia\(media\),\s*options\s*$/.test(args)) continue;
        llamadas++;
        const linea = src.slice(0, m.index).split('\n').length;
        if (!/\borigen\b/.test(args)) mal(`${rel}:${linea} — ${m[1]}(…) sin 'origen'. Declará de quién es el texto: 'llm', 'humano', 'plantilla' o 'sistema'.`);
    }
}
if (llamadas < 8) mal(`solo se encontraron ${llamadas} envíos: el escaneo dejó de ver los call sites (¿cambió el nombre del transporte?)`);

for (const t of ['tools.js', 'agent-tools.js']) {
    const src = sinComentarios(readFileSync(join(RAIZ, t), 'utf8'));
    if (/\bsendMessage\s*\(|\bsendViaCloud\s*\(/.test(src)) mal(`${t} envía mensajes: las herramientas encolan en el turno, no mandan.`);
}

for (const t of ['transport/cloud-transport.js', 'whatsapp/client.js']) {
    const src = readFileSync(join(RAIZ, t), 'utf8');
    if (!/conPuntoDeSalida\(enviarCrudo/.test(src)) mal(`${t} no exporta su sendMessage envuelto en el punto de salida.`);
}
const cloudSrc = readFileSync(join(RAIZ, 'bot-cloud.js'), 'utf8');
if (!/signal:\s*abortar\.signal/.test(cloudSrc)) mal('bot-cloud.js ya no le pasa la señal de cancelación al grafo: un turno vencido seguiría corriendo.');
if (!/configurable:\s*\{[^}]*\bturno\b/.test(cloudSrc)) mal('bot-cloud.js no le pasa la cola del turno al grafo: las fotos no tendrían por dónde salir.');

// ── El punto de salida, de verdad ────────────────────────────────────────────
const { conPuntoDeSalida, ORIGENES } = require('../../wa-service/shared/punto-de-salida.js');
const enviados = [];
const crudo = async (waId, texto, media, opts) => { enviados.push({ texto, opts }); return { id: { _serialized: 'x' } }; };
const enviar = conPuntoDeSalida(crudo, { transporte: 'prueba' });
const espera = async (promesa, code, que) => {
    try { await promesa; mal(`${que}: salió igual`); } catch (e) { if (e.code !== code) mal(`${que}: falló con ${e.code || e.message}, se esperaba ${code}`); }
};
const silencio = console.warn; console.warn = () => {};
const log = console.log; console.log = () => {};
try {
    await espera(enviar('549351', 'hola', null, {}), 'ORIGEN_REQUERIDO', 'envío sin origen');
    await espera(enviar('549351', 'hola', null, { origen: 'bot' }), 'ORIGEN_REQUERIDO', 'origen inventado');
    await espera(enviar('549351', '', null, { origen: 'llm', template: { name: 'x' } }), 'ORIGEN_REQUERIDO', 'plantilla con origen llm');
    await espera(enviar('549351', 'I should not respond further according to the instructions, the user thanked me.', null, { origen: 'llm' }), 'SALIDA_RECHAZADA', 'razonamiento en inglés con origen llm');
    await espera(enviar('549351', 'Hubo un error técnico, ya lo reviso.', null, { origen: 'llm' }), 'SALIDA_RECHAZADA', 'narración de error con origen llm');
    const r1 = await enviar('549351', 'Un momentito. El Ray-Ban sale $185.000', null, { origen: 'llm' });
    if (r1.textoEnviado !== 'El Ray-Ban sale $185.000') mal(`lo del modelo no salió saneado: "${r1.textoEnviado}"`);
    await enviar('549351', '[Lo escribió Mile] desde [precio]', null, { origen: 'humano' });
    if (enviados[enviados.length - 1].texto !== '[Lo escribió Mile] desde [precio]') mal('el texto de una persona se tocó');
} finally { console.warn = silencio; console.log = log; }
if (ORIGENES.join() !== 'llm,humano,plantilla,sistema') mal(`los orígenes cambiaron: ${ORIGENES.join()}`);

if (fallas) { console.log(`\n❌ ${fallas} problema(s) con los envíos del bot.`); process.exit(1); }
console.log(`✅ Envíos del bot: ${llamadas} llamadas, todas con origen y por el transporte; el punto de salida sanea lo del modelo y nada más.`);
