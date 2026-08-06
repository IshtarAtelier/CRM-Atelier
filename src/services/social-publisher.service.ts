/**
 * Publica en Instagram desde el servidor. Hoy lo usa el cron de stories diarias.
 *
 * POR QUÉ EXISTE ADEMÁS DE scripts/social/publicar.mjs:
 *
 * El script vive en `scripts/` y hace todo el flujo manual: renderiza con
 * Playwright, valida y publica. Sirve para los carruseles del feed, que se
 * revisan uno por uno antes de salir.
 *
 * Las stories diarias no pueden depender de eso: corren en Railway, sin nadie
 * mirando, y no hace falta renderizar nada porque las placas ya están hechas y
 * commiteadas. Este service solo hace la parte de publicar.
 *
 * Deliberadamente NO renderiza en runtime. Un cron que abre un Chromium para
 * generar una imagen es un cron que va a fallar en el peor momento por memoria
 * y nadie va a entender por qué. Las placas se generan antes, se miran, se
 * commitean, y acá solo se eligen y se publican.
 */
import { BUSINESS_INFO } from '@/lib/business-info';

const API = 'https://graph.facebook.com/v21.0';

export interface ResultadoStory {
    ok: boolean;
    storyId?: string;
    pieza: string;
    url: string;
    error?: string;
}

async function graph(
    metodo: 'GET' | 'POST',
    ruta: string,
    params: Record<string, string>,
    token: string,
): Promise<any> {
    const body = new URLSearchParams({ ...params, access_token: token });
    const res = metodo === 'GET'
        ? await fetch(`${API}${ruta}?${body}`, { signal: AbortSignal.timeout(30000) })
        : await fetch(`${API}${ruta}`, { method: 'POST', body, signal: AbortSignal.timeout(60000) });

    const json = await res.json().catch(() => ({}));
    if (json.error) {
        // El mensaje de Meta nunca incluye el token, pero se recorta igual por
        // las dudas: este texto termina en un mail y en los logs de Railway.
        const msg = String(json.error.message || 'error de Meta').slice(0, 300);
        throw new Error(msg);
    }
    return json;
}

/**
 * El token de Página se deriva en cada corrida y no se guarda: así hay una sola
 * credencial que rotar. Es el mismo criterio que usa scripts/social/publicar.mjs.
 */
async function tokenDePagina(pageId: string, tokenSistema: string): Promise<string> {
    const r = await graph('GET', `/${pageId}`, { fields: 'access_token' }, tokenSistema);
    if (!r.access_token) throw new Error('La Página no devolvió token de acceso.');
    return r.access_token;
}

/**
 * Publica una placa 9:16 como story de Instagram.
 *
 * La imagen la descarga Meta desde nuestro servidor, así que tiene que estar
 * publicada y ser JPEG de verdad. Se verifica antes: si no, Meta crea el
 * contenedor igual y falla más tarde con un error que no dice nada.
 */
export async function publicarStory(urlImagen: string, piezaId: string): Promise<ResultadoStory> {
    const base = { pieza: piezaId, url: urlImagen };
    try {
        const TOKEN = process.env.META_SYSTEM_USER_TOKEN;
        const PAGE_ID = process.env.META_PAGE_ID;
        const IG_USER_ID = process.env.META_IG_USER_ID;
        if (!TOKEN || !PAGE_ID || !IG_USER_ID) {
            throw new Error('Faltan credenciales de Meta (META_SYSTEM_USER_TOKEN / META_PAGE_ID / META_IG_USER_ID).');
        }

        const head = await fetch(urlImagen, { method: 'HEAD', signal: AbortSignal.timeout(20000) })
            .catch(() => null);
        if (!head?.ok) {
            throw new Error(`La imagen no responde 200 (${head?.status ?? 'sin respuesta'}). ¿Se deployó?`);
        }
        if (!(head.headers.get('content-type') || '').includes('jpeg')) {
            throw new Error('La imagen no es JPEG real. Instagram rechaza un PNG renombrado.');
        }

        const tokenPagina = await tokenDePagina(PAGE_ID, TOKEN);

        const contenedor = await graph('POST', `/${IG_USER_ID}/media`,
            { image_url: urlImagen, media_type: 'STORIES' }, tokenPagina);

        // El contenedor se procesa en segundo plano. Publicar antes de que
        // termine falla, así que se espera el status_code.
        let listo = false;
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const estado = await graph('GET', `/${contenedor.id}`, { fields: 'status_code' }, tokenPagina);
            if (estado.status_code === 'FINISHED') { listo = true; break; }
            if (estado.status_code === 'ERROR') throw new Error('Instagram no pudo procesar la story.');
        }
        if (!listo) throw new Error('La story no terminó de procesarse en 90 segundos.');

        const pub = await graph('POST', `/${IG_USER_ID}/media_publish`,
            { creation_id: contenedor.id }, tokenPagina);

        return { ok: true, storyId: pub.id, ...base };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Error desconocido', ...base };
    }
}

