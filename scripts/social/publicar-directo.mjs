/**
 * Publica un carrusel en Instagram desde JPGs LOCALES, sin deployar el sitio.
 *
 *   node scripts/social/publicar-directo.mjs social/arte-en-foco-realistas "caption" [--instagram] [--facebook]
 *
 * Instagram exige que las imágenes estén en una URL pública. `publicar.mjs` las
 * sirve desde atelieroptica.com.ar/social/… y eso obliga a deployar el sitio por
 * una publicación. Acá se evita: cada JPG se sube a la Página de Facebook como
 * foto NO publicada y a Instagram se le pasa la URL que devuelve el CDN de Meta
 * (`images[0].source`), que es pública y JPEG real. Las fotos no publicadas no
 * aparecen en el muro.
 *
 * Sin --instagram / --facebook es PRUEBA y no toca nada.
 */
import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './identidad.mjs';
import { registrarPublicacion } from './bitacora.mjs';
import { captionConHashtags } from './seo.mjs';

const API = 'https://graph.facebook.com/v21.0';
const [, , carpetaRel, captionBase = '', ...flags] = process.argv;
const instagram = flags.includes('--instagram');
const facebook = flags.includes('--facebook');
if (!carpetaRel) throw new Error('Uso: publicar-directo.mjs <carpeta> "<caption>" [--instagram] [--facebook]');

const carpeta = path.resolve(RAIZ, carpetaRel);
const jpgs = (await readdir(carpeta)).filter(f => /\.jpe?g$/i.test(f)).sort().map(f => path.join(carpeta, f));
if (!jpgs.length) throw new Error(`No hay JPGs en ${carpeta}`);

const pieza = { id: path.basename(carpeta), temas: [] };
const mensaje = captionConHashtags(pieza, captionBase);

console.log(`\n═══ ${instagram || facebook ? 'PUBLICANDO' : 'PRUEBA (no publica nada)'} ═══`);
console.log(`Carpeta : ${carpetaRel}`);
console.log(`Slides  : ${jpgs.length}`);
jpgs.forEach(j => console.log(`  ${path.basename(j)}`));
console.log(`Destino : ${[facebook && 'Facebook', instagram && 'Instagram'].filter(Boolean).join(' + ') || '(ninguno)'}`);
console.log(`\nTexto:\n${mensaje}\n`);
if (!instagram && !facebook) { console.log('No se publicó nada.'); process.exit(0); }

async function graph(metodo, ruta, params = {}, token) {
    const url = new URL(`${API}${ruta}`);
    const body = new URLSearchParams({ ...params, access_token: token });
    const res = metodo === 'GET'
        ? await fetch(`${url}?${body}`, { signal: AbortSignal.timeout(30000) })
        : await fetch(url, { method: 'POST', body, signal: AbortSignal.timeout(60000) });
    const json = await res.json().catch(() => ({}));
    if (json.error) throw new Error(`${json.error.message}${json.error.error_user_msg ? ` — ${json.error.error_user_msg}` : ''}`);
    return json;
}

const TOKEN = process.env.META_SYSTEM_USER_TOKEN;
const PAGE_ID = process.env.META_PAGE_ID;
const IG_USER_ID = process.env.META_IG_USER_ID;
if (!TOKEN || !PAGE_ID) throw new Error('Faltan META_SYSTEM_USER_TOKEN o META_PAGE_ID.');

const { access_token: tokenPagina } = await graph('GET', `/${PAGE_ID}`, { fields: 'access_token' }, TOKEN);
console.log('✅ Token de Página obtenido');

// Subida a la Página como fotos NO publicadas → id + URL pública en el CDN.
const fotos = [];
for (const [i, ruta] of jpgs.entries()) {
    const form = new FormData();
    form.append('source', new Blob([await readFile(ruta)], { type: 'image/jpeg' }), path.basename(ruta));
    form.append('published', 'false');
    form.append('access_token', tokenPagina);
    const res = await fetch(`${API}/${PAGE_ID}/photos`, { method: 'POST', body: form, signal: AbortSignal.timeout(90000) });
    const json = await res.json();
    if (json.error) throw new Error(`Foto ${i + 1}: ${json.error.message}`);
    const meta = await graph('GET', `/${json.id}`, { fields: 'images' }, tokenPagina);
    const url = meta.images?.[0]?.source;
    if (!url) throw new Error(`Foto ${i + 1}: el CDN no devolvió URL`);
    fotos.push({ id: json.id, url });
    console.log(`  · foto ${i + 1}/${jpgs.length} subida`);
}

const resultado = { pieza: pieza.id, plataformas: [], slides: jpgs.length, urls: {} };

if (facebook) {
    const params = { message: mensaje };
    fotos.forEach((f, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: f.id }); });
    const post = await graph('POST', `/${PAGE_ID}/feed`, params, tokenPagina);
    console.log(`✅ Facebook publicado: ${post.id}`);
    resultado.urls.facebook = post.id; resultado.plataformas.push('Facebook');
}

if (instagram) {
    if (!IG_USER_ID) throw new Error('Falta META_IG_USER_ID.');
    const hijos = [];
    for (const [i, f] of fotos.entries()) {
        const c = await graph('POST', `/${IG_USER_ID}/media`, { image_url: f.url, is_carousel_item: 'true' }, tokenPagina);
        hijos.push(c.id);
        console.log(`  · contenedor IG ${i + 1}/${fotos.length}`);
    }
    const carrusel = await graph('POST', `/${IG_USER_ID}/media`,
        { media_type: 'CAROUSEL', children: hijos.join(','), caption: mensaje }, tokenPagina);
    let listo = false;
    for (let n = 0; n < 30; n++) {
        await new Promise(r => setTimeout(r, 3000));
        const e = await graph('GET', `/${carrusel.id}`, { fields: 'status_code' }, tokenPagina);
        if (e.status_code === 'FINISHED') { listo = true; break; }
        if (e.status_code === 'ERROR') throw new Error('Instagram no pudo procesar el carrusel.');
    }
    if (!listo) throw new Error('El carrusel no terminó de procesarse en 90 s.');
    const pub = await graph('POST', `/${IG_USER_ID}/media_publish`, { creation_id: carrusel.id }, tokenPagina);
    console.log(`✅ Instagram publicado: ${pub.id}`);
    resultado.urls.instagram = pub.id; resultado.plataformas.push('Instagram');
}

await registrarPublicacion(resultado);
console.log('\n✅ Publicado y registrado en la bitácora.');
