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
/**
 * Solo respuestas de los últimos N días. La primera corrida (12/9/2026) creó
 * 87 tareas de golpe, muchas de respuestas de julio al robot viejo ("Gracias",
 * "Ok", reacciones): una tarea sobre una charla de dos meses no le sirve a
 * nadie y tapa las que sí. Las más viejas se cancelan solas.
 */
export const VENTANA_RESPUESTAS_DIAS = 14;

export interface ChatConRespuesta {
    clientId: string;
    lastFollowUpAt: Date | null;
    lastInboundAt: Date | null;
}

/** Puro: ¿esta charla tiene una respuesta posterior al último seguimiento? */
export function respondioAlSeguimiento(c: ChatConRespuesta): boolean {
    return Boolean(c.lastFollowUpAt && c.lastInboundAt && c.lastInboundAt.getTime() > c.lastFollowUpAt.getTime());
}

/** Crea las tareas que falten (respuestas de los últimos 14 días) y cancela las de respuestas más viejas. Devuelve cuántas creó. */
export async function tareasPorRespuestasSinAtender(now = Date.now()): Promise<number> {
    const limite = new Date(now - VENTANA_RESPUESTAS_DIAS * 24 * 3_600_000);

    // Limpieza: tareas vivas cuya charla no tiene respuesta reciente (la
    // respuesta que las originó es más vieja que la ventana).
    const vivas = await prisma.clientTask.findMany({
        where: { status: 'PENDING', description: { startsWith: PREFIJO_RESPUESTA } },
        select: { id: true, clientId: true },
    });
    if (vivas.length) {
        const chatsDeVivas = await prisma.whatsAppChat.findMany({
            where: { clientId: { in: vivas.map(t => t.clientId) } },
            select: { clientId: true, lastInboundAt: true },
        });
        const ultimaRespuesta = new Map<string, number>();
        for (const c of chatsDeVivas) if (c.clientId && c.lastInboundAt) ultimaRespuesta.set(c.clientId, Math.max(ultimaRespuesta.get(c.clientId) ?? 0, c.lastInboundAt.getTime()));
        const viejas = vivas.filter(t => (ultimaRespuesta.get(t.clientId) ?? 0) < limite.getTime()).map(t => t.id);
        if (viejas.length) {
            await prisma.clientTask.updateMany({ where: { id: { in: viejas } }, data: { status: 'CANCELLED', completedBy: CREADO_POR, completedAt: new Date(now) } });
        }
    }

    const chats = await prisma.whatsAppChat.findMany({
        where: { clientId: { not: null }, lastFollowUpAt: { not: null }, lastInboundAt: { gte: limite } },
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
