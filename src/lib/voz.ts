import { GoogleGenAI } from '@google/genai';
// El fork que arregla el `MPEGMode is not defined` de lamejs 1.2.1 (ESM, con tipos).
import * as lamejs from '@breezystack/lamejs';

/**
 * TEXTO A VOZ, para mandar un audio por WhatsApp (15/10/2026: el recordatorio
 * de la confirmación de compra, pedido de Ishtar: "mandale un audio diciendo
 * la importancia de su confirmación").
 *
 * La voz la genera Gemini por VERTEX (cuenta de servicio del proyecto, se
 * factura a mes vencido y no se corta), no por la clave de AI Studio, que es
 * prepaga y el 8/10 y el 15/10 estaba en 402. Devuelve PCM 24 kHz mono; acá se
 * codifica a MP3 en JS puro (lamejs) porque el servidor no tiene ffmpeg, y el
 * bot lo manda como nota de voz (`sendAudioAsVoice`). Si algo falla devuelve
 * null: el que llama manda solo el texto, nunca se queda sin mandar nada.
 */
const MODELO_VOZ = 'gemini-2.5-flash-preview-tts';
const VOZ = 'Kore';
const FRECUENCIA = 24_000;

function clienteVertex(): GoogleGenAI | null {
    const crudo = process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS;
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    if (!crudo || !project) return null;
    try {
        const credentials = JSON.parse(crudo);
        return new GoogleGenAI({ vertexai: true, project, location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1', googleAuthOptions: { credentials } });
    } catch { return null; }
}

/** PCM 16 bit mono → MP3 (64 kbps). Puro. */
export function pcmAMp3(pcm: Buffer, frecuencia = FRECUENCIA): Buffer {
    const muestras = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
    const enc = new lamejs.Mp3Encoder(1, frecuencia, 64);
    const partes: Buffer[] = [];
    const BLOQUE = 1152;
    for (let i = 0; i < muestras.length; i += BLOQUE) {
        const b = enc.encodeBuffer(muestras.subarray(i, i + BLOQUE));
        if (b.length) partes.push(Buffer.from(b));
    }
    const fin = enc.flush();
    if (fin.length) partes.push(Buffer.from(fin));
    return Buffer.concat(partes);
}

/** El audio de un guion, listo para `sendWhatsApp({ media })`; null si no se pudo (y por qué, en el log). */
export async function generarVozMp3(guion: string, opts: { filename?: string; instruccion?: string } = {}): Promise<{ base64: string; mimetype: string; filename: string; segundos: number } | null> {
    const ai = clienteVertex();
    if (!ai) { console.error('[voz] sin credenciales de Vertex (GOOGLE_VERTEX_AI_WEB_CREDENTIALS / GOOGLE_CLOUD_PROJECT)'); return null; }
    try {
        const r = await ai.models.generateContent({
            model: MODELO_VOZ,
            contents: [{ role: 'user', parts: [{ text: `${opts.instruccion ?? 'Decí esto con voz cálida y natural, en español de Argentina'}: ${guion}` }] }],
            config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOZ } } } },
        });
        const part = r.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
        if (!part?.inlineData?.data) { console.error('[voz] Gemini no devolvió audio'); return null; }
        const pcm = Buffer.from(part.inlineData.data, 'base64');
        const mp3 = pcmAMp3(pcm);
        return { base64: mp3.toString('base64'), mimetype: 'audio/mpeg', filename: opts.filename ?? 'audio.mp3', segundos: Math.round(pcm.length / (FRECUENCIA * 2)) };
    } catch (err: any) {
        console.error('[voz] no se pudo generar el audio:', err?.message || err);
        return null;
    }
}
