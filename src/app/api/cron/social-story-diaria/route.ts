import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { publicarStory, origenPublico } from '@/services/social-publisher.service';

/**
 * Una story de Instagram por día, sin que nadie la dispare.
 *
 * Alta en cron-job.org: GET diario a /api/cron/social-story-diaria?secret=CRON_SECRET
 * Buen horario: 10:00 ART. Las stories duran 24 h y se miran sobre todo a la
 * mañana y al mediodía.
 *
 * QUÉ SALE CADA DÍA
 * La elección es determinística, no al azar: se recorre `social/stories-diarias.json`
 * en orden, avanzando una por día. Se puede saber de antemano qué sale mañana,
 * y si algo salió mal se puede reproducir exactamente. Con azar, un problema del
 * martes no se vuelve a ver hasta que vuelve a tocar por casualidad.
 *
 * POR QUÉ NO GENERA LA IMAGEN
 * Las placas ya están renderizadas y commiteadas. Un cron que abre un Chromium
 * para generar una imagen es un cron que falla por memoria en el peor momento y
 * nadie entiende por qué. Acá solo se elige y se publica.
 *
 * SI FALLA, AVISA POR MAIL Y NO REINTENTA. Un reintento automático sobre una
 * API de publicación puede terminar en dos stories iguales. Prefiere no
 * publicar y que alguien se entere.
 */

const CLAVE_BITACORA = 'social_publicaciones';
const CATALOGO = 'social/stories-diarias.json';

/** Días completos desde el 1/1/2026, en hora argentina. */
function indiceDelDia(cantidad: number): number {
    const ART_OFFSET_MS = 3 * 60 * 60 * 1000;
    const hoyART = new Date(Date.now() - ART_OFFSET_MS);
    const dias = Math.floor(Date.UTC(hoyART.getUTCFullYear(), hoyART.getUTCMonth(), hoyART.getUTCDate()) / 86400000);
    const base = Math.floor(Date.UTC(2026, 0, 1) / 86400000);
    return ((dias - base) % cantidad + cantidad) % cantidad;
}

async function registrarEnBitacora(entrada: Record<string, unknown>) {
    const fila = await prisma.systemSetting.findUnique({ where: { key: CLAVE_BITACORA } });
    let previas: unknown[] = [];
    try { previas = fila?.value ? JSON.parse(fila.value) : []; } catch { previas = []; }
    if (!Array.isArray(previas)) previas = [];

    const value = JSON.stringify([{ ...entrada, fecha: new Date().toISOString() }, ...previas].slice(0, 60));
    await prisma.systemSetting.upsert({
        where: { key: CLAVE_BITACORA },
        update: { value },
        create: { key: CLAVE_BITACORA, value },
    });
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

        const crudo = await readFile(path.join(process.cwd(), CATALOGO), 'utf-8');
        const catalogo = JSON.parse(crudo);
        const stories: Array<{ id: string; tipo?: string }> = catalogo.stories || [];

        if (!stories.length) {
            return NextResponse.json({ ok: false, motivo: 'El catálogo de stories está vacío.' });
        }

        const elegida = stories[indiceDelDia(stories.length)];
        const url = `${origenPublico()}/social/${elegida.id}/01.jpg`;

        // `dryRun` sirve para probar la elección sin publicar: útil al dar de
        // alta el cron y para ver qué saldría mañana.
        if (searchParams.get('dryRun') === '1') {
            return NextResponse.json({ ok: true, dryRun: true, elegida: elegida.id, url });
        }

        const r = await publicarStory(url, elegida.id);

        if (r.ok) {
            await registrarEnBitacora({
                pieza: elegida.id,
                plataformas: ['Instagram (story)'],
                slides: 1,
                urls: { instagram: r.storyId },
            });
            return NextResponse.json({ ok: true, pieza: elegida.id, storyId: r.storyId });
        }

        // No reintenta: avisa. Dos stories iguales es peor que ninguna.
        await sendEmail({
            to: process.env.ADMIN_EMAIL || 'ventas@atelieroptica.com.ar',
            subject: `⚠️ No salió la story de hoy (${elegida.id})`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
                    <h2 style="color:#b45309">La story de hoy no se publicó</h2>
                    <p style="font-size:15px">
                        Pieza: <strong>${elegida.id}</strong><br>
                        Motivo: <strong>${r.error}</strong>
                    </p>
                    <p style="font-size:14px">
                        No se reintenta solo, para no terminar con la misma story publicada dos veces.
                        Se puede publicar a mano desde el celular, o revisar qué pasó y esperar a mañana.
                    </p>
                    <p style="margin-top:22px;font-size:12px;color:#6b7280">
                        Si la causa es "la imagen no responde 200", falta deployar la placa.
                    </p>
                </div>`,
        }).catch(console.error);

        return NextResponse.json({ ok: false, pieza: elegida.id, error: r.error }, { status: 200 });
    } catch (error: any) {
        console.error('[cron social-story-diaria] Error:', error?.message);
        return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
    }
}
