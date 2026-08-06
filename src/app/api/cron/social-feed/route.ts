import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { publicarCarrusel, origenPublico } from '@/services/social-publisher.service';

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
