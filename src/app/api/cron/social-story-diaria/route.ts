import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { publicarStory, origenPublico } from '@/services/social-publisher.service';
import { evaluarFrescura, leerPieza } from '@/lib/social/frescura';

/**
 * Las stories de Instagram del día, sin que nadie las dispare.
 *
 * DOS TANDAS: `?tanda=manana` (default) y `?tanda=tarde`. Horarios fijados
 * por Ishtar (28/8), ver .github/workflows/social-crons.yml:
 *   mañana —  8:00 ART — 2 de contenido + 2 de producto = 4 stories
 *   tarde  — 18:05 ART — 2 de contenido                 = 2 stories
 * Las stories duran 24 h pero se consumen en el momento: una sola tanda a la
 * mañana deja toda la tarde sin nada nuevo arriba, que es cuando la gente
 * vuelve a mirar. La tarde es SOLO contenido a propósito: las de producto
 * llevan precio adentro y el carril tiene 24 piezas — subirlas a 3 por día las
 * quemaría en 8 días, y lo que se pidió fue más contenido, no más producto.
 *
 * QUÉ SALE CADA DÍA
 * La elección es determinística, no al azar: se recorre `social/stories-diarias.json`
 * en orden, avanzando lo que consume el día. Se puede saber de antemano qué
 * sale mañana, y si algo salió mal se puede reproducir exactamente. Con azar,
 * un problema del martes no se vuelve a ver hasta que vuelve a tocar por
 * casualidad.
 *
 * LA TRAMPA DEL ÍNDICE (leer antes de tocar el PLAN)
 * El índice del día se calcula UNA vez por carril y avanza de a lo que ese
 * carril consume en TODO el día, no de a lo que saca una tanda. La tanda de la
 * tarde no recalcula nada: toma las que siguen a las de la mañana, desplazadas
 * dentro del mismo día. Si la tarde volviera a llamar al mismo cálculo sin
 * desplazamiento, publicaría exactamente las mismas de la mañana; y si el
 * avance diario contara solo lo de la mañana, al día siguiente se repetirían
 * las de la tarde. Las dos cosas salen del mismo PLAN, por eso es una sola
 * fuente y no dos números sueltos.
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

/**
 * Qué saca cada tanda de cada carril. ES LA ÚNICA FUENTE de los números: de
 * acá salen tanto cuántas publica una tanda como cuánto avanza el índice del
 * día (la suma de la columna). Un carril que no figure acá no publica nada y
 * se reporta en `sinPlan` — agregar un carril al JSON es también agregarle una
 * línea acá.
 *
 * El ORDEN de las claves importa: define el desplazamiento de cada tanda.
 */
const PLAN = {
    manana: { contenido: 2, producto: 2 },
    tarde: { contenido: 2 },
} as const satisfies Record<string, Record<string, number>>;

type Tanda = keyof typeof PLAN;
const TANDAS = Object.keys(PLAN) as Tanda[];
const esTanda = (v: string | null): v is Tanda => TANDAS.includes(v as Tanda);

/** Cuántas piezas consume el carril en el día entero, sumando todas las tandas. */
function porDiaDelCarril(carril: string): number {
    return TANDAS.reduce((suma, t) => suma + ((PLAN[t] as Record<string, number>)[carril] ?? 0), 0);
}

