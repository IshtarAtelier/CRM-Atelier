import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { publicarCarrusel, publicarReel, origenPublico } from '@/services/social-publisher.service';

/**
 * Publica el carrusel del día en el feed de Facebook + Instagram.
 *
 * Alta en cron-job.org: GET diario a /api/cron/social-feed?secret=CRON_SECRET
 * Buen horario: 11:00 ART (después de las stories de las 10, para que la
 * cuenta no dispare todo junto).
 *
 * QUÉ SALE: lo dice `social/feed-programacion.json`, fecha por fecha. Si hoy no
 * figura, el cron responde "sin programación" y no toca nada — por eso puede
 * correr todos los días sin pensar en martes/jueves/sábado.
 *
 * NO PUBLICA DOS VECES: antes de publicar mira la bitácora. Si la pieza ya
 * aparece en los últimos 7 días (la publicó una persona a mano, o el cron
 * corrió dos veces), se salta. Un cron de publicación sin dedup termina,
 * tarde o temprano, con el mismo carrusel dos veces en el muro.
 *
 * SI FALLA, AVISA POR MAIL Y NO REINTENTA: mismo criterio que las stories.
 */

const CLAVE_BITACORA = 'social_publicaciones';

function hoyART(): string {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
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

/** Alt text por slide — mismo criterio que scripts/social/seo.mjs. */
function altDeSlide(slide: any, piezaId: string): string {
    const limpio = (t: any) => String(t || '').replace(/\*/g, '').trim();
    const partes = [limpio(slide.title), limpio(slide.subtitle), limpio(slide.body)].filter(Boolean);
    if (slide.items?.length) partes.push(slide.items.map(limpio).join('. '));
    if (slide.dato) partes.unshift(limpio(slide.dato));
    const texto = partes.join('. ').replace(/\.\.+/g, '.').trim() || `Publicación de Atelier Óptica: ${piezaId}`;
    return texto.length > 950 ? `${texto.slice(0, 947)}...` : texto;
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

        const prog = JSON.parse(await readFile(path.join(process.cwd(), 'social', 'feed-programacion.json'), 'utf-8'));
        const hoy = hoyART();
        const entrada = (prog.programacion || []).find((e: any) => e.fecha === hoy);

        if (!entrada) {
            return NextResponse.json({ ok: true, motivo: `Sin programación para hoy (${hoy}).` });
        }

        // ── Entrada de REEL ({fecha, reel: "tema"}) ─────────────────────────
        // El video ya está renderizado y hosteado en /social/reels/<tema>.mp4;
        // acá solo se publica. Los reels duran 6 s por diseño (DURACION_MS del
        // pipeline), y la portada se elige por escena → thumb_offset en ms.
        if (entrada.reel) {
            const bitacoraR = await leerBitacora();
            const claveReel = `reel-${entrada.reel}`;
            const hace7dR = Date.now() - 7 * 86400000;
            if (bitacoraR.some(p => p.pieza === claveReel && new Date(p.fecha).getTime() >= hace7dR)) {
                return NextResponse.json({ ok: true, motivo: `"${claveReel}" ya se publicó en los últimos 7 días.` });
            }

            const def = JSON.parse(await readFile(
                path.join(process.cwd(), 'social', 'contenido', 'reels', `${entrada.reel}.json`), 'utf-8'));
            const tablasR = JSON.parse(await readFile(
                path.join(process.cwd(), 'social', 'seo-hashtags.json'), 'utf-8'));

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

            if (searchParams.get('dryRun') === '1') {
                return NextResponse.json({ ok: true, dryRun: true, reel: entrada.reel, videoUrl, caption });
            }

            const rr = await publicarReel(claveReel, videoUrl, caption, thumbMs);
            if (rr.ok) {
                await registrarEnBitacora({
                    pieza: claveReel,
                    plataformas: ['Instagram (reel)'],
                    slides: 1,
                    urls: { instagram: rr.storyId },
                });
                return NextResponse.json({ ok: true, reel: entrada.reel, instagramId: rr.storyId });
            }
            await sendEmail({
                to: process.env.ADMIN_EMAIL || 'ventas@atelieroptica.com.ar',
                subject: `⚠️ No salió el reel de hoy (${entrada.reel})`,
                html: `<div style="font-family:Arial,sans-serif;color:#1f2937">
                    <h2 style="color:#b45309">El reel programado no se publicó</h2>
                    <p>Reel: <strong>${entrada.reel}</strong><br>Motivo: <strong>${rr.error}</strong></p>
                    <p style="font-size:13px">No se reintenta solo. Se puede subir a mano desde la app con el mp4 de social/contenido/reels/salida/.</p>
                </div>`,
            }).catch(console.error);
            return NextResponse.json({ ok: false, reel: entrada.reel, error: rr.error });
        }

        // Dedup contra la bitácora: publicada en los últimos 7 días → no repetir.
        const bitacora = await leerBitacora();
        const hace7d = Date.now() - 7 * 86400000;
        const yaSalio = bitacora.some(p =>
            p.pieza === entrada.pieza && new Date(p.fecha).getTime() >= hace7d);
        if (yaSalio) {
            return NextResponse.json({ ok: true, motivo: `"${entrada.pieza}" ya se publicó en los últimos 7 días.` });
        }

        const pieza = JSON.parse(await readFile(
            path.join(process.cwd(), 'social', 'contenido', `${entrada.pieza}.json`), 'utf-8'));
        const tablas = JSON.parse(await readFile(
            path.join(process.cwd(), 'social', 'seo-hashtags.json'), 'utf-8'));

        // GUARDA DE FRESCURA: una pieza de base con más de 10 días puede tener
        // precios que ya no rigen. Publicar un precio viejo es exactamente lo
        // que este sistema existe para impedir, así que antes de publicar avisa
        // por mail cómo regenerarla y NO publica. Programar octubre hoy es
        // posible justamente gracias a esto: si nadie regenera cerca de la
        // fecha, sale un aviso y no un precio de agosto.
        if (pieza.fuente === 'base') {
            const dias = pieza.generadoEl
                ? Math.floor((Date.now() - new Date(`${pieza.generadoEl}T12:00:00Z`).getTime()) / 86400000)
                : Infinity;
            if (dias > 10) {
                await sendEmail({
                    to: process.env.ADMIN_EMAIL || 'ventas@atelieroptica.com.ar',
                    subject: `⚠️ Carrusel "${pieza.id}" no salió: precios de hace ${dias === Infinity ? 'fecha desconocida' : `${dias} días`}`,
                    html: `
                        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
                            <h2 style="color:#b45309">El carrusel de hoy tiene precios viejos</h2>
                            <p style="font-size:15px">"${pieza.id}" se generó ${pieza.generadoEl ? `el ${pieza.generadoEl}` : 'en fecha desconocida'}
                            y los precios pueden haber cambiado. No se publicó.</p>
                            <p style="font-size:14px">Para regenerarlo con los precios de hoy y publicarlo:</p>
                            <pre style="background:#f3f4f6;padding:10px;border-radius:6px;font-size:12px">node scripts/social/generar-producto.mjs ${pieza.id === 'sol-seleccion' ? '--categoria "Sol" --id sol-seleccion' : pieza.id === 'receta-seleccion' ? '--categoria "Receta" --id receta-seleccion --saltear 3' : ''} --render
node scripts/social/publicar.mjs social/contenido/${pieza.id}.json --facebook --instagram</pre>
                        </div>`,
                }).catch(console.error);
                return NextResponse.json({ ok: false, pieza: pieza.id, motivo: `Precios de hace ${dias} días: no se publica. Mail enviado.` });
            }
        }

        const urls = (pieza.slides || []).map((_: any, i: number) =>
            `${origenPublico()}/social/${pieza.id}/${String(i + 1).padStart(2, '0')}.jpg`);
        const caption = armarCaption(pieza, tablas);
        const alts = (pieza.slides || []).map((s: any) => altDeSlide(s, pieza.id));

        if (searchParams.get('dryRun') === '1') {
            return NextResponse.json({ ok: true, dryRun: true, pieza: pieza.id, slides: urls.length, caption, urls });
        }

        const r = await publicarCarrusel(pieza.id, urls, caption, alts);

        if (r.ok) {
            await registrarEnBitacora({
                pieza: pieza.id,
                plataformas: ['Facebook', 'Instagram'],
                slides: urls.length,
                urls: { facebook: r.facebookId, instagram: r.instagramId },
            });
            return NextResponse.json({ ok: true, pieza: pieza.id, facebook: r.facebookId, instagram: r.instagramId });
        }

        await sendEmail({
            to: process.env.ADMIN_EMAIL || 'ventas@atelieroptica.com.ar',
            subject: `⚠️ No salió el carrusel de hoy (${pieza.id})`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
                    <h2 style="color:#b45309">El carrusel programado para hoy no se publicó</h2>
                    <p style="font-size:15px">
                        Pieza: <strong>${pieza.id}</strong><br>
                        Motivo: <strong>${r.error}</strong>
                    </p>
                    <p style="font-size:14px">
                        No se reintenta solo, para no duplicar la publicación. Se puede publicar a mano con:<br>
                        <code>node scripts/social/publicar.mjs social/contenido/${pieza.id}.json --facebook --instagram</code>
                    </p>
                </div>`,
        }).catch(console.error);

        return NextResponse.json({ ok: false, pieza: pieza.id, error: r.error });
    } catch (error: any) {
        console.error('[cron social-feed] Error:', error?.message);
        return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
    }
}
