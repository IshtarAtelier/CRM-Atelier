import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { evaluarSaludProgramacion } from '@/lib/social/salud-programacion';

/**
 * Aviso diario de la cadencia de publicación en redes.
 *
 * Alta en cron-job.org: GET diario a /api/cron/social-cadencia?secret=CRON_SECRET
 *
 * POR QUÉ MANDA MAIL TODOS LOS DÍAS, incluso cuando está todo bien:
 *
 * Este proyecto ya perdió meses de fichas de clientes y semanas de fotos de
 * recetas sin que nadie se enterara. En los dos casos había un sistema que
 * "avisaba si algo fallaba" — y no avisó nunca, porque la falla era el silencio:
 * nada explotaba, simplemente dejaba de pasar lo que tenía que pasar.
 *
 * Una alarma que solo suena cuando hay problema no se puede distinguir de una
 * alarma rota. Una que manda un número todos los días se prueba sola: el día que
 * no llega el mail, ya sabés que algo se cortó.
 *
 * Por eso el asunto lleva SIEMPRE el número: "3 publicaciones en 7 días".
 *
 * Y MIRA TAMBIÉN PARA ADELANTE. Contar lo publicado no alcanzaba: el 12/8 no
 * salió ninguna story —el workflow venía disparando el cron equivocado— y este
 * mail no tenía cómo notarlo, porque el feed seguía publicando y el número de la
 * semana no se movió. Un hueco futuro no mueve ningún contador hasta que ya pasó.
 * Por eso ahora el asunto también grita cuando algo programado NO va a poder
 * salir, o cuando la regeneración semanal de precios se cortó.
 */

const META_SEMANAL = 3;   // la cadencia que se sostiene, según el plan
const ALERTA_DIAS = 5;    // más de esto sin publicar, el asunto lo grita

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

        const fila = await prisma.systemSetting.findUnique({ where: { key: 'social_publicaciones' } });
        let bitacora: any[] = [];
        try {
            bitacora = fila?.value ? JSON.parse(fila.value) : [];
            if (!Array.isArray(bitacora)) bitacora = [];
        } catch {
            bitacora = [];
        }

        const ahora = Date.now();
        const enUltimos = (dias: number) =>
            bitacora.filter(p => new Date(p.fecha).getTime() >= ahora - dias * 86400000).length;

        const ultima = bitacora[0] || null;
        const dias = ultima ? Math.floor((ahora - new Date(ultima.fecha).getTime()) / 86400000) : null;
        const semana = enUltimos(7);
        const mes = enUltimos(30);

        const nuncaSePublico = dias === null;
        const atrasado = nuncaSePublico || dias >= ALERTA_DIAS;

        // El número va SIEMPRE en el asunto: es lo que hace que el mail sirva
        // aunque nadie lo abra.
        // El asunto se lee de reojo en el celular: tiene que sonar natural.
        const plural = (n: number, sing: string, plur: string) => `${n} ${n === 1 ? sing : plur}`;
        const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;

        // LO QUE VIENE. Contar lo publicado mira para atrás, y un hueco futuro no
        // mueve ese número hasta que ya pasó: el 12/8 no salió ninguna story y
        // este mail no tenía cómo notarlo, porque el feed seguía publicando.
        const salud = await evaluarSaludProgramacion();

        const asunto = nuncaSePublico
            ? '📣 Redes: todavía no se publicó ninguna pieza'
            : salud.regeneracionCaida
                ? `🔴 Redes: los precios no se regeneran hace ${plural(salud.diasDesdeRegeneracion ?? 0, 'día', 'días')} · ${plural(salud.enRiesgo.length, 'pieza frenada', 'piezas frenadas')}`
                : salud.enRiesgo.length
                    ? `⚠️ Redes: ${plural(salud.enRiesgo.length, 'pieza programada', 'piezas programadas')} no va a poder salir`
                    : atrasado
                        ? `⚠️ Redes: ${plural(dias!, 'día', 'días')} sin publicar · ${plural(semana, 'publicación', 'publicaciones')} en la última semana`
                        : `📣 Redes: ${plural(semana, 'publicación', 'publicaciones')} en 7 días · ${plural(salud.entradasFuturas, 'fecha programada', 'fechas programadas')} por delante`;

        // Sin mail (Ishtar, 7/9/2026). El mismo diagnóstico lo da
        // `npm run check:social`, que corre sin base ni red, y queda en la
        // respuesta de este endpoint. El cron sigue corriendo: lo que se apaga
        // es el correo diario, no el chequeo.
        console.log(`[cron social-cadencia] ${asunto}`);

        return NextResponse.json({
            ok: true,
            diasSinPublicar: dias,
            ultimos7: semana,
            ultimos30: mes,
            atrasado,
            programacion: {
                fechasPorDelante: salud.entradasFuturas,
                hasta: salud.ultimaFecha,
                enRiesgo: salud.enRiesgo.length,
                regeneracionCaida: salud.regeneracionCaida,
                ultimaRegeneracion: salud.ultimaRegeneracion,
            },
        });
    } catch (error: any) {
        console.error('[cron social-cadencia] Error:', error?.message);
        return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
    }
}
