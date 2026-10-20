import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/db';
import { publicarCarrusel, publicarReel, origenPublico } from '@/services/social-publisher.service';
import { evaluarFrescura } from '@/lib/social/frescura';
import { modeloDelDia, tocaHoy } from '@/lib/social/modelo-del-dia';

/**
 * Publica en el feed de Facebook + Instagram. Dos cosas, según `?que=`:
 *
 *   ?que=programada (o sin `que`)  → el carrusel o reel del día, según
 *       `social/feed-programacion.json`, fecha por fecha. Si hoy no figura,
 *       responde "sin programación" y no toca nada — por eso puede correr
 *       todos los días sin pensar en martes/jueves/sábado. 11:00 ART.
 *
 *   ?que=modelo → el MODELO DEL DÍA: un carrusel de 2 slides (frente, perfil)
 *       con las fotos de Agostina o de Massaru, alternados día por medio,
 *       según `social/feed-modelos.json` (Ishtar, 16/10/2026: "lanzá en feed
 *       alternados imágenes de Agostina frente/perfil y alternadas de
 *       Massaru"). El cron corre todos los días a las 17:00 ART pero publica
 *       solo los días de `dias` del JSON (por defecto los lunes: "por lo menos
 *       un carrusel por semana, pero no todos juntos", Ishtar 19/10/2026), y
 *       nunca si ese día ya hay algo programado en feed-programacion.json.
 *       La elección es determinística (ver `modeloDelDia`): se sabe de
 *       antemano qué sale mañana y un problema se puede reproducir.
 *
 * Los dispara `.github/workflows/social-crons.yml`.
 *
 * NO PUBLICA DOS VECES: antes de publicar mira la bitácora. Si la pieza ya
 * aparece en los últimos 7 días (la publicó una persona a mano, o el cron
 * corrió dos veces), se salta. Un cron de publicación sin dedup termina,
 * tarde o temprano, con el mismo carrusel dos veces en el muro.
 *
 * SI FALLA, QUEDA EN EL LOG Y NO REINTENTA (sin mail: Ishtar, 7/9/2026).
 */

const CLAVE_BITACORA = 'social_publicaciones';
const ART_OFFSET_MS = 3 * 60 * 60 * 1000;

function hoyART(): string {
    const d = new Date(Date.now() - ART_OFFSET_MS);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Cuántos días completos pasaron desde el 1/1/2026, en hora argentina (igual que las stories). */
function diasDesdeElOrigen(): number {
    const hoy = new Date(Date.now() - ART_OFFSET_MS);
    const dias = Math.floor(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()) / 86400000);
    return dias - Math.floor(Date.UTC(2026, 0, 1) / 86400000);
}

async function leerBitacora(): Promise<any[]> {
    const fila = await prisma.systemSetting.findUnique({ where: { key: CLAVE_BITACORA } });
    try {
        const datos = fila?.value ? JSON.parse(fila.value) : [];
        return Array.isArray(datos) ? datos : [];
    } catch { return []; }
}

async function registrarEnBitacora(entrada: Record<string, unknown>) {
    const previas = await leerBitacora();
    const value = JSON.stringify([{ ...entrada, fecha: new Date().toISOString() }, ...previas].slice(0, 60));
    await prisma.systemSetting.upsert({
        where: { key: CLAVE_BITACORA },
        update: { value },
        create: { key: CLAVE_BITACORA, value },
    });
}

function yaSalio(bitacora: any[], pieza: string): boolean {
    const hace7d = Date.now() - 7 * 86400000;
    return bitacora.some(p => p.pieza === pieza && new Date(p.fecha).getTime() >= hace7d);
}

/** El caption final: el de la pieza + hashtags de social/seo-hashtags.json. */
function armarCaption(pieza: any, tablas: any): string {
    const base: string = pieza.caption
        || pieza.slides?.[0]?.title?.replace(/\*/g, '')
        || '';
    const propios: string[] = (pieza.temas || []).flatMap((t: string) => tablas.porTema?.[t] || []);
    const tags = [...new Set([...propios, ...(tablas.base || [])])].slice(0, 12)
        .map(h => `#${h}`).join(' ');
    return tags ? `${base}\n\n.\n.\n${tags}` : base;
}

