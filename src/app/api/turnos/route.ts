import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/turnos — los turnos agendados, del más próximo al más lejano.
 *
 * Un turno es un `ClientTask` con `type: 'TURNO'` y `dueDate` = fecha y hora
 * (ver `wa-service/shared/turnos.js`). Por defecto trae desde el comienzo de
 * HOY: los de más temprano en el día siguen importando aunque ya hayan pasado
 * —hay que saber si la persona vino— y los de ayer ya no.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const dias = Math.min(Number(searchParams.get('dias') || 14), 60);

    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    const hasta = new Date(desde.getTime() + dias * 24 * 3600 * 1000);

    const turnos = await prisma.clientTask.findMany({
        where: { type: 'TURNO', dueDate: { gte: desde, lt: hasta } },
        include: { client: { select: { id: true, name: true, phone: true } } },
        orderBy: { dueDate: 'asc' },
    });

    return NextResponse.json({
        turnos: turnos.map(t => ({
            id: t.id,
            // Las marcas de "ya avisado" que pega el cron son plomería: no van
            // a la pantalla.
            descripcion: t.description.replace(/ ·avisado-(cliente|equipo)/g, '').trim(),
            cuando: t.dueDate,
            estado: t.status,
            avisadoCliente: t.description.includes('·avisado-cliente'),
            cliente: t.client ? { id: t.client.id, nombre: t.client.name, telefono: t.client.phone } : null,
        })),
    });
}
