import { prisma } from '@/lib/db';
import { TIPO_EMBUDO } from '@/lib/tareas/origen';
import type { PipelineLead, PipelineStageKey } from '@/types/leads';

/**
 * El embudo YA NO CREA TAREAS para personas (decisión de Ishtar, 8/10/2026:
 * "en embudo no debe haber nada para humano"). Hasta ese día este módulo
 * materializaba "lo de hoy" como `ClientTask` tipo EMBUDO para el dock del
 * vendedor; en producción había 250 pendientes y las 250 vencidas —111 de
 * "Definir: ganado o perdido" que nadie podía cerrar y 137 de plantillas que
 * el motor vetó—, y los vendedores habían cerrado 11 en todo septiembre. Lo
 * que el motor no puede mandar hoy lo reintenta mañana, lo cierra solo o lo
 * apagó alguien a propósito; ninguna de las tres cosas es una tarea.
 *
 * Queda la limpieza: cada corrida diaria cancela lo que haya quedado vivo con
 * este firmante (las 250 de la primera corrida, y cualquier residuo), y
 * `cerrarTareaDelEmbudo` sigue existiendo para que el envío a mano desde el
 * buzón no deje colgada una tarea vieja.
 */
const CREADO_POR = 'Sistema (Embudo)';

type LeadDeHoy = PipelineLead & { stage: PipelineStageKey };

export interface ResultadoSync {
    creadas: number;
    actualizadas: number;
    cerradas: number;
}

/** Cierra, si existe, la tarea del embudo de un cliente puntual (residuos de antes del 8/10/2026). */
export async function cerrarTareaDelEmbudo(clientId: string, completadaPor: string = CREADO_POR): Promise<void> {
    await prisma.clientTask.updateMany({
        where: { clientId, type: TIPO_EMBUDO, status: 'PENDING', createdBy: CREADO_POR },
        data: { status: 'COMPLETED', completedBy: completadaPor, completedAt: new Date() },
    });
}

/** Solo limpia: cancela toda tarea del embudo que siga pendiente. No crea ninguna. */
export async function sincronizarTareasDelDia(_paraHoy: LeadDeHoy[]): Promise<ResultadoSync> {
    const r = await prisma.clientTask.updateMany({
        where: { type: { in: [TIPO_EMBUDO, 'TASK'] }, status: 'PENDING', createdBy: CREADO_POR },
        data: { status: 'CANCELLED', completedBy: CREADO_POR, completedAt: new Date() },
    });
    return { creadas: 0, actualizadas: 0, cerradas: r.count };
}