/** Alt text por slide — mismo criterio que scripts/social/seo.mjs. Una slide de foto trae el suyo. */
function altDeSlide(slide: any, piezaId: string): string {
    const limpio = (t: any) => String(t || '').replace(/\*/g, '').trim();
    if (slide.alt) return limpio(slide.alt).slice(0, 950);
    const partes = [limpio(slide.title), limpio(slide.subtitle), limpio(slide.body)].filter(Boolean);
    if (slide.items?.length) partes.push(slide.items.map(limpio).join('. '));
    if (slide.dato) partes.unshift(limpio(slide.dato));
    const texto = partes.join('. ').replace(/\.\.+/g, '.').trim() || `Publicación de Atelier Óptica: ${piezaId}`;
    return texto.length > 950 ? `${texto.slice(0, 947)}...` : texto;
}

const leerJson = async (...tramos: string[]) =>
    JSON.parse(await readFile(path.join(process.cwd(), ...tramos), 'utf-8'));

/** Publica un carrusel ya renderizado en public/social/<id>/NN.jpg. */
async function publicarPieza(piezaId: string, dryRun: boolean, extra: Record<string, unknown> = {}) {
    const bitacora = await leerBitacora();
    if (yaSalio(bitacora, piezaId)) {
        return { ok: true, motivo: `"${piezaId}" ya se publicó en los últimos 7 días.` };
    }
    const pieza = await leerJson('social', 'contenido', `${piezaId}.json`);
    const tablas = await leerJson('social', 'seo-hashtags.json');

    // GUARDA DE FRESCURA: una pieza de base con más de 10 días puede tener
    // precios que ya no rigen. Publicar un precio viejo es exactamente lo
    // que este sistema existe para impedir. La regla vive en `evaluarFrescura`
    // y NO se reimplementa acá: este cron y el de stories tienen que negarse
    // por lo mismo. Las piezas de fotos de modelo no traen precio y no vencen.
    const veredicto = evaluarFrescura(pieza);
    if (!veredicto.fresca) {
        const cuando = veredicto.dias === null ? 'fecha desconocida' : `hace ${veredicto.dias} días`;
        console.error(`[cron social-feed] Carrusel "${pieza.id}" no salió, precios de ${cuando}:`, veredicto.motivo);
        return { ok: false, pieza: pieza.id, motivo: `${veredicto.motivo} No se publica.` };
    }

    const urls = (pieza.slides || []).map((_: any, i: number) =>
        `${origenPublico()}/social/${pieza.id}/${String(i + 1).padStart(2, '0')}.jpg`);
    const caption = armarCaption(pieza, tablas);
    const alts = (pieza.slides || []).map((s: any) => altDeSlide(s, pieza.id));

    if (dryRun) return { ok: true, dryRun: true, pieza: pieza.id, slides: urls.length, caption, urls, ...extra };

    const r = await publicarCarrusel(pieza.id, urls, caption, alts);
    if (r.ok) {
        await registrarEnBitacora({
            pieza: pieza.id,
            plataformas: ['Facebook', 'Instagram'],
            slides: urls.length,
            urls: { facebook: r.facebookId, instagram: r.instagramId },
            ...extra,
        });
        return { ok: true, pieza: pieza.id, facebook: r.facebookId, instagram: r.instagramId, ...extra };
    }
    // Se puede publicar a mano con:
    //   node scripts/social/publicar.mjs social/contenido/<pieza>.json --facebook --instagram
    console.error(`[cron social-feed] El carrusel ${pieza.id} no se publicó:`, r.error);
    return { ok: false, pieza: pieza.id, error: r.error, ...extra };
}

