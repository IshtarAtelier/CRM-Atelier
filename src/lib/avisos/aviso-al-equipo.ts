/**
 * AVISOS DEL SISTEMA AL EQUIPO.
 *
 * Cuando algo automático se cae —la confirmación de compra que no salió ni por
 * mail ni por WhatsApp, el aviso de despacho, el "listo para retirar"— alguien
 * tiene que hacerlo a mano. Hasta el 10/9/2026 eso nacía como una `ClientTask`
 * y aterrizaba en la campanita de Tareas, mezclado con lo que el vendedor
 * había programado.
 *
 * Decisión de Ishtar (10/9/2026): que lleguen como MENSAJE DEL SISTEMA a la
 * mensajería interna del equipo. Tareas queda para lo que programa una
 * persona; esto es una novedad que hay que leer, no una tarea de agenda.
 *
 * Nunca lanza: un aviso que rompe la operación que estaba avisando es peor que
 * el silencio. Falla a `console.error`, igual que `logAudit`.
 */

import { InternalMessagingService } from '@/services/internal-messaging.service';

export interface AvisoAlEquipo {
    /**
     * El titular, corto y con el dato que identifica el caso (el nº de pedido).
     * Ej: '⚠️ No salió la confirmación de compra #5LXO'.
     *
     * Va como PRIMERA LÍNEA DEL CUERPO, no como asunto del hilo: la
     * conversación con el Asistente se reusa siempre (así la bandeja no junta
     * treinta hilos del robot), y su asunto quedó fijado la primera vez que le
     * escribió. Se probó en local: mandar `subject` a un hilo que ya existe no
     * cambia nada, y el aviso aparecía sin título adentro del "Resumen diario".
     *
     * Es también la llave del dedup, así que tiene que distinguir un caso de
     * otro — sin el nº de pedido, dos clientes distintos en el mismo día se
     * pisan y el segundo aviso no sale.
     */
    asunto: string;
    /** El cuerpo, en criollo y con lo que hay que hacer. */
    cuerpo: string;
    /**
     * Marca de "esto ya lo mandé": si en las últimas 20 h salió un mensaje que
     * empieza igual, no se repite. Por default es el `asunto`. Los crons de
     * este proyecto disparan dos veces a propósito (GitHub se come schedules),
     * así que todo aviso necesita su dedup.
     */
    dedupePrefijo?: string;
    /** Tapa la pantalla hasta que lo lean. Reservado para lo que no puede esperar. */
    urgente?: boolean;
}

/**
 * Le manda el aviso a todo el equipo interno (ADMIN + STAFF), cada uno en su
 * conversación con el Asistente.
 *
 * Devuelve a cuántas personas les llegó — 0 si no hay equipo cargado o si
 * falló, para que el llamador pueda loguearlo si le importa.
 */
export async function avisarAlEquipo(aviso: AvisoAlEquipo): Promise<number> {
    try {
        // Los mismos colaboradores que ve el selector de la mensajería: una sola
        // definición de "el equipo" (antes estaba copiada acá).
        const equipo = await InternalMessagingService.listarColaboradores();
        if (!equipo.length) {
            console.warn('[Aviso al equipo] No hay usuarios internos a quién avisar:', aviso.asunto);
            return 0;
        }

        const cuerpo = `${aviso.asunto}\n\n${aviso.cuerpo}`;

        let llegaron = 0;
        for (const persona of equipo) {
            try {
                const enviado = await InternalMessagingService.mensajeDeIA({
                    paraUserId: persona.id,
                    asunto: aviso.asunto,
                    cuerpo,
                    urgent: aviso.urgente,
                    dedupePrefijo: aviso.dedupePrefijo || aviso.asunto,
                });
                if (enviado) llegaron++;
            } catch (err) {
                // Que a uno no le llegue no puede dejar sin aviso al resto.
                console.error('[Aviso al equipo] No se pudo avisar a un colaborador:', err);
            }
        }
        return llegaron;
    } catch (err) {
        console.error('[Aviso al equipo] Falló el aviso:', aviso.asunto, err);
        return 0;
    }
}
