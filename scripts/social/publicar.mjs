/**
 * Publica una pieza en Facebook y en Instagram: los carruseles al feed y las
 * piezas 9:16 como STORY en las dos plataformas.
 *
 *   node scripts/social/publicar.mjs social/contenido/armazones-destacados.json            → PRUEBA
 *   node scripts/social/publicar.mjs social/contenido/armazones-destacados.json --facebook
 *   node scripts/social/publicar.mjs social/contenido/armazones-destacados.json --facebook --instagram
 *   node scripts/social/publicar.mjs social/contenido/story-700-resenas.json --facebook --instagram
 *
 * NADA SE PUBLICA SIN QUE UNA PERSONA LO APRUEBE. Sin `--facebook` ni
 * `--instagram` el script muestra exactamente qué haría y no toca nada. Suena
 * obvio hasta que algo se publica con un error de tipeo en la cuenta del negocio,
 * que es la línea comercial de la óptica y no tiene cuenta de pruebas.
 *
 * Las cuatro reglas de abajo se descubren perdiendo una tarde cada una; están
 * documentadas en docs/plan-publicacion-meta.md.
 */
// Sin esto, las credenciales del .env no llegan y el script aborta con
// "Faltan META_SYSTEM_USER_TOKEN o META_PAGE_ID" aunque estén cargadas — que es
// exactamente lo que pasó en la primera publicación real. meta-check.mjs sí lo
// importaba, así que el diagnóstico daba todo OK y el publicador fallaba: el
// peor combo posible, porque el chequeo decía que estaba todo bien.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from './identidad.mjs';
import { registrarPublicacion } from './bitacora.mjs';
import { captionConHashtags, altDeSlide } from './seo.mjs';
import { leerResenasConocidas, resolverPiezaResenas } from './resenas.mjs';

const API = 'https://graph.facebook.com/v21.0';
const BASE_PUBLICA = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';

/**
 * Etiqueta con UTMs los links propios de un texto, para que la visita se pueda
 * separar del tráfico pago en la analítica (`utm_source`/`utm_medium` los lee
 * `src/lib/client-analytics.ts` y terminan en la tabla de fuentes del panel).
 *
 * Se aplica SOLO al texto que va a Facebook, a propósito: en Facebook el link
 * es clickeable y el parámetro viaja; en Instagram el epígrafe no linkea nada,
 * así que un `?utm_source=…` colgando de la URL sería ruido que la persona
 * tiene que tipear a mano. Las stories ni siquiera llevan epígrafe.
 *
 * `utm_medium=social` (no "organico") porque es el valor que GA4 agrupa como
 * Organic Social; uno inventado cae en "Unassigned" y no sirve para nada.
 */
