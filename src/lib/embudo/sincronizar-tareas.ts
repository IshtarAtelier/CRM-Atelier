import { prisma } from '@/lib/db';
import type { PipelineLead, PipelineStageKey } from '@/types/leads';

/**
 * Materializa "lo de hoy" del embudo como `ClientTask` reales — las mismas
 * que ya se muestran en el dashboard (`TasksPanel`) y en la ficha del cliente
 * (`TaskManager`). Sin esto, "para hoy" solo vivía en /admin/leads y en el
 * mail consolidado a los ADMIN una vez por día: un vendedor que no abre esas
 * dos pantallas no tenía dónde enterarse.
 *
 * `type: 'TASK'` a propósito, no `'FOLLOWUP'`: el dashboard y la ficha solo
 * levantan `type: 'TASK'` (`ContactService.getAllPendingTasks` /
 * `ContactService.getTasks`) — las `FOLLOWUP` que crean `contact.service.ts`
 * y `order.service.ts` no aparecen en ningún lado de la UI, quedaron como
 * fósil del motor de seguimientos por IA que las consumía directo de la base.
 *
 * Corre UNA VEZ POR DÍA desde `/api/cron/resumen-diario-equipo` (mismo
 * guard/horario que ya tenía). No corre en cada `GET /api/leads/pipeline`:
 * esa ruta la poll-ea el navegador cada pocos segundos y escribir en la base
 * en cada lectura crearía duplicados por carrera y ensuciaría `updatedAt`.
 *
 * Dedup: una tarea VIVA por cliente, identificada por `createdBy`. Si el
 * paso de hoy cambió (ayer tocaba "seguimiento del presupuesto", hoy "invitar
 * al local"), se ACTUALIZA la misma fila en vez de sumar una nueva — mismo
 * patrón que ya usa el extractor pasivo para "[Extracción Inteligente]"
 * (antes de esa regla, una clienta llegó a juntar 88 tareas apiladas).
 * Si el cliente ya no tiene nada vencido hoy (mandaron el seguimiento,
 * cotizaron, se cerró la venta, se lo descartó), la tarea de ayer se cancela.
 */
const CREADO_POR = 'Sistema (Embudo)';

type LeadDeHoy = PipelineLead & { stage: PipelineStageKey };

function descripcion(lead: LeadDeHoy): string {
    const nombre = lead.name.trim().split(/\s+/)[0] || lead.name;
    const a = lead.proximaAccion;
    switch (a.tipo) {
        case 'plantilla':
            return `Mandarle a ${nombre} por WhatsApp: "${a.etiqueta.replace(/^Hoy: /, '')}"`;
        case 'cotizar':
            return `${nombre} sigue sin presupuesto — cotizar o pedirle la receta`;
        case 'decidir':
            return `Definir a ${nombre}: ganado o perdido (ver ficha)`;
        default:
            return `Revisar a ${nombre} en el embudo`;
    }
}

export interface ResultadoSync {
    creadas: number;
    actualizadas: number;
    cerradas: number;
}

/**
 * Cierra, si existe, la tarea del embudo de un cliente puntual. La usa
 * `registrar-seguimiento.ts` para cerrar el loop EN EL MOMENTO (no esperar a
 * la sincronización de mañana) cuando alguien manda el seguimiento a mano.
 *
 * `completadaPor` es quien mandó el mensaje, no el sistema: mismo criterio
 * que el resto de la trazabilidad (`actividadDe` cuenta "tareas cerradas"
 * por `completedBy`) — si Ana mandó el WhatsApp, la tarea la cerró Ana, y
 * eso tiene que sumar en SU resumen diario, no perderse en "Sistema".
 */
export async function cerrarTareaDelEmbudo(clientId: string, completadaPor: string = CREADO_POR): Promise<void> {
    await prisma.clientTask.updateMany({
        where: { clientId, type: 'TASK', status: 'PENDING', createdBy: CREADO_POR },
        data: { status: 'COMPLETED', completedBy: completadaPor, completedAt: new Date() },
    });
}

export async function sincronizarTareasDelDia(paraHoy: LeadDeHoy[]): Promise<ResultadoSync> {
    const vivas = await prisma.clientTask.findMany({
        where: { type: 'TASK', status: 'PENDING', createdBy: CREADO_POR },
        select: { id: true, clientId: true, description: true },
    });
    const vivaPorCliente = new Map(vivas.map(t => [t.clientId, t]));
    const idsDeHoy = new Set(paraHoy.map(l => l.id));

    let creadas = 0, actualizadas = 0;
    for (const lead of paraHoy) {
        const texto = descripcion(lead);
        // Todo item de "para hoy" viene con `vencida: true`, y esa rama del
        // playbook siempre setea `venceEn` — pero si algún día cambia esa
        // garantía, mejor una tarea con vencimiento de hoy que una sin fecha.
        const dueDate = lead.proximaAccion.venceEn ? new Date(lead.proximaAccion.venceEn) : new Date();
        const viva = vivaPorCliente.get(lead.id);
        if (!viva) {
            await prisma.clientTask.create({
                data: { clientId: lead.id, description: texto, type: 'TASK', status: 'PENDING', dueDate, createdBy: CREADO_POR },
            });
            creadas++;
        } else if (viva.description !== texto) {
            await prisma.clientTask.update({ where: { id: viva.id }, data: { description: texto, dueDate } });
            actualizadas++;
        }
    }

    const aCerrar = vivas.filter(t => !idsDeHoy.has(t.clientId));
    if (aCerrar.length) {
        await prisma.clientTask.updateMany({
            where: { id: { in: aCerrar.map(t => t.id) } },
            data: { status: 'CANCELLED', completedBy: CREADO_POR, completedAt: new Date() },
        });
    }

    return { creadas, actualizadas, cerradas: aCerrar.length };
}
