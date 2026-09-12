import { prisma } from '@/lib/db';

/**
 * Red de seguridad diaria: toda respuesta a un seguimiento tiene su tarea.
 *
 * El wa-service crea la tarea del vendedor en el momento en que llega la
 * respuesta (`wa-service/shared/respuesta-a-seguimiento.js`). Esto es el
 * mismo criterio, corrido una vez por día desde `correrDiario`: agarra lo que
 * ese camino no cubrió (respuestas anteriores al 12/9/2026 —Sole, Cami,
 * David…—, un webhook caído, un reinicio a mitad del guardado). Regla de
 * Ishtar: "si el cliente responde y nadie tiene una tarea, el embudo se pierde".
 *
 * Misma marca que el wa-service para no duplicar: `PREFIJO`.
 */
export const PREFIJO_RESPUESTA = '💬 Respondió al seguimiento';
const CREADO_POR = 'Sistema (Embudo)';

export interface ChatConRespuesta {
    clientId: string;
    lastFollowUpAt: Date | null;
    lastInboundAt: Date | null;
}

/** Puro: ¿esta charla tiene una respuesta posterior al último seguimiento? */
export function respondioAlSeguimiento(c: ChatConRespuesta): boolean {
    return Boolean(c.lastFollowUpAt && c.lastInboundAt && c.lastInboundAt.getTime() > c.lastFollowUpAt.getTime());
}

/** Crea las tareas que falten. Devuelve cuántas creó. */
export async function tareasPorRespuestasSinAtender(): Promise<number> {
    const chats = await prisma.whatsAppChat.findMany({
        where: { clientId: { not: null }, lastFollowUpAt: { not: null }, lastInboundAt: { not: null } },
        select: { id: true, clientId: true, lastFollowUpAt: true, lastInboundAt: true },
    });
    const conRespuesta = chats.filter(c => respondioAlSeguimiento(c as ChatConRespuesta));
    if (conRespuesta.length === 0) return 0;

    const clientIds = conRespuesta.map(c => c.clientId!);
    // Una tarea por respuesta: si ya hay una viva (o una cerrada DESPUÉS del
    // seguimiento, o sea que el vendedor ya la atendió), no se repite.
    const tareas = await prisma.clientTask.findMany({
        where: { clientId: { in: clientIds }, description: { startsWith: PREFIJO_RESPUESTA } },
        select: { clientId: true, status: true, createdAt: true },
    });
    let creadas = 0;
    for (const c of conRespuesta) {
        const yaHay = tareas.some(t => t.clientId === c.clientId && (t.status === 'PENDING' || t.createdAt.getTime() > c.lastFollowUpAt!.getTime()));
        if (yaHay) continue;
        const ultimo = await prisma.whatsAppMessage.findFirst({
            where: { chatId: c.id, direction: 'INBOUND', createdAt: { gt: c.lastFollowUpAt! } },
            orderBy: { createdAt: 'asc' },
            select: { content: true, type: true },
        });
        const resumen = ultimo?.type === 'TEXT'
            ? `«${(ultimo.content || '').replace(/\s+/g, ' ').trim().slice(0, 160)}»`
            : `[${(ultimo?.type || 'mensaje').toLowerCase()}]`;
        await prisma.clientTask.create({
            data: {
                clientId: c.clientId!,
                type: 'TASK',
                status: 'PENDING',
                dueDate: new Date(),
                createdBy: CREADO_POR,
                description: `${PREFIJO_RESPUESTA}: ${resumen} — contestarle y definir (seguir / ganado / perdido).`,
            },
        });
        creadas++;
    }
    return creadas;
}
