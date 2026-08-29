/**
 * Publica manualmente un reel ya renderizado y deployado, fuera de su fecha
 * programada en social/feed-programacion.json (esa fecha no se toca).
 *
 *   node scripts/social/publicar-reel-manual.mjs que-es-la-hipermetropia            → PRUEBA
 *   node scripts/social/publicar-reel-manual.mjs que-es-la-hipermetropia --instagram
 *
 * Mismo criterio de hashtags y bitácora que /api/cron/social-feed (rama de reel),
 * pero llamado a mano y sin depender de que la fecha de hoy coincida.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './identidad.mjs';
import { registrarPublicacion } from './bitacora.mjs';

const [, , tema, ...flags] = process.argv;
const instagram = flags.includes('--instagram');
if (!tema) throw new Error('Uso: publicar-reel-manual.mjs <tema> [--instagram]');

const API = 'https://graph.facebook.com/v21.0';
const BASE_PUBLICA = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';

async function graph(metodo, ruta, params = {}, token) {
    const url = new URL(`${API}${ruta}`);
    const body = new URLSearchParams({ ...params, access_token: token });
    const res = metodo === 'GET'
        ? await fetch(`${url}?${body}`, { signal: AbortSignal.timeout(30000) })
        : await fetch(url, { method: 'POST', body, signal: AbortSignal.timeout(60000) });
    const json = await res.json().catch(() => ({}));
    if (json.error) throw new Error(json.error.message || 'error de Meta');
    return json;
}

const def = JSON.parse(await readFile(path.join(RAIZ, 'social', 'contenido', 'reels', `${tema}.json`), 'utf-8'));
const tablas = JSON.parse(await readFile(path.join(RAIZ, 'social', 'seo-hashtags.json'), 'utf-8'));

const temasDeReel = (def.temas || []).flatMap(t => tablas.porTema?.[t] || []);
const tags = [...new Set([
    ...temasDeReel.slice(0, 3),
    ...(tablas.salud || []).slice(0, 2),
    ...(tablas.base || []),
    ...temasDeReel.slice(3),
])].slice(0, 8).map(h => `#${h}`).join(' ');
const caption = `${String(def.copy || '').trim()}\n\n${tags}`;
const videoUrl = `${BASE_PUBLICA}/social/reels/${tema}.mp4`;
const thumbOffsetMs = def.coverMs ?? 0;

console.log(`\n═══ ${instagram ? 'PUBLICANDO' : 'PRUEBA (no publica nada)'} ═══`);
console.log(`Reel    : ${tema}`);
console.log(`Video   : ${videoUrl}`);
console.log(`Portada : ${thumbOffsetMs}ms`);
console.log(`\nCaption:\n${caption}\n`);
if (!instagram) { console.log('No se publicó nada.'); process.exit(0); }

const TOKEN = process.env.META_SYSTEM_USER_TOKEN;
const PAGE_ID = process.env.META_PAGE_ID;
const IG_USER_ID = process.env.META_IG_USER_ID;
if (!TOKEN || !PAGE_ID || !IG_USER_ID) throw new Error('Faltan credenciales de Meta.');

const head = await fetch(videoUrl, { method: 'HEAD', signal: AbortSignal.timeout(20000) }).catch(() => null);
if (!head?.ok) throw new Error(`El video no responde 200 (${head?.status ?? 'sin respuesta'}).`);

const tokenPagina = (await graph('GET', `/${PAGE_ID}`, { fields: 'access_token' }, TOKEN)).access_token;
if (!tokenPagina) throw new Error('La Página no devolvió token de acceso.');

const contenedor = await graph('POST', `/${IG_USER_ID}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption,
    thumb_offset: String(Math.max(0, Math.round(thumbOffsetMs))),
}, tokenPagina);

let listo = false;
for (let i = 0; i < 100; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const estado = await graph('GET', `/${contenedor.id}`, { fields: 'status_code' }, tokenPagina);
    if (estado.status_code === 'FINISHED') { listo = true; break; }
    if (estado.status_code === 'ERROR') throw new Error('Instagram no pudo procesar el video del reel.');
}
if (!listo) throw new Error('El reel no terminó de procesarse en 5 minutos.');

const pub = await graph('POST', `/${IG_USER_ID}/media_publish`, { creation_id: contenedor.id }, tokenPagina);
console.log(`✅ Publicado. Instagram media id: ${pub.id}`);
await registrarPublicacion({ pieza: `reel-${tema}`, plataformas: ['Instagram (reel)'], slides: 1, urls: { instagram: pub.id } });
