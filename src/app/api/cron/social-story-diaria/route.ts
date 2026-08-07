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

/** Cuántos días completos pasaron desde el 1/1/2026, en hora argentina. */
function diasDesdeElOrigen(): number {
    const ART_OFFSET_MS = 3 * 60 * 60 * 1000;
    const hoyART = new Date(Date.now() - ART_OFFSET_MS);
    const dias = Math.floor(Date.UTC(hoyART.getUTCFullYear(), hoyART.getUTCMonth(), hoyART.getUTCDate()) / 86400000);
    return dias - Math.floor(Date.UTC(2026, 0, 1) / 86400000);
}

/**
 * Desde qué posición del carril arranca el día de hoy.
 *
 * Avanza de a `porDia`, no de a uno: si se publican dos por día y el índice
 * avanzara de a uno, la segunda de hoy volvería a salir mañana como primera.
 */
function indiceDelDia(cantidad: number, porDia = 1): number {
    const n = diasDesdeElOrigen() * porDia;
    return ((n % cantidad) + cantidad) % cantidad;
}

async function leerBitacora(): Promise<any[]> {
    const fila = await prisma.systemSetting.findUnique({ where: { key: CLAVE_BITACORA } });
    try {
        const datos = fila?.value ? JSON.parse(fila.value) : [];
        return Array.isArray(datos) ? datos : [];
    } catch { return []; }
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
        const carriles: Record<string, Array<{ id: string; tipo?: string }>> = catalogo.carriles || {};

        // DOS de cada carril: cuatro stories por día, dos de contenido y dos de
        // producto. Se toman consecutivas dentro del carril (i, i+1) para que
        // no se repita ninguna el mismo día y para que al día siguiente la
        // secuencia siga donde quedó, sin saltear piezas.
        const POR_CARRIL = 2;
        const elegidas = Object.entries(carriles).flatMap(([carril, lista]) => {
            if (!lista?.length) return [];
            const base = indiceDelDia(lista.length, POR_CARRIL);
            // Si el carril tiene menos piezas que las que se piden por día, se
            // publica lo que hay en vez de repetir la misma dos veces.
            const cuantas = Math.min(POR_CARRIL, lista.length);
            return Array.from({ length: cuantas }, (_, k) => ({
                carril,
                ...lista[(base + k) % lista.length],
            }));
        });

        if (!elegidas.length) {
            return NextResponse.json({ ok: false, motivo: 'El catálogo de stories está vacío.' });
        }

        const conUrl = elegidas.map(e => ({ ...e, url: `${origenPublico()}/social/${e.id}/01.jpg` }));

        // `dryRun` sirve para probar la elección sin publicar: útil al dar de
        // alta el cron y para ver qué saldría mañana.
        if (searchParams.get('dryRun') === '1') {
            return NextResponse.json({ ok: true, dryRun: true, elegidas: conUrl });
        }

        // DEDUP DEL MISMO DÍA: si una pieza ya salió hoy (el cron corrió dos
        // veces, o alguien disparó a mano y después llegó el schedule), se
        // salta. Existe porque el workflow ahora tiene DOS horarios de disparo
        // — GitHub a veces se come un schedule y el segundo lo cubre — y sin
        // esto el segundo duplicaría las 4 stories.
        const bitacoraHoy = await leerBitacora();
        const inicioDiaART = (() => {
            const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
            return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + 3 * 60 * 60 * 1000;
        })();
        const yaSalioHoy = (id: string) => bitacoraHoy.some(p =>
            p.pieza === id && new Date(p.fecha).getTime() >= inicioDiaART);

        // En serie y no en paralelo: dos publicaciones simultáneas contra la
        // misma cuenta es la forma más rápida de que Meta empiece a limitar.
        const resultados = [];
        for (const e of conUrl) {
            if (yaSalioHoy(e.id)) {
                resultados.push({ ...e, ok: true, storyId: '(ya salió hoy, no se repite)' });
                continue;
            }
            const r = await publicarStory(e.url, e.id);
            resultados.push({ ...e, ...r });
            if (r.ok) {
                await registrarEnBitacora({
                    pieza: e.id,
                    plataformas: ['Instagram (story)'],
                    slides: 1,
                    urls: { instagram: r.storyId },
                });
            }
        }

        const fallaron = resultados.filter(r => !r.ok);

        // No reintenta: avisa. Dos stories iguales es peor que ninguna.
        if (fallaron.length) {
            await sendEmail({
                to: process.env.ADMIN_EMAIL || 'ventas@atelieroptica.com.ar',
                subject: `⚠️ ${fallaron.length} de ${resultados.length} stories no salieron hoy`,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
                        <h2 style="color:#b45309">No salieron todas las stories de hoy</h2>
                        <ul style="font-size:15px">
                            ${resultados.map(r => `<li><strong>${r.id}</strong> (${r.carril}): ${r.ok ? '✅ publicada' : `❌ ${r.error}`}</li>`).join('')}
                        </ul>
                        <p style="font-size:14px">
                            No se reintenta solo, para no terminar con la misma story publicada dos veces.
                            Se puede publicar a mano desde el celular, o revisar qué pasó y esperar a mañana.
                        </p>
                        <p style="margin-top:22px;font-size:12px;color:#6b7280">
                            Si la causa es "la imagen no responde 200", falta deployar la placa.
                        </p>
                    </div>`,
            }).catch(console.error);
        }

        return NextResponse.json({
            ok: fallaron.length === 0,
            publicadas: resultados.filter(r => r.ok).map(r => ({ pieza: r.id, carril: r.carril, storyId: r.storyId })),
            fallaron: fallaron.map(r => ({ pieza: r.id, error: r.error })),
        });
    } catch (error: any) {
        console.error('[cron social-story-diaria] Error:', error?.message);
        return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
    }
}
