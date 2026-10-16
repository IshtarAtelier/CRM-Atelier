import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { SYSTEM_ACTOR } from '@/lib/actor';
import { CRM_ORIGIN } from '@/lib/constants';
import { InternalMessagingService } from '@/services/internal-messaging.service';
import { diaArt, inicioDelDiaArt } from './registro';

/**
 * CUANDO EL CLIENTE RESPONDE AL MOTOR (o al bot), UN HUMANO LO VE EL MISMO DÍA.
 *
 * Plan de la tienda del 15/10/2026 (3.5). En el mes, 6 personas contestaron a
 * un seguimiento automático y en 4 chats ningún humano retomó; el motor
 * siguió su cadencia y cerró con "seguinos en Instagram". Acá, por cada
 * respuesta que el motor lee y clasifica como "seguir" (no fue un no, no fue
 * un "más adelante"):
 *   1. una tarea en la ficha con vencimiento HOY, tipo `TIPO_TAREA`, firmada
 *      Sistema — es lo que ve el vendedor en su campanita;
 *   2. un aviso por la mensajería interna a todo el equipo, con el link a la
 *      ficha y lo que dijo el cliente.
 *
 * Una vez por persona y por día: la tarea se busca por tipo + cliente +
 * creada hoy (ART), y el aviso usa el dedup de 20 h de `mensajeDeIA`.
 *
 * Esto convive con la decisión del 8/10 ("en embudo no debe haber nada para
 * humano"): el embudo sigue 100 % automático; lo que vuelve a una persona es
 * SOLO la respuesta del cliente, que antes se perdía.
 */
export const TIPO_TAREA = 'RESPUESTA_CLIENTE';

export interface RetomeHumano {
    clientId: string;
    nombre: string;
    /** Lo que escribió el cliente (ya recortado por quien llama). */
    palabras: string | null;
    /** Qué plantilla contestó, si se sabe. */
    plantilla?: string | null;
    now?: number;
}

/** Fin del día de hoy, hora de Córdoba (vencimiento de la tarea). */
export function finDelDiaArt(now: number = Date.now()): Date {
    const inicio = inicioDelDiaArt(now);
    return new Date(inicio.getTime() + 24 * 3_600_000 - 1);
}

export async function asegurarRetomeHumano(input: RetomeHumano): Promise<{ tareaCreada: boolean; avisados: number }> {
    const now = input.now ?? Date.now();
    const dia = diaArt(now);
    const cita = input.palabras ? `«${input.palabras.replace(/\s+/g, ' ').trim().slice(0, 160)}»` : '(sin texto: audio, foto o reacción)';
    const ficha = `${CRM_ORIGIN}/admin/contactos?clientId=${input.clientId}`;

    // ── 1. La tarea de hoy ───────────────────────────────────────────────
    const yaHay = await prisma.clientTask.findFirst({
        where: { clientId: input.clientId, type: TIPO_TAREA, status: 'PENDING', createdAt: { gte: inicioDelDiaArt(now) } },
        select: { id: true },
    });
    let tareaCreada = false;
    if (!yaHay) {
        const descripcion = `💬 Respondió al seguimiento${input.plantilla ? ` (${input.plantilla})` : ''}: ${cita}. Retomar HOY por WhatsApp — nadie del equipo le escribió desde que contestó.`;
        await prisma.clientTask.create({
            data: {
                clientId: input.clientId,
                description: descripcion,
                dueDate: finDelDiaArt(now),
                status: 'PENDING',
                type: TIPO_TAREA,
                createdBy: SYSTEM_ACTOR.name,
            },
            select: { id: true },
        });
        tareaCreada = true;
        await prisma.interaction.create({
            data: {
                clientId: input.clientId, type: 'NOTE', userId: SYSTEM_ACTOR.id, userName: SYSTEM_ACTOR.name,
                content: `🔔 ${SYSTEM_ACTOR.name} abrió una tarea para hoy: el cliente respondió al seguimiento automático ${cita} y ningún humano retomó.`,
            },
        }).catch(console.error);
        logAudit({
            userId: SYSTEM_ACTOR.id, userName: SYSTEM_ACTOR.name, action: 'CREATE', entityType: 'TASK', entityId: input.clientId,
            details: { origen: 'motor-seguimientos', accion: 'respuesta-del-cliente', dia, plantilla: input.plantilla ?? null, palabras: input.palabras?.slice(0, 160) ?? null },
        }).catch(console.error);
    }

    // ── 2. El aviso al equipo ────────────────────────────────────────────
    const prefijo = `💬 ${input.nombre} respondió al seguimiento`;
    const cuerpo =
        `${prefijo} y nadie le contestó todavía.\n` +
        `Dijo: ${cita}\n` +
        `Ficha: ${ficha}\n` +
        `Hay una tarea para HOY en su ficha. Hasta que una persona le escriba, el motor no la cierra.`;
    const equipo = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'STAFF'] } }, select: { id: true } });
    let avisados = 0;
    for (const u of equipo) {
        try {
            const r = await InternalMessagingService.mensajeDeIA({ paraUserId: u.id, cuerpo, asunto: 'Respuesta de un cliente', dedupePrefijo: prefijo });
            if (r) avisados++;
        } catch (err) {
            console.error(`[Retome humano] No se pudo avisar a ${u.id}:`, err);
        }
    }
    return { tareaCreada, avisados };
}