/** El origen público desde donde Meta descarga las placas. */
export function origenPublico(): string {
    return process.env.NEXT_PUBLIC_APP_URL || `https://${BUSINESS_INFO.websiteDisplay}`;
}

export interface ResultadoCarrusel {
    ok: boolean;
    pieza: string;
    facebookId?: string;
    instagramId?: string;
    error?: string;
}

/**
 * Publica un carrusel en Facebook e Instagram desde el servidor.
 *
 * Es el mismo contrato que scripts/social/publicar.mjs (la versión manual),
 * con UNA diferencia deliberada: las fotos de Facebook se suben por URL
 * (`url:`) y no por bytes. En el server no hay working tree garantizado, pero
 * las placas SÍ están publicadas en /public — que es exactamente lo que
 * Instagram ya exige. Una sola fuente para las dos plataformas.
 */
export async function publicarCarrusel(
    piezaId: string,
    urls: string[],
    caption: string,
    alts: string[] = [],
): Promise<ResultadoCarrusel> {
    try {
        const TOKEN = process.env.META_SYSTEM_USER_TOKEN;
        const PAGE_ID = process.env.META_PAGE_ID;
        const IG_USER_ID = process.env.META_IG_USER_ID;
        if (!TOKEN || !PAGE_ID || !IG_USER_ID) {
            throw new Error('Faltan credenciales de Meta.');
        }

        // Las URLs tienen que responder 200 y ser JPEG ANTES de crear nada:
        // Meta las descarga de nuestro server, y si una falta el carrusel sale
        // a medias con un error que no dice nada.
        for (const u of urls) {
            const head = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(20000) }).catch(() => null);
            if (!head?.ok) throw new Error(`${u} no responde 200 (${head?.status ?? 'sin respuesta'}). ¿Se deployó?`);
            if (!(head.headers.get('content-type') || '').includes('jpeg')) {
                throw new Error(`${u} no es JPEG real.`);
            }
        }

        const tokenPagina = await tokenDePagina(PAGE_ID, TOKEN);

        // ── Facebook: N fotos sin publicar + una entrada que las junta ──────
        const fbIds: string[] = [];
        for (const u of urls) {
            const foto = await graph('POST', `/${PAGE_ID}/photos`,
                { url: u, published: 'false' }, tokenPagina);
            fbIds.push(foto.id);
        }
        const fbParams: Record<string, string> = { message: caption };
        fbIds.forEach((id, i) => { fbParams[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
        const post = await graph('POST', `/${PAGE_ID}/feed`, fbParams, tokenPagina);

        // ── Instagram: contenedores hijos + carrusel + espera + publish ─────
        const hijos: string[] = [];
        for (const [i, u] of urls.entries()) {
            const params: Record<string, string> = { image_url: u, is_carousel_item: 'true' };
            if (alts[i]) params.alt_text = alts[i];
            const c = await graph('POST', `/${IG_USER_ID}/media`, params, tokenPagina);
            hijos.push(c.id);
        }
        const carrusel = await graph('POST', `/${IG_USER_ID}/media`,
            { media_type: 'CAROUSEL', children: hijos.join(','), caption }, tokenPagina);

        let listo = false;
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const estado = await graph('GET', `/${carrusel.id}`, { fields: 'status_code' }, tokenPagina);
            if (estado.status_code === 'FINISHED') { listo = true; break; }
            if (estado.status_code === 'ERROR') throw new Error('Instagram no pudo procesar el carrusel.');
        }
        if (!listo) throw new Error('El carrusel no terminó de procesarse en 90 segundos.');

        const pub = await graph('POST', `/${IG_USER_ID}/media_publish`,
            { creation_id: carrusel.id }, tokenPagina);

        return { ok: true, pieza: piezaId, facebookId: post.id, instagramId: pub.id };
    } catch (e: any) {
        return { ok: false, pieza: piezaId, error: e?.message || 'Error desconocido' };
    }
}
