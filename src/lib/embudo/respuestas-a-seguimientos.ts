import { prisma } from '@/lib/db';

/**
 * Las respuestas a un seguimiento YA NO crean tareas del vendedor (decisión
 * de Ishtar, 8/10/2026: "en embudo no debe haber nada para humano").
 *
 * Hasta ese día, la primera respuesta del cliente creaba "💬 Respondió al
 * seguimiento: «…» — contestarle y definir" (acá como red diaria y en
 * `wa-service/shared/respuesta-a-seguimiento.js` al instante). La charla la
 * contesta el bot; qué quiso decir el cliente lo lee el motor
 * (`lib/embudo/respuesta.ts`): un "no" cierra como perdido, un "más adelante"
 * pausa, y lo demás sigue la cadencia. Si el bot necesita a una persona, la
 * deriva por su propio camino (`derivation_notification`).
 *
 * Queda la limpieza de las que ya existían.
 */
export const PREFIJO_RESPUESTA = '💬 Respondió al seguimiento';
const CREADO_POR = 'Sistema (Respuestas)';

export interface ChatConRespuesta {
    clientId: string;
    lastFollowUpAt: Date | null;
    lastInboundAt: Date | null;
}

/** Puro: ¿esta charla tiene una respuesta posterior al último seguimiento? */
export function respondioAlSeguimiento(c: ChatConRespuesta): boolean {
    return Boolean(c.lastFollowUpAt && c.lastInboundAt && c.lastInboundAt.getTime() > c.lastFollowUpAt.getTime());
}

/** Cancela las tareas por respuesta que sigan pendientes. Devuelve cuántas cerró. */
export async function tareasPorRespuestasSinAtender(now = Date.now()): Promise<number> {
    const r = await prisma.clientTask.updateMany({
        where: { status: 'PENDING', description: { startsWith: PREFIJO_RESPUESTA } },
        data: { status: 'CANCELLED', completedBy: CREADO_POR, completedAt: new Date(now) },
    });
    return r.count;
}