function conUtm(texto, campania) {
    if (!texto) return texto;
    const dominio = BASE_PUBLICA.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const patron = new RegExp(`https?://${dominio.replace(/\./g, '\\.')}[^\\s)]*`, 'g');
    return texto.replace(patron, (url) => {
        if (url.includes('utm_')) return url;
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}utm_source=facebook&utm_medium=social&utm_campaign=${encodeURIComponent(campania)}`;
    });
}

const paso = (t) => console.log(`\n▶ ${t}`);
const ok = (t) => console.log(`  ✅ ${t}`);
const info = (t) => console.log(`  ·  ${t}`);

async function graph(metodo, ruta, params = {}, token) {
    const url = new URL(`${API}${ruta}`);
    const body = new URLSearchParams({ ...params, access_token: token });
    const res = metodo === 'GET'
        ? await fetch(`${url}?${body}`, { signal: AbortSignal.timeout(30000) })
        : await fetch(url, { method: 'POST', body, signal: AbortSignal.timeout(60000) });

    const json = await res.json().catch(() => ({}));
    if (json.error) {
        throw new Error(`${json.error.message}${json.error.error_user_msg ? ` — ${json.error.error_user_msg}` : ''}`);
    }
    return json;
}

/**
 * REGLA 1: las dos plataformas exigen el token de PÁGINA, no el del usuario del
 * sistema. Se deriva en cada corrida y NO se guarda en el .env: así hay una sola
 * credencial que rotar, no dos.
 * Si se saltea, Meta responde: "Unpublished posts must be posted to a page as
 * the page itself" — un error que no sugiere la solución.
 */
async function tokenDePagina(pageId, tokenSistema) {
    const r = await graph('GET', `/${pageId}`, { fields: 'access_token' }, tokenSistema);
    if (!r.access_token) throw new Error('La Página no devolvió token. Correr scripts/social/meta-check.mjs.');
    return r.access_token;
}

/** REGLA 4 (parte): las URLs tienen que responder 200 ANTES de crear nada. */
async function verificarUrls(urls) {
    for (const url of urls) {
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(20000) }).catch(() => null);
        if (!res?.ok) {
            throw new Error(
                `La imagen ${url} no responde 200 (${res?.status || 'sin respuesta'}). ` +
                `Instagram la descarga desde sus servidores: si no está publicada, el carrusel sale a medias.`
            );
        }
        const tipo = res.headers.get('content-type') || '';
        if (!tipo.includes('jpeg')) {
            throw new Error(`${url} responde "${tipo}". Instagram rechaza un PNG renombrado: tiene que ser JPEG real.`);
        }
    }
    ok(`${urls.length} imagen(es) accesibles y en JPEG`);
}

/**
 * REGLA 2: Facebook, carrusel en UNA sola entrada.
 * Publicar las fotos directamente haría N entradas separadas en el muro.
 */
async function publicarEnFacebook(pageId, tokenPagina, jpgs, mensaje) {
    const ids = [];
    for (const [i, ruta] of jpgs.entries()) {
        const form = new FormData();
        form.append('source', new Blob([await readFile(ruta)], { type: 'image/jpeg' }), path.basename(ruta));
        form.append('published', 'false');
        form.append('access_token', tokenPagina);

        const res = await fetch(`${API}/${pageId}/photos`, { method: 'POST', body: form, signal: AbortSignal.timeout(90000) });
        const json = await res.json();
        if (json.error) throw new Error(`Foto ${i + 1}: ${json.error.message}`);
        ids.push(json.id);
        info(`foto ${i + 1}/${jpgs.length} subida`);
    }

    const params = { message: mensaje };
    ids.forEach((id, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
    const post = await graph('POST', `/${pageId}/feed`, params, tokenPagina);
    ok(`Facebook publicado: ${post.id}`);
    return post.id;
}

/**
 * Historia de PÁGINA de Facebook: dos pasos con el mismo token de Página.
 *
 * La placa se sube como foto SIN publicar (`published=false`, así no aparece
 * en el muro) y con ese `photo_id` se crea la historia vía `/photo_stories`.
 * Hasta acá llegaba el rechazo de antes: lo único implementado era el feed,
 * que espera 4:5 y habría mostrado la placa 9:16 cortada. La historia es el
 * formato nativo del 9:16, igual que en Instagram.
 *
 * Como la de Instagram, NO lleva epígrafe: el texto tiene que estar dentro de
 * la placa. Dura 24 horas y cuenta como actividad en la bitácora.
 */
async function publicarStoryEnFacebook(pageId, tokenPagina, ruta) {
    const form = new FormData();
    form.append('source', new Blob([await readFile(ruta)], { type: 'image/jpeg' }), path.basename(ruta));
    form.append('published', 'false');
    form.append('access_token', tokenPagina);

    const res = await fetch(`${API}/${pageId}/photos`, { method: 'POST', body: form, signal: AbortSignal.timeout(90000) });
    const json = await res.json();
    if (json.error) throw new Error(`Subiendo la placa: ${json.error.message}`);
    info('placa subida (sin publicar en el muro)');

    const story = await graph('POST', `/${pageId}/photo_stories`, { photo_id: json.id }, tokenPagina);
    const id = story.post_id || story.id || json.id;
    ok(`Story publicada en Facebook: ${id}`);
    return id;
}

/**
 * Instagram Stories: otro `media_type`, una sola imagen y SIN caption.
 *
 * La story no acepta epígrafe: el texto tiene que estar dentro de la imagen.
 * Por eso las piezas 9:16 llevan la información en la placa y no en el pie —
 * si esto no se supiera, saldría una story muda con el dato en un caption que
 * nadie ve.
 *
 * Dura 24 horas. No se registra distinto en la bitácora a propósito: una story
 * publicada también cuenta como actividad para el aviso de cadencia.
 */
async function publicarStoryEnInstagram(igUserId, tokenPagina, url) {
    const c = await graph('POST', `/${igUserId}/media`,
        { image_url: url, media_type: 'STORIES' }, tokenPagina);

    let listo = false;
    for (let intento = 0; intento < 30; intento++) {
        await new Promise(r => setTimeout(r, 3000));
        const estado = await graph('GET', `/${c.id}`, { fields: 'status_code' }, tokenPagina);
        if (estado.status_code === 'FINISHED') { listo = true; break; }
        if (estado.status_code === 'ERROR') throw new Error('Instagram no pudo procesar la story.');
    }
    if (!listo) throw new Error('La story no terminó de procesarse en 90 segundos.');

    const pub = await graph('POST', `/${igUserId}/media_publish`, { creation_id: c.id }, tokenPagina);
    ok(`Story publicada en Instagram: ${pub.id}`);
    return pub.id;
}

/**
 * REGLA 3: Instagram, cuatro pasos y una espera.
 * El contenedor se procesa en segundo plano; publicar antes de que termine falla.
 */
async function publicarEnInstagram(igUserId, tokenPagina, urls, mensaje, alts = []) {
    const hijos = [];
    for (const [i, url] of urls.entries()) {
        // alt_text: lo lee el buscador interno de Instagram y lo lee un lector
        // de pantalla. En estas piezas el texto ES el contenido, así que
        // describir la placa describe la publicación.
        const params = { image_url: url, is_carousel_item: 'true' };
        if (alts[i]) params.alt_text = alts[i];
        const c = await graph('POST', `/${igUserId}/media`, params, tokenPagina);
        hijos.push(c.id);
        info(`contenedor ${i + 1}/${urls.length}`);
    }

    const carrusel = await graph('POST', `/${igUserId}/media`,
        { media_type: 'CAROUSEL', children: hijos.join(','), caption: mensaje }, tokenPagina);

    // La espera no es opcional.
    let listo = false;
    for (let intento = 0; intento < 30; intento++) {
        await new Promise(r => setTimeout(r, 3000));
        const estado = await graph('GET', `/${carrusel.id}`, { fields: 'status_code' }, tokenPagina);
        if (estado.status_code === 'FINISHED') { listo = true; break; }
        if (estado.status_code === 'ERROR') throw new Error('Instagram no pudo procesar el carrusel.');
    }
    if (!listo) throw new Error('El carrusel no terminó de procesarse en 90 segundos.');

    const pub = await graph('POST', `/${igUserId}/media_publish`, { creation_id: carrusel.id }, tokenPagina);
    ok(`Instagram publicado: ${pub.id}`);
    return pub.id;
}

export async function publicar(rutaJson, { facebook = false, instagram = false } = {}) {
    const pieza = JSON.parse(await readFile(rutaJson, 'utf-8'));

    // Reseñas: si la pieza declara el número por plantilla (ver resenas.mjs),
    // se resuelve acá en memoria para que el epígrafe salga con el último dato
    // conocido aunque el campo horneado del JSON haya quedado atrás.
    resolverPiezaResenas(pieza, await leerResenasConocidas());

    const carpeta = path.join(RAIZ, 'public', 'social', pieza.id);

    const jpgs = (pieza.slides || []).map((_, i) =>
        path.join(carpeta, `${String(i + 1).padStart(2, '0')}.jpg`));
    const faltan = jpgs.filter(f => !existsSync(f));
    if (faltan.length) {
        throw new Error(
            `Faltan ${faltan.length} imagen(es). Renderizar primero:\n` +
            `  node scripts/social/render.mjs ${path.relative(RAIZ, rutaJson)}`
        );
    }

    const urls = jpgs.map(f => `${BASE_PUBLICA}/social/${pieza.id}/${path.basename(f)}`);
    const textoBase = pieza.caption || pieza.slides[0]?.title?.replace(/\*/g, '') || '';
    const mensaje = captionConHashtags(pieza, textoBase);
    // Solo Facebook: ver la nota de `conUtm`.
    const mensajeFacebook = conUtm(mensaje, pieza.id);
    const alts = (pieza.slides || []).map(s => altDeSlide(s, pieza));

    // Una pieza 9:16 es una story: en las DOS plataformas se publica por el
    // endpoint de historias y no lleva epígrafe. Se decide por el formato
    // declarado, no por la cantidad de slides, para que quede explícito en el
    // JSON qué se está publicando. Al FEED una 9:16 no va nunca — lo mostraría
    // cortada (el feed espera 4:5) — por eso abajo el destino de Facebook se
    // bifurca ANTES de tocar el feed.
    const esStory = pieza.format === '9:16';
    if (esStory && jpgs.length > 1) {
        throw new Error(
            `La pieza "${pieza.id}" es 9:16 con ${jpgs.length} placas. Una story se publica de a una: ` +
            `dejar una sola slide, o separarla en varias piezas.`
        );
    }

    const seco = !facebook && !instagram;
    const rotulo = (nombre) => (esStory ? `${nombre} (story)` : nombre);

    console.log(`\n═══ ${seco ? 'PRUEBA (no publica nada)' : 'PUBLICANDO'} ═══`);
    console.log(`Pieza    : ${pieza.id}`);
    console.log(`Slides   : ${jpgs.length}`);
    console.log(`Destino  : ${[facebook && rotulo('Facebook'), instagram && rotulo('Instagram')].filter(Boolean).join(' + ') || '(ninguno)'}`);
    if (esStory) {
        console.log('\n(story: sin epígrafe — el texto va dentro de la placa)');
    } else {
        console.log(`\nTexto que acompaña:\n  "${mensaje}"`);
        if (mensajeFacebook !== mensaje) {
            console.log(`\nEn Facebook, con UTMs:\n  "${mensajeFacebook}"`);
        }
    }
    console.log('\nImágenes:');
    urls.forEach(u => console.log(`  ${u}`));

    if (seco) {
        console.log('\nNo se publicó nada. Para publicar de verdad, agregar --facebook y/o --instagram.');
        if (esStory) {
            console.log('(9:16: con --facebook sale como HISTORIA de la página — nunca al feed —; con --instagram, como story.)');
        }
        return { ok: true, seco: true };
    }

    const TOKEN = process.env.META_SYSTEM_USER_TOKEN;
    const PAGE_ID = process.env.META_PAGE_ID;
    const IG_USER_ID = process.env.META_IG_USER_ID;
    if (!TOKEN || !PAGE_ID) {
        throw new Error('Faltan META_SYSTEM_USER_TOKEN o META_PAGE_ID. Correr scripts/social/meta-check.mjs.');
    }

    paso('Verificando que las imágenes estén publicadas');
    await verificarUrls(urls);

    paso('Derivando el token de Página');
    const tokenPagina = await tokenDePagina(PAGE_ID, TOKEN);
    ok('Token de Página obtenido (no se guarda)');

    const resultado = { pieza: pieza.id, plataformas: [], slides: jpgs.length, urls: {} };

    if (facebook) {
        if (esStory) {
            // El guard del feed, ahora como bifurcación: una 9:16 va a la
            // HISTORIA de la página, jamás al feed (saldría cortada).
            paso('Publicando story en Facebook');
            resultado.urls.facebook = await publicarStoryEnFacebook(PAGE_ID, tokenPagina, jpgs[0]);
            resultado.plataformas.push('Facebook (story)');
        } else {
            paso('Publicando en Facebook');
            resultado.urls.facebook = await publicarEnFacebook(PAGE_ID, tokenPagina, jpgs, mensajeFacebook);
            resultado.plataformas.push('Facebook');
        }
    }

    if (instagram) {
        if (!IG_USER_ID) throw new Error('Falta META_IG_USER_ID.');
        if (esStory) {
            paso('Publicando story en Instagram');
            resultado.urls.instagram = await publicarStoryEnInstagram(IG_USER_ID, tokenPagina, urls[0]);
            resultado.plataformas.push('Instagram (story)');
        } else {
            paso('Publicando en Instagram');
            resultado.urls.instagram = await publicarEnInstagram(IG_USER_ID, tokenPagina, urls, mensaje, alts);
            resultado.plataformas.push('Instagram');
        }
    }

    // Queda registrado para el aviso diario de cadencia (Etapa 6).
    await registrarPublicacion(resultado);
    console.log('\n✅ Publicado y registrado en la bitácora.');
    return { ok: true, ...resultado };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    const ruta = args.find(a => !a.startsWith('--'));
    if (!ruta) {
        console.error('Falta la pieza.\n  node scripts/social/publicar.mjs social/contenido/armazones-destacados.json');
        process.exit(1);
    }
    try {
        await publicar(path.resolve(ruta), {
            facebook: args.includes('--facebook'),
            instagram: args.includes('--instagram'),
        });
    } catch (e) {
        console.error(`\n❌ ${e.message}`);
        process.exit(1);
    }
}
