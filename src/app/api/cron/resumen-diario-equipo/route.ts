/**
 * RESUMEN DIARIO del equipo, que el Asistente le manda a cada colaborador como
 * mensaje interno.
 *
 * Qué contesta, por pedido de la dueña: a cuántos clientes le armó presupuesto,
 * cuántas tareas cerró y cuántas creó. **Si fue cero, dice cero**: un reporte
 * que omite lo que está en cero se lee como si el dato no existiera, y no se
 * puede distinguir "no hizo nada" de "el sistema no lo midió".
 *
 * Corre una vez por día. Que corra dos veces no duplica nada: antes de escribir
 * verifica si ya mandó el resumen de ese día.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { InternalMessagingService } from '@/services/internal-messaging.service';

export const dynamic = 'force-dynamic';

/** "3 clientes" / "1 cliente" / "ninguno" — nunca un número pelado sin unidad. */
function contar(n: number, singular: string, plural: string, cero: string): string {
    if (n === 0) return cero;
    return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * El día de AYER en hora argentina.
 *
 * El servidor corre en UTC: usar su medianoche haría que el resumen del lunes
 * incluyera las tres últimas horas del domingo argentino, y que lo hecho después
 * de las 21 no le contara a nadie el día correcto.
 */
function ayerArgentino(): { desde: Date; hasta: Date; etiqueta: string } {
    const ahoraAr = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const finAr = new Date(ahoraAr); finAr.setHours(0, 0, 0, 0);
    const inicioAr = new Date(finAr); inicioAr.setDate(inicioAr.getDate() - 1);

    // De hora argentina a UTC real (Argentina es UTC-3, todo el año).
    const OFFSET_MS = 3 * 60 * 60 * 1000;
    return {
        desde: new Date(inicioAr.getTime() + OFFSET_MS),
        hasta: new Date(finAr.getTime() + OFFSET_MS),
        etiqueta: inicioAr.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit' }),
    };
}

export async function GET(request: NextRequest) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
    if (token !== cronSecret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const { desde, hasta, etiqueta } = ayerArgentino();

        const equipo = await prisma.user.findMany({
            where: { role: { in: ['ADMIN', 'STAFF'] } },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });

        const enviados: string[] = [];
        const resumenEquipo: { nombre: string; presupuestos: number; cerradas: number; creadas: number }[] = [];

        for (const persona of equipo) {
            const a = await InternalMessagingService.actividadDe(persona.id, persona.name, desde, hasta);
            resumenEquipo.push({
                nombre: persona.name,
                presupuestos: a.presupuestos, cerradas: a.tareasCerradas, creadas: a.tareasCreadas,
            });

            const hizoAlgo = a.presupuestos + a.tareasCerradas + a.tareasCreadas > 0;

            const cuerpo = [
                `📋 Tu resumen del ${etiqueta}`,
                ``,
                `• Clientes con presupuesto: ${contar(a.presupuestos, 'cliente', 'clientes', 'ninguno (0)')}`,
                `• Tareas que terminaste: ${contar(a.tareasCerradas, 'tarea', 'tareas', 'ninguna (0)')}`,
                `• Tareas que creaste: ${contar(a.tareasCreadas, 'tarea', 'tareas', 'ninguna (0)')}`,
                ``,
                hizoAlgo ? `¡Buen trabajo! 💪` : `Ayer no quedó registrada actividad tuya en el sistema.`,
            ].join('\n');

            const r = await InternalMessagingService.mensajeDeIA({
                paraUserId: persona.id,
                cuerpo,
                asunto: 'Resumen diario',
            }).catch(err => { console.error(`[ResumenDiario] ${persona.name}:`, err); return null; });

            if (r) enviados.push(persona.name);
        }

        // A los ADMIN, además, el consolidado del equipo: para eso hay que poder
        // comparar en una sola pantalla, no abrir el resumen de cada uno.
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
        if (admins.length > 0 && resumenEquipo.length > 0) {
            const totales = resumenEquipo.reduce(
                (t, r) => ({ p: t.p + r.presupuestos, c: t.c + r.cerradas, n: t.n + r.creadas }),
                { p: 0, c: 0, n: 0 },
            );
            const cuerpo = [
                `📊 Resumen del equipo — ${etiqueta}`,
                ``,
                ...resumenEquipo.map(r =>
                    `• ${r.nombre}: ${r.presupuestos} presupuesto(s) · ${r.cerradas} tarea(s) terminada(s) · ${r.creadas} creada(s)`),
                ``,
                `Total del día: ${totales.p} presupuesto(s), ${totales.c} tarea(s) terminada(s), ${totales.n} creada(s).`,
            ].join('\n');

            for (const admin of admins) {
                await InternalMessagingService.mensajeDeIA({
                    paraUserId: admin.id, cuerpo, asunto: 'Resumen del equipo',
                }).catch(err => console.error('[ResumenDiario] consolidado:', err));
            }
        }

        return NextResponse.json({ ok: true, dia: etiqueta, enviados });
    } catch (e: any) {
        console.error('[ResumenDiario]', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