/** Cuántas ya sacaron las tandas ANTERIORES a esta: el desplazamiento del día. */
function yaSacaronAntes(tanda: Tanda, carril: string): number {
    let acumulado = 0;
    for (const t of TANDAS) {
        if (t === tanda) break;
        acumulado += (PLAN[t] as Record<string, number>)[carril] ?? 0;
    }
    return acumulado;
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

        // QUÉ TANDA ES. Sin parámetro se asume la mañana, que es la que existía
        // antes de que hubiera dos: así un disparo viejo o hecho a mano sigue
        // haciendo lo de siempre en vez de fallar.
        const pedida = searchParams.get('tanda');
        if (pedida && !esTanda(pedida)) {
            return NextResponse.json(
                { error: `Tanda desconocida: "${pedida}". Las válidas son ${TANDAS.join(' | ')}.` },
                { status: 400 },
            );
        }
        const tanda: Tanda = esTanda(pedida) ? pedida : 'manana';

        // Se toman consecutivas dentro del carril (i, i+1) para que no se
        // repita ninguna el mismo día y para que al día siguiente la secuencia
        // siga donde quedó, sin saltear piezas. El índice arranca del día
        // completo y se desplaza por lo que ya sacó la tanda anterior.
        const sinPlan: string[] = [];
        const elegidas = Object.entries(carriles).flatMap(([carril, lista]) => {
            if (!lista?.length) return [];
            if (porDiaDelCarril(carril) === 0) { sinPlan.push(carril); return []; }
            const pide = (PLAN[tanda] as Record<string, number>)[carril] ?? 0;
            if (!pide) return [];
            const base = indiceDelDia(lista.length, porDiaDelCarril(carril));
            const desplazamiento = yaSacaronAntes(tanda, carril);
            // Si el carril tiene menos piezas que las que se piden por día, se
            // publica lo que hay en vez de repetir la misma dos veces.
            const cuantas = Math.min(pide, lista.length);
            return Array.from({ length: cuantas }, (_, k) => ({
                carril,
                ...lista[(base + desplazamiento + k) % lista.length],
            }));
        });

        if (sinPlan.length) {
            console.warn(`[cron social-story-diaria] Carriles sin línea en PLAN, no publican: ${sinPlan.join(', ')}`);
        }

        if (!elegidas.length) {
            return NextResponse.json({ ok: false, tanda, sinPlan, motivo: 'No hay nada para publicar en esta tanda.' });
        }

        const conUrl = elegidas.map(e => ({ ...e, url: `${origenPublico()}/social/${e.id}/01.jpg` }));

        // `dryRun` sirve para probar la elección sin publicar: útil al dar de
        // alta el cron y para ver qué saldría mañana.
        if (searchParams.get('dryRun') === '1') {
            return NextResponse.json({ ok: true, dryRun: true, tanda, sinPlan, elegidas: conUrl });
        }

        // DEDUP DEL MISMO DÍA: si una pieza ya salió hoy (el cron corrió dos
        // veces, o alguien disparó a mano y después llegó el schedule), se
        // salta. Existe porque cada tanda tiene DOS horarios de disparo —
        // GitHub a veces se come un schedule y el segundo lo cubre — y sin
        // esto el segundo duplicaría las stories.
        //
        // Es por PIEZA y por día, no por tanda, y así tiene que quedar: cubre
        // también el caso de que la tarde se solape con la mañana porque el
        // carril se quedó corto (un carril con menos piezas que las 4 que
        // consume el día daría la vuelta y repetiría).
        const bitacoraHoy = await leerBitacora();
        const inicioDiaART = (() => {
            const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
            return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + 3 * 60 * 60 * 1000;
        })();
        const yaSalioHoy = (id: string) => bitacoraHoy.some(p =>
            p.pieza === id && new Date(p.fecha).getTime() >= inicioDiaART);

        // En serie y no en paralelo: dos publicaciones simultáneas contra la
        // misma cuenta es la forma más rápida de que Meta empiece a limitar.
        const resultados: Array<{
            carril: string; id: string; tipo?: string; url: string;
            ok: boolean; storyId?: string; error?: string;
        }> = [];
        /** Piezas con precio vencido: se avisan juntas al final, no una por una. */
        const vencidas: Array<{ id: string; motivo: string }> = [];
        for (const e of conUrl) {
            if (yaSalioHoy(e.id)) {
                resultados.push({ ...e, ok: true, storyId: '(ya salió hoy, no se repite)' });
                continue;
            }

            // GUARDA DE FRESCURA. Las story-producto llevan el precio y las
            // cuotas escritos adentro; si se generaron hace mucho, ese número ya
            // no rige. Publicar un precio viejo es justo lo que este sistema
            // existe para impedir (regla R6), así que no sale y se avisa.
            const json = await leerPieza(e.id);
            if (json) {
                const veredicto = evaluarFrescura(json);
                if (!veredicto.fresca) {
                    vencidas.push({ id: e.id, motivo: veredicto.motivo });
                    resultados.push({ ...e, ok: false, error: `Precio vencido: ${veredicto.motivo}` });
                    continue;
                }
            }
            const r = await publicarStory(e.url, e.id);
            resultados.push({ ...e, ...r });
            if (r.ok) {
                await registrarEnBitacora({
                    pieza: e.id,
                    tanda,
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
                subject: `⚠️ ${fallaron.length} de ${resultados.length} stories no salieron (tanda de la ${tanda})`,
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
                        ${vencidas.length ? `
                        <div style="background:#fdf6ec;border-left:4px solid #b45309;padding:10px 14px;margin:16px 0">
                            <p style="margin:0 0 6px;font-size:14px;font-weight:700">Precios vencidos: hay que regenerar</p>
                            ${vencidas.map(v => `<p style="margin:4px 0;font-size:13px">• <strong>${v.id}</strong>: ${v.motivo}</p>`).join('')}
                            <pre style="background:#f3f4f6;padding:10px;border-radius:6px;font-size:12px;white-space:pre-wrap">node scripts/social/generar-story-producto.mjs --produccion
for f in social/contenido/story-producto-*.json; do node scripts/social/render.mjs "$f"; done</pre>
                        </div>` : ''}
                        <p style="margin-top:22px;font-size:12px;color:#6b7280">
                            Si la causa es "la imagen no responde 200", falta deployar la placa.
                        </p>
                    </div>`,
            }).catch(console.error);
        }

        return NextResponse.json({
            ok: fallaron.length === 0,
            tanda,
            publicadas: resultados.filter(r => r.ok).map(r => ({ pieza: r.id, carril: r.carril, storyId: r.storyId })),
            fallaron: fallaron.map(r => ({ pieza: r.id, error: r.error })),
        });
    } catch (error: any) {
        console.error('[cron social-story-diaria] Error:', error?.message);
        return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
    }
}
