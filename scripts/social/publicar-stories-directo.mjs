#!/usr/bin/env node
/**
 * Sube stories a Instagram A MANO, fuera del cron, desde las placas ya
 * deployadas en producción (public/social/<pieza>/NN.jpg).
 *
 *   node scripts/social/publicar-stories-directo.mjs story-agos-sirio-c1 story-agos-monaco-c2:4
 *   node scripts/social/publicar-stories-directo.mjs --lista lista.txt --instagram
 *
 * Sin `--instagram` SOLO muestra qué subiría (regla del proyecto: nada se
 * publica sin pedirlo). `pieza:N` sube solo la slide N; sin `:N` sube todas
 * las que la pieza declara en social/contenido/<pieza>.json.
 *
 * PARA QUÉ EXISTE (3/10/2026): el 29/9 se subieron a mano las fotos de
 * Agostina para armar los destacados y el tope de Instagram (100
 * publicaciones por 24 h) dejó 47 afuera. Este script completa esas tandas:
 * Ishtar las pasa a destacados desde el celular, que es lo único que no se
 * puede hacer por API.
 *
 * REGLAS QUE APRENDIMOS A LOS GOLPES:
 * - Mira el cupo ANTES de empezar (`content_publishing_limit`) y no arranca
 *   si no entra todo: media tanda en destacados es peor que ninguna.
 * - Corta en el PRIMER rechazo. El 29/9 el loop siguió intentando tras el
 *   primer error y sumó 3 rechazos de más a la cuenta.
 * - Una por vez, con pausa: dos publicaciones simultáneas contra la misma
 *   cuenta es la forma más rápida de que Meta limite (ver
 *   [[meta-api-pocas-llamadas]] en la memoria del proyecto).
 * - Las stories NO se borran por API: lo que sale, lo borra Ishtar a mano.
 * - Instagram no acepta bytes: descarga una URL pública. Por eso solo sirve
 *   lo que ya está deployado, y se verifica que responda 200 image/jpeg antes.
 * - Nunca imprime el token.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const API = 'https://graph.facebook.com/v21.0';
const ORIGEN = process.env.STORE_ORIGIN || 'https://atelieroptica.com.ar';

// .env a mano para no depender de dotenv.
if (existsSync(path.join(RAIZ, '.env'))) {
    for (const linea of readFileSync(path.join(RAIZ, '.env'), 'utf-8').split('\n')) {
        const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
}
const TOKEN = process.env.META_SYSTEM_USER_TOKEN, PAGE_ID = process.env.META_PAGE_ID, IG = process.env.META_IG_USER_ID;
if (!TOKEN || !PAGE_ID || !IG) { console.error('Faltan META_SYSTEM_USER_TOKEN / META_PAGE_ID / META_IG_USER_ID.'); process.exit(1); }

const args = process.argv.slice(2);
const PUBLICAR = args.includes('--instagram');
let pedidas = args.filter(a => !a.startsWith('--'));
const iLista = args.indexOf('--lista');
if (iLista >= 0) pedidas = pedidas.concat(readFileSync(args[iLista + 1], 'utf-8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')));
pedidas = pedidas.filter(p => iLista < 0 || p !== args[iLista + 1]);
if (!pedidas.length) { console.error('Decime qué piezas subir (ids, o --lista archivo).'); process.exit(1); }

// Expandir pieza → slides.
const slides = [];
for (const p of pedidas) {
    const [id, n] = p.split(':');
    let cuantas;
    if (n) cuantas = [Number(n)];
    else {
        const json = JSON.parse(readFileSync(path.join(RAIZ, 'social', 'contenido', `${id}.json`), 'utf-8'));
        cuantas = json.slides.map((_, i) => i + 1);
    }
    for (const k of cuantas) slides.push({ id, k, url: `${ORIGEN}/social/${id}/${String(k).padStart(2, '0')}.jpg` });
}

async function graph(metodo, ruta, params, token) {
    const body = new URLSearchParams({ ...params, access_token: token });
    const res = metodo === 'GET'
        ? await fetch(`${API}${ruta}?${body}`, { signal: AbortSignal.timeout(30000) })
        : await fetch(`${API}${ruta}`, { method: 'POST', body, signal: AbortSignal.timeout(60000) });
    const json = await res.json().catch(() => ({}));
    if (json.error) throw new Error(String(json.error.message || 'error de Meta').slice(0, 300));
    return json;
}
const espera = (ms) => new Promise(r => setTimeout(r, ms));

// 1. Cupo.
const cupo = await graph('GET', `/${IG}/content_publishing_limit`, { fields: 'quota_usage,config' }, TOKEN);
const usado = cupo.data?.[0]?.quota_usage ?? 0, total = cupo.data?.[0]?.config?.quota_total ?? 100;
console.log(`Cupo de Instagram: ${usado} usadas de ${total} en 24 h. A subir: ${slides.length}.`);
if (usado + slides.length > total) {
    console.error(`No entran: quedan ${total - usado}. No se sube media tanda.`);
    process.exit(2);
}

// 2. Que todas las imágenes existan en producción ANTES de subir la primera.
for (const s of slides) {
    const r = await fetch(s.url, { method: 'HEAD', signal: AbortSignal.timeout(20000) }).catch(() => null);
    const tipo = r?.headers.get('content-type') || '';
    if (!r?.ok || !tipo.includes('jpeg')) { console.error(`✗ ${s.url} → ${r?.status ?? 'sin respuesta'} ${tipo}. ¿Está deployado?`); process.exit(3); }
}
console.log(`Las ${slides.length} imágenes responden en producción.`);

if (!PUBLICAR) {
    console.log('\nSOLO MUESTRA (sin --instagram). Subiría, en este orden:');
    for (const s of slides) console.log(`  ${s.id} #${s.k}`);
    process.exit(0);
}

// 3. Subir, una por vez, y cortar en el primer rechazo.
const tokenPagina = (await graph('GET', `/${PAGE_ID}`, { fields: 'access_token' }, TOKEN)).access_token;
let subidas = 0;
for (const s of slides) {
    try {
        const cont = await graph('POST', `/${IG}/media`, { image_url: s.url, media_type: 'STORIES' }, tokenPagina);
        let listo = false;
        for (let i = 0; i < 30; i++) {
            await espera(3000);
            const e = await graph('GET', `/${cont.id}`, { fields: 'status_code' }, tokenPagina);
            if (e.status_code === 'FINISHED') { listo = true; break; }
            if (e.status_code === 'ERROR') throw new Error('Instagram no pudo procesar la story.');
        }
        if (!listo) throw new Error('No terminó de procesarse en 90 s.');
        const pub = await graph('POST', `/${IG}/media_publish`, { creation_id: cont.id }, tokenPagina);
        subidas++;
        console.log(`✅ ${subidas}/${slides.length} ${s.id} #${s.k} → ${pub.id}`);
        await espera(4000);
    } catch (e) {
        console.error(`✗ ${s.id} #${s.k}: ${e.message}`);
        console.error(`Corto acá: ${subidas} subidas, ${slides.length - subidas} sin subir (desde ${s.id} #${s.k}).`);
        process.exit(4);
    }
}
console.log(`Listo: ${subidas} stories subidas.`);
