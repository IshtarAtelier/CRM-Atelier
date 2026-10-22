#!/usr/bin/env node
/**
 * Abre los ojos de una foto de sesión con IA, tocando SOLO la zona de los ojos.
 *
 *   node --env-file=.env scripts/social/abrir-ojos.mjs <foto> <salida.jpg> [--referencia <otra foto con los ojos abiertos>] [--vista comparacion.jpg]
 *
 * Ishtar, 20/10/2026: "modificá con IA esa (Hermes C1) para que queden con los
 * ojos abiertos". La foto es de 4032×6048 y Gemini devuelve ~1024 px, así que
 * NO se le manda la foto entera: se recorta la franja de los ojos (la ubica
 * Vision, scripts/social/alinear-cara.mjs), se le pide a gemini-2.5-flash-image
 * que abra los ojos sin cambiar nada más, y el resultado se vuelve a pegar
 * sobre el original con una máscara suave alrededor de los ojos. Pelo, armazón,
 * piel y fondo quedan los píxeles originales. La salida es una foto nueva: el
 * original no se toca.
 *
 * Credenciales: GOOGLE_GENAI_API_KEY (la clave prepaga) o, si no está, Vertex
 * con GOOGLE_VERTEX_AI_WEB_CREDENTIALS + GOOGLE_CLOUD_PROJECT (como src/lib/voz.ts).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { GoogleGenAI } from '@google/genai';
import { detectarCaras } from './alinear-cara.mjs';

const sharp = createRequire(import.meta.url)('sharp');
const args = process.argv.slice(2);
const [ENTRADA, SALIDA] = args.filter(a => !a.startsWith('--'));
const VISTA = args.includes('--vista') ? args[args.indexOf('--vista') + 1] : null;
// Otra foto de la MISMA persona con los ojos abiertos: de ahí sale el color de
// ojos (Ishtar, 20/10/2026: "tiene ojos claros, usá las demás de referencia").
const REFERENCIA = args.includes('--referencia') ? args[args.indexOf('--referencia') + 1] : null;
// Indicaciones extra para un caso puntual (p. ej. un perfil): se suman al prompt.
const EXTRA = args.includes('--extra') ? args[args.indexOf('--extra') + 1] : '';
if (!ENTRADA || !SALIDA) { console.error('Uso: abrir-ojos.mjs <foto> <salida.jpg> [--vista comparacion.jpg]'); process.exit(1); }

function vertex() {
    const crudo = process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS;
    if (crudo && process.env.GOOGLE_CLOUD_PROJECT) {
        return new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT, location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1', googleAuthOptions: { credentials: JSON.parse(crudo) } });
    }
    return null;
}
/** Primero la clave prepaga; si está sin crédito (402) o no está, Vertex (se paga en el proyecto de GCP). */
async function generar(peticion) {
    if (process.env.GOOGLE_GENAI_API_KEY) {
        try { return await new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY }).models.generateContent(peticion); }
        catch (e) { if (e?.status !== 402) throw e; console.warn('La clave prepaga está sin crédito (402): se usa Vertex.'); }
    }
    const v = vertex();
    if (!v) throw new Error('Sin credenciales: GOOGLE_GENAI_API_KEY con crédito, o GOOGLE_VERTEX_AI_WEB_CREDENTIALS + GOOGLE_CLOUD_PROJECT.');
    return v.models.generateContent(peticion);
}

const PROMPT = `Edit the FIRST photo. The person's eyes are closed or looking down. Open her eyes naturally so she looks directly at the camera with a calm, relaxed expression and natural-looking eyes (realistic eyelashes, no exaggerated size).${REFERENCIA ? ' The SECOND image is the same person with her eyes open: copy her real eye color and iris from it exactly (light grey-blue eyes), do not make them brown.' : ' Keep her real eye color.'}${EXTRA ? ' ' + EXTRA : ''} Keep EVERYTHING else exactly identical: the eyeglasses frame and lenses, eyebrows, skin texture, hair, lighting, colors, framing and background. Do not retouch, beautify, sharpen or crop. Output only the edited photo, same size and framing as the input.`;

