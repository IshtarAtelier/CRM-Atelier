/**
 * Sube un reel ya renderizado a YouTube, como Short.
 *
 *   node scripts/social/subir-youtube.mjs que-es-la-miopia
 *
 * Usa el mismo criterio de copy y hashtags que publicar-reel-manual.mjs (la
 * fuente es social/contenido/reels/<tema>.json + seo-hashtags.json), para no
 * mantener el texto por duplicado en dos scripts.
 *
 * Credenciales: GOOGLE_YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN en .env. Son de
 * un proyecto de Google Cloud PROPIO (atelier-youtube), separado del que usa
 * Google Ads — no tocarlas para nada relacionado con Ads.
 *
 * OJO: el proyecto todavía no pasó la auditoría de Google (ver
 * docs/pendiente-auditoria-youtube.md si existe, o preguntar). Mientras tanto
 * TODO video subido por API queda bloqueado en privado, sea cual sea el
 * privacyStatus pedido — es una restricción de Google a los proyectos no
 * auditados, no un bug de este script. Por eso pide 'unlisted' pero loguea
 * el status real que devuelve la API.
 */
import 'dotenv/config';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { OAuth2Client } from 'google-auth-library';
import { RAIZ } from './identidad.mjs';
import { registrarPublicacion } from './bitacora.mjs';

// Título corto por tema: no hay un campo así en los JSON de contenido (son
// para el render del video, no para YouTube), así que se declara acá.
const TITULOS = {
  '2x1-multifocales': 'Multifocales 2x1: dos pares al precio de uno',
  '6-cuotas': 'Tus anteojos en 6 cuotas sin interés',
  'fotocromaticos-dia': 'El lente que se oscurece solo con el sol',
  'garantia-30-dias': 'Garantía de adaptación: 30 días para probar tus multifocales',
  'indices-de-refraccion': 'Índices de refracción: cuál te conviene según tu graduación',
  'lente-bifocal': 'Bifocal vs. progresivo: la diferencia se siente',
  'lente-monofocal': '¿Qué es un lente monofocal?',
  'lente-myofix': 'MyoFix: control de la miopía infantil',
  'lente-progresiva': 'Cómo funciona un lente progresivo',
  'lente-stellest': 'Stellest: hasta 67% menos avance de la miopía',
  'medicion-armazon': 'Por qué la medición cambia todo en un progresivo',
  'que-es-la-hipermetropia': '¿Qué es la hipermetropía?',
  'que-es-la-miopia': '¿Qué es la miopía?',
  'que-es-la-presbicia': '¿Qué es la presbicia?',
  'stellest-frena-miopia': 'Cómo frenar el avance de la miopía infantil',
};

const [, , tema, ...flags] = process.argv;
if (!tema) throw new Error('Uso: subir-youtube.mjs <tema>');
if (!TITULOS[tema]) throw new Error(`"${tema}" no tiene título declarado en TITULOS.`);
const prueba = flags.includes('--prueba');

const def = JSON.parse(await readFile(path.join(RAIZ, 'social', 'contenido', 'reels', `${tema}.json`), 'utf-8'));
const tablas = JSON.parse(await readFile(path.join(RAIZ, 'social', 'seo-hashtags.json'), 'utf-8'));

// Mismo criterio que publicar-reel-manual.mjs: hasta 3 hashtags del tema
// específico + 2 de salud + los de base + el resto del tema, tope de 8.
const temasDeReel = (def.temas || []).flatMap((t) => tablas.porTema?.[t] || []);
const tags = [...new Set([
  ...temasDeReel.slice(0, 3),
  ...(tablas.salud || []).slice(0, 2),
  ...(tablas.base || []),
  ...temasDeReel.slice(3),
])].slice(0, 8);

const titulo = `${TITULOS[tema]} #Shorts`;
const descripcion = `${String(def.copy || '').trim()}\n\n${tags.map((h) => `#${h}`).join(' ')} #Shorts`;

const videoPath = path.join(RAIZ, 'public', 'social', 'reels', `${tema}.mp4`);
const { size } = await stat(videoPath);

const client = new OAuth2Client(
  process.env.GOOGLE_YOUTUBE_CLIENT_ID,
  process.env.GOOGLE_YOUTUBE_CLIENT_SECRET,
);
client.setCredentials({ refresh_token: process.env.GOOGLE_YOUTUBE_REFRESH_TOKEN });
const { token } = await client.getAccessToken();

console.log(`\n[${tema}] "${titulo}" · ${(size / 1024 / 1024).toFixed(1)} MB`);
if (prueba) {
  console.log('  DESCRIPCIÓN:\n' + descripcion);
  console.log('\n  (--prueba: no se subió nada)');
  process.exit(0);
}

// Paso 1: inicia la carga resumible y declara metadata + tamaño real del archivo.
const init = await fetch(
  'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(size),
    },
    body: JSON.stringify({
      snippet: { title: titulo, description: descripcion, tags, categoryId: '27', defaultLanguage: 'es' },
      status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false },
    }),
  },
);
if (!init.ok) throw new Error(`Falló el init (${init.status}): ${await init.text()}`);
const uploadUrl = init.headers.get('location');

// Paso 2: sube los bytes del video a la URL que devolvió el paso 1.
const put = await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size) },
  body: createReadStream(videoPath),
  duplex: 'half',
});
const resultado = await put.json();
if (!put.ok) throw new Error(`Falló la subida (${put.status}): ${JSON.stringify(resultado)}`);

console.log(`  ✅ videoId=${resultado.id} · privacyStatus real=${resultado.status?.privacyStatus} · uploadStatus=${resultado.status?.uploadStatus}`);
await registrarPublicacion({
  pieza: tema,
  plataformas: ['youtube'],
  slides: 1,
  urls: { youtube: `https://youtube.com/shorts/${resultado.id}` },
});
