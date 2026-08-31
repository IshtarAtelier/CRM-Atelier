/**
 * RESUMEN DIARIO del equipo, que el Asistente le manda a cada colaborador como
 * mensaje interno.
 *
 * Qué contesta, por pedido de la dueña: a cuántos clientes le armó presupuesto,
 * cuántos pedidos mandó a fábrica, cuántas tareas cerró y cuántos comentarios
 * pidió. **Si fue cero, dice cero**: un reporte que omite lo que está en cero se
 * lee como si el dato no existiera, y no se puede distinguir "no hizo nada" de
 * "el sistema no lo midió".
 *
 * QUÉ NO ESTÁ, Y POR QUÉ: "tareas que creaste". Se pidió, se midió contra
 * producción y da CERO para todo el mundo — de 334 tareas creadas en una semana,
 * las 334 las generaron los motores automáticos ('Sistema (Pasivo)', 'Bot',
 * 'Sistema (Retención)'), ninguna una persona. Un renglón que siempre dice cero
 * entrena a la gente a saltear el reporte entero, así que se calcula pero no se
 * muestra: el día que se pueda crear una tarea a mano, se agrega el renglón.
 *
 * Corre una vez por día, y el proyecto dispara sus crons DOS veces a propósito
 * (GitHub se come schedules). El segundo disparo no duplica: `dedupePrefijo`
 * lleva la fecha del resumen, así que si el de hoy ya salió, no se repite.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { InternalMessagingService } from '@/services/internal-messaging.service';
import { safeCompare, tokenBearer } from '@/lib/safe-compare';
// El día de AYER en hora argentina. El cálculo vive en lib porque el briefing
// del panel necesita el mismo corte: dos copias del offset divergen.
import { diaArgentino } from '@/lib/dia-argentino';

export const dynamic = 'force-dynamic';

/** "3 clientes" / "1 cliente" / "ninguno" — nunca un número pelado sin unidad. */
function contar(n: number, singular: string, plural: string, cero: string): string {
    if (n === 0) return cero;
    return `${n} ${n === 1 ? singular : plural}`;
}

export async function GET(request: NextRequest) {
    // Comparación en tiempo constante: un `!==` filtra por timing cuántos
    // caracteres del principio acertó quien prueba, y detrás de este secreto
    // hay una ruta que le escribe a TODO el equipo. El middleware bypasea
    // /api/cron/* entero, así que esta es la única puerta.
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
    if (!safeCompare(tokenBearer(request.headers.get('Authorization')), cronSecret)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { desde, hasta, etiqueta } = diaArgentino(1);

        const equipo = await prisma.user.findMany({
            where: { role: { in: ['ADMIN', 'STAFF'] } },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });

        const enviados: string[] = [];
        const resumenEquipo: { nombre: string; presupuestos: number; fabrica: number; cerradas: number; resenas: number }[] = [];

        for (const persona of equipo) {
            const a = await InternalMessagingService.actividadDe(persona.id, persona.name, desde, hasta);
            resumenEquipo.push({
                nombre: persona.name.trim(),
                presupuestos: a.presupuestos, fabrica: a.enviadosAFabrica,
                cerradas: a.tareasCerradas, resenas: a.resenasPedidas,
            });

            const hizoAlgo = a.presupuestos + a.enviadosAFabrica + a.tareasCerradas > 0;

            const cuerpo = [
                `📋 Tu resumen del ${etiqueta}`,
                ``,
                `• Clientes con presupuesto: ${contar(a.presupuestos, 'cliente', 'clientes', 'ninguno (0)')}`,
                `• Pedidos que enviaste a fábrica: ${contar(a.enviadosAFabrica, 'pedido', 'pedidos', 'ninguno (0)')}`,
                `• Tareas que terminaste: ${contar(a.tareasCerradas, 'tarea', 'tareas', 'ninguna (0)')}`,
                // Se aclara que va DENTRO de las tareas: sin eso, "12 tareas" y
                // "8 comentarios" se leen como 20 cosas distintas.
                `• Comentarios que pediste: ${contar(a.resenasPedidas, 'comentario', 'comentarios', 'ninguno (0)')}`
                    + (a.resenasPedidas > 0 ? ` (van incluidos en las tareas de arriba)` : ''),
                ``,
                hizoAlgo ? `¡Buen trabajo! 💪` : `Ayer no quedó registrada actividad tuya en el sistema.`,
            ].join('\n');

            const r = await InternalMessagingService.mensajeDeIA({
                paraUserId: persona.id,
                cuerpo,
                asunto: 'Resumen diario',
                // Lleva la fecha adentro: el resumen de hoy no se repite, el de
                // mañana tiene otro prefijo y sale igual.
                dedupePrefijo: `📋 Tu resumen del ${etiqueta}`,
            }).catch(err => { console.error(`[ResumenDiario] ${persona.name}:`, err); return null; });

            if (r) enviados.push(persona.name);
        }

        // A los ADMIN, además, el consolidado del equipo: para eso hay que poder
        // comparar en una sola pantalla, no abrir el resumen de cada uno.
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
        if (admins.length > 0 && resumenEquipo.length > 0) {
            const totales = resumenEquipo.reduce(
                (t, r) => ({ p: t.p + r.presupuestos, f: t.f + r.fabrica, c: t.c + r.cerradas, s: t.s + r.resenas }),
                { p: 0, f: 0, c: 0, s: 0 },
            );
            const cuerpo = [
                `📊 Resumen del equipo — ${etiqueta}`,
                ``,
                ...resumenEquipo.map(r =>
                    `• ${r.nombre}\n    ${r.presupuestos} presupuesto(s) · ${r.fabrica} a fábrica · ${r.cerradas} tarea(s) · ${r.resenas} comentario(s)`),
                ``,
                `Total del día: ${totales.p} presupuesto(s), ${totales.f} enviado(s) a fábrica, ${totales.c} tarea(s) terminada(s), ${totales.s} comentario(s) pedido(s).`,
            ].join('\n');

            for (const admin of admins) {
                await InternalMessagingService.mensajeDeIA({
                    paraUserId: admin.id, cuerpo, asunto: 'Resumen del equipo',
                    dedupePrefijo: `📊 Resumen del equipo — ${etiqueta}`,
                }).catch(err => console.error('[ResumenDiario] consolidado:', err));
            }
        }

        return NextResponse.json({ ok: true, dia: etiqueta, enviados });
    } catch (e: any) {
        // El detalle va al log del servidor, no a la respuesta: `e.message` de
        // Prisma incluye nombres de tabla y de columna.
        console.error('[ResumenDiario]', e);
        return NextResponse.json({ error: 'No se pudo generar el resumen' }, { status: 500 });
    }
}