// 1. Dónde están los ojos.
const original = sharp(ENTRADA).rotate();
const { width: W, height: H } = await original.metadata();
const cara = detectarCaras([ENTRADA])[ENTRADA];
if (!cara) throw new Error('Vision no encontró la cara.');
const [ox, oy] = cara.ojos;
const anchoCara = cara.caja[2] * W;
// La franja: ancho de la cara con aire a los costados, y alto de ~45 % de eso.
const cw = Math.round(Math.min(W, anchoCara * 1.5));
const ch = Math.round(cw * 0.45);
// De perfil, el punto "ojos" de Vision es el ojo cercano: la franja se centra en
// la cara entera para que el ojo lejano (asomando tras la nariz) también entre.
const centroX = Math.abs(cara.yaw) > 20 ? (cara.caja[0] + cara.caja[2] / 2) * W : ox * W;
const cx = Math.max(0, Math.min(W - cw, Math.round(centroX - cw / 2)));
const cy = Math.max(0, Math.min(H - ch, Math.round(oy * H - ch / 2)));
const franja = await original.clone().extract({ left: cx, top: cy, width: cw, height: ch }).toBuffer();
const paraIA = await sharp(franja).resize({ width: 1024 }).jpeg({ quality: 95 }).toBuffer();
let refIA = null;
if (REFERENCIA) {
    const r = detectarCaras([REFERENCIA])[REFERENCIA];
    if (!r) throw new Error('Vision no encontró la cara en la referencia.');
    const ro = sharp(REFERENCIA).rotate();
    const { width: RW, height: RH } = await ro.metadata();
    const rw = Math.round(Math.min(RW, r.caja[2] * RW * 1.5)), rh = Math.round(rw * 0.45);
    refIA = await ro.extract({ left: Math.max(0, Math.min(RW - rw, Math.round(r.ojos[0] * RW - rw / 2))), top: Math.max(0, Math.min(RH - rh, Math.round(r.ojos[1] * RH - rh / 2))), width: rw, height: rh }).resize({ width: 1024 }).jpeg({ quality: 95 }).toBuffer();
}
console.log(`Franja de los ojos: ${cw}×${ch} en (${cx}, ${cy}) de ${W}×${H}.`);

// 2. Gemini.
const respuesta = await generar({
    model: 'gemini-2.5-flash-image',
    contents: [{ role: 'user', parts: [{ text: PROMPT }, { inlineData: { data: paraIA.toString('base64'), mimeType: 'image/jpeg' } }, ...(refIA ? [{ inlineData: { data: refIA.toString('base64'), mimeType: 'image/jpeg' } }] : [])] }],
    config: { responseModalities: ['IMAGE'] },
});
const parte = respuesta.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
if (!parte) throw new Error(`Gemini no devolvió imagen: ${JSON.stringify(respuesta.candidates?.[0]?.finishReason || respuesta)}`);
const editada = Buffer.from(parte.inlineData.data, 'base64');
const em = await sharp(editada).metadata();
console.log(`Gemini devolvió ${em.width}×${em.height}.`);

// 3. Pegar solo los ojos: la franja editada escalada al tamaño original, con
// una máscara elíptica suave centrada en los ojos (el resto sigue siendo el
// píxel original, incluido el armazón en los bordes de la franja).
// Gemini devuelve la franja con otro tono global (más clara o más fría): se
// iguala canal por canal a la media y el desvío del original, si no el parche
// se nota como un rectángulo (pasó con Andrómeda C7 el 20/10/2026).
const editadaGrande = await igualarColor(await sharp(editada).resize(cw, ch, { fit: 'fill' }).toBuffer(), franja);
async function igualarColor(buf, referencia) {
    const stats = async (b) => (await sharp(b).stats()).channels.slice(0, 3);
    const [se, sr] = await Promise.all([stats(buf), stats(referencia)]);
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += info.channels) for (let c = 0; c < 3; c++) {
        const v = (data[i + c] - se[c].mean) * (sr[c].stdev / (se[c].stdev || 1)) + sr[c].mean;
        data[i + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
    return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
}
const mascara = await sharp(Buffer.from(
    `<svg width="${cw}" height="${ch}"><defs><filter id="b"><feGaussianBlur stdDeviation="${Math.round(cw * 0.04)}"/></filter></defs>` +
    `<rect width="${cw}" height="${ch}" fill="black"/><ellipse cx="${cw / 2}" cy="${ch / 2}" rx="${cw * 0.34}" ry="${ch * 0.28}" fill="white" filter="url(#b)"/></svg>`,
)).toColourspace('b-w').raw().toBuffer();
// La mezcla se hace a mano (original × (1 − m) + parche × m): el composite de
// sharp con canal alfa no recortaba y el 20/10 se pegó el rectángulo entero.
const origStrip = await sharp(franja).removeAlpha().raw().toBuffer();
const patch = await sharp(editadaGrande).removeAlpha().raw().toBuffer();
const mezcla = Buffer.alloc(origStrip.length);
for (let i = 0, px = 0; i < origStrip.length; i += 3, px++) {
    const m = mascara[px] / 255;
    for (let c = 0; c < 3; c++) mezcla[i + c] = Math.round(origStrip[i + c] * (1 - m) + patch[i + c] * m);
}
const franjaFinal = await sharp(mezcla, { raw: { width: cw, height: ch, channels: 3 } }).png().toBuffer();
const base = await original.clone().jpeg({ quality: 100 }).toBuffer();
await sharp(base).composite([{ input: franjaFinal, left: cx, top: cy }]).jpeg({ quality: 95 }).toFile(SALIDA);
console.log(`✅ ${SALIDA}`);

if (VISTA) {
    const a = await sharp(franja).resize({ width: 700 }).toBuffer();
    const b = await sharp(SALIDA).extract({ left: cx, top: cy, width: cw, height: ch }).resize({ width: 700 }).toBuffer();
    const h = Math.round(700 * ch / cw);
    await sharp({ create: { width: 1410, height: h, channels: 3, background: '#fff' } }).composite([{ input: a, left: 0, top: 0 }, { input: b, left: 710, top: 0 }]).jpeg({ quality: 90 }).toFile(VISTA);
    console.log(`🖼  ${VISTA} (antes | después)`);
}