/** El modelo del día (?que=modelo). */
async function publicarModelo(dryRun: boolean) {
    const { carriles, dias } = await leerJson('social', 'feed-modelos.json');
    const hoy = hoyART();
    if (!tocaHoy(dias, hoy)) return { ok: true, motivo: `Hoy (${hoy}) no toca modelo: salen los ${(dias || ['lun']).join(', ')}.` };
    // Si ese día ya hay un carrusel programado (por ejemplo uno de selección:
    // "todos los Victoria"), el modelo del día no sale: nunca dos juntos
    // (Ishtar, 19/10/2026).
    const prog = await leerJson('social', 'feed-programacion.json');
    const programada = (prog.programacion || []).find((e: any) => e.fecha === hoy);
    if (programada) return { ok: true, motivo: `Hoy ya sale "${programada.pieza || programada.reel}" programado: el modelo del día no se suma.` };
    const dia = diasDesdeElOrigen();
    const eleccion = modeloDelDia(carriles || {}, dia);
    if (!eleccion) return { ok: true, motivo: 'El carril de modelos está vacío: correr scripts/social/generar-feed-modelos.mjs.' };
    return publicarPieza(eleccion.id, dryRun, { carril: eleccion.carril, dia });
}

/** Lo programado para hoy (?que=programada): carrusel o reel. */
async function publicarProgramada(searchParams: URLSearchParams, dryRun: boolean) {
    const prog = await leerJson('social', 'feed-programacion.json');
    const hoy = hoyART();
    const entrada = (prog.programacion || []).find((e: any) => e.fecha === hoy);

    if (!entrada) return { ok: true, motivo: `Sin programación para hoy (${hoy}).` };

    // ── Entrada de REEL ({fecha, reel: "tema"}) ─────────────────────────
    // El video ya está renderizado y hosteado en /social/reels/<tema>.mp4;
    // acá solo se publica. Los reels duran 6 s por diseño (DURACION_MS del
    // pipeline), y la portada se elige por escena → thumb_offset en ms.
    if (entrada.reel) {
        const claveReel = `reel-${entrada.reel}`;
        if (yaSalio(await leerBitacora(), claveReel)) {
            return { ok: true, motivo: `"${claveReel}" ya se publicó en los últimos 7 días.` };
        }

        const def = await leerJson('social', 'contenido', 'reels', `${entrada.reel}.json`);
        const tablasR = await leerJson('social', 'seo-hashtags.json');

        // 8 hashtags, tres familias — mismo criterio que hashtagsDeReel().
        const tema: string[] = (def.temas || []).flatMap((t: string) => tablasR.porTema?.[t] || []);
        const tags = [...new Set([
            ...tema.slice(0, 3),
            ...(tablasR.salud || []).slice(0, 2),
            ...(tablasR.base || []),
            ...tema.slice(3),
        ])].slice(0, 8).map(h => `#${h}`).join(' ');
        const caption = `${String(def.copy || '').trim()}\n\n${tags}`;

        const videoUrl = `${origenPublico()}/social/reels/${entrada.reel}.mp4`;
        const DURACION_MS = 6000;
        const nEsc = (def.escenas || []).length || 1;
        const thumbMs = (((def.coverEscena ?? 0) + 0.5) / nEsc) * DURACION_MS;

        if (dryRun) return { ok: true, dryRun: true, reel: entrada.reel, videoUrl, caption };

        const rr = await publicarReel(claveReel, videoUrl, caption, thumbMs);
        if (rr.ok) {
            await registrarEnBitacora({
                pieza: claveReel,
                plataformas: ['Instagram (reel)'],
                slides: 1,
                urls: { instagram: rr.storyId },
            });
            return { ok: true, reel: entrada.reel, instagramId: rr.storyId };
        }
        // Sin mail (Ishtar, 7/9/2026): el motivo queda en el log y en la
        // respuesta del endpoint. No se reintenta solo, para no duplicar.
        console.error(`[cron social-feed] El reel ${entrada.reel} no se publicó:`, rr.error);
        return { ok: false, reel: entrada.reel, error: rr.error };
    }

    void searchParams;
    return publicarPieza(entrada.pieza, dryRun);
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const secret = token || searchParams.get('secret');

        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
        }
        if (secret !== cronSecret) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const dryRun = searchParams.get('dryRun') === '1';
        const que = searchParams.get('que') || 'programada';
        if (que !== 'programada' && que !== 'modelo') {
            return NextResponse.json({ ok: false, error: `?que=${que} no existe: programada | modelo.` }, { status: 400 });
        }
        const r = que === 'modelo' ? await publicarModelo(dryRun) : await publicarProgramada(searchParams, dryRun);
        return NextResponse.json({ que, ...r });
    } catch (error: any) {
        console.error('[cron social-feed] Error:', error?.message);
        return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
    }
}
