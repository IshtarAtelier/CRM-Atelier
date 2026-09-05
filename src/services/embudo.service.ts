import { prisma } from '@/lib/db';
import { PIPELINE_COLUMNS, type PipelineStageKey, type PipelineLead, type PipelineColumn, type PipelineStats } from '@/types/leads';
import { classifyLead } from '@/lib/leads-pipeline';
import { proximaAccion, ordenarPorUrgencia } from '@/lib/embudo/playbook';
import { sincronizarTareasDelDia, type ResultadoSync } from '@/lib/embudo/sincronizar-tareas';
import { TAGS_NO_CLIENTE } from '@/lib/no-cliente';

/**
 * EmbudoService — el tablero de leads (/admin/leads) y "lo de hoy".
 *
 * Antes esta lógica vivía adentro de la ruta GET /api/leads/pipeline. Se
 * movió acá para que el resumen diario del equipo cuente exactamente lo mismo
 * que ve el tablero: una sola consulta, una sola clasificación, un solo
 * playbook. Si el tablero dice "8 para hoy", el mail de la mañana dice 8.
 *
 * Qué es un lead del embudo: una ficha en estado CONTACT, no borrada, sin
 * ninguna venta (SALE/ORDER) y sin etiqueta de exclusión. La columna la
 * decide classifyLead (etiquetas de seguimiento vs. antigüedad del
 * presupuesto) y el paso siguiente lo decide el playbook.
 */

/**
 * Etiquetas que sacan a alguien del embudo. Las de "no es un cliente"
 * (proveedor, laboratorio, mayorista) salen del helper compartido con
 * Oportunidades de Cierre: una ficha marcada desaparece de los dos lados.
 */
const EXCLUSION_TAGS = [
    'no interesado', 'cancelar bot', 'spam', 'no bot', 'cerrado', 'post-venta',
    ...TAGS_NO_CLIENTE,
];

export interface Tablero {
    columns: Record<PipelineStageKey, PipelineColumn>;
    stats: PipelineStats;
    /** Los leads con un paso vencido, del más atrasado al menos. */
    paraHoy: (PipelineLead & { stage: PipelineStageKey })[];
}

async function leadsCalificados() {
    const leads = await prisma.client.findMany({
        where: {
            status: 'CONTACT',
            isDeleted: false,
            orders: { none: { isDeleted: false, orderType: { in: ['SALE', 'ORDER'] } } },
        },
        include: {
            prescriptions: { orderBy: { date: 'desc' }, take: 1 },
            orders: { where: { isDeleted: false, orderType: 'QUOTE' }, orderBy: { createdAt: 'desc' }, take: 1 },
            tags: true,
            // Siempre el chat más reciente: hay clientes con dos chats y sin
            // este orden la etiqueta se lee del equivocado.
            whatsappChats: { orderBy: { lastMessageAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
    });
    return leads.filter(lead =>
        !lead.tags.some(tag => EXCLUSION_TAGS.some(ex => tag.name.toLowerCase().includes(ex))),
    );
}

export const EmbudoService = {
    async tablero(now = Date.now()): Promise<Tablero> {
        const leads = await leadsCalificados();

        const columns = {} as Record<PipelineStageKey, PipelineColumn>;
        for (const [key, cfg] of Object.entries(PIPELINE_COLUMNS)) {
            columns[key as PipelineStageKey] = { title: cfg.title, color: cfg.color, icon: cfg.icon, count: 0, totalAmount: 0, leads: [] };
        }

        const paraHoy: Tablero['paraHoy'] = [];

        for (const lead of leads) {
            const latestQuote = lead.orders[0] ?? null;
            const latestRx = lead.prescriptions[0];
            const chat = lead.whatsappChats[0] ?? null;
            const chatLabels = chat?.chatLabels || [];

            const { stage, contactado } = classifyLead({
                quoteCreatedAt: latestQuote?.createdAt ?? null,
                hasPrescription: !!latestRx,
                chatLabels,
                tagNames: lead.tags.map(t => t.name),
                now,
            });

            const accion = proximaAccion({
                stage,
                contactado,
                quoteCreatedAt: latestQuote?.createdAt ?? null,
                createdAt: lead.createdAt,
                tieneChat: !!chat,
                chatLabels,
                now,
            });

            const formatted: PipelineLead = {
                id: lead.id,
                name: lead.name,
                phone: lead.phone,
                dni: lead.dni,
                insurance: lead.insurance,
                priority: lead.priority,
                isFavorite: lead.isFavorite,
                createdAt: lead.createdAt.toISOString(),
                interest: lead.interest,
                contactSource: lead.contactSource,
                latestRx: latestRx ? {
                    id: latestRx.id,
                    date: latestRx.date.toISOString(),
                    sphereOD: latestRx.sphereOD,
                    cylinderOD: latestRx.cylinderOD,
                    sphereOI: latestRx.sphereOI,
                    cylinderOI: latestRx.cylinderOI,
                    addition: latestRx.addition || latestRx.additionOD || latestRx.additionOI || null,
                } : null,
                latestQuote: latestQuote ? { id: latestQuote.id, total: latestQuote.total, createdAt: latestQuote.createdAt.toISOString() } : null,
                waChatId: chat?.id || null,
                contactado,
                proximaAccion: accion,
            };

            const col = columns[stage];
            col.leads.push(formatted);
            col.count++;
            if (latestQuote) col.totalAmount += latestQuote.total;
            if (accion.vencida) paraHoy.push({ ...formatted, stage });
        }

        return {
            columns,
            stats: {
                totalLeads: leads.length,
                totalValue: Object.values(columns).reduce((s, c) => s + c.totalAmount, 0),
                paraHoy: paraHoy.length,
            },
            paraHoy: ordenarPorUrgencia(paraHoy),
        };
    },

    /**
     * Corre UNA VEZ POR DÍA (la llama /api/cron/resumen-diario-equipo, que ya
     * tiene el guard de "una vez por día" y el horario). Hace las dos cosas
     * que dependen del mismo tablero, para no calcularlo dos veces:
     *   1. materializa "para hoy" como ClientTask reales — visibles en el
     *      dashboard y en la ficha del cliente, no solo en /admin/leads;
     *   2. arma la línea de texto para el resumen del equipo.
     */
    async correrDiario(now = Date.now()): Promise<{ paraHoy: Tablero['paraHoy']; sync: ResultadoSync; linea: string }> {
        const { paraHoy } = await EmbudoService.tablero(now);
        const sync = await sincronizarTareasDelDia(paraHoy);
        return { paraHoy, sync, linea: EmbudoService.armarLinea(paraHoy, sync) };
    },

    /** La línea de texto del resumen diario. Separada de `correrDiario` para
     * poder probarla sola, sin tocar la base. */
    armarLinea(paraHoy: Tablero['paraHoy'], sync: ResultadoSync): string {
        if (paraHoy.length === 0) return '🎯 Embudo: nadie con seguimiento vencido. Al día.';
        const porTipo = { plantilla: 0, cotizar: 0, decidir: 0 };
        for (const l of paraHoy) if (l.proximaAccion.tipo in porTipo) porTipo[l.proximaAccion.tipo as keyof typeof porTipo]++;
        const partes = [
            porTipo.plantilla ? `${porTipo.plantilla} seguimiento(s) para mandar` : null,
            porTipo.cotizar ? `${porTipo.cotizar} sin cotizar` : null,
            porTipo.decidir ? `${porTipo.decidir} para cerrar (ganado/perdido)` : null,
        ].filter(Boolean);
        const primeros = paraHoy.slice(0, 5).map(l => `${l.name.split(' ')[0]} (${l.proximaAccion.etiqueta.replace(/^Hoy: /, '')})`).join(', ');
        // Las tareas quedan en el dashboard de TODOS (TasksPanel) y en la
        // ficha de cada cliente — el mail es el aviso, la tarea es donde se
        // tacha. `actualizadas` no se muestra: para el equipo es la misma
        // tarea de ayer, solo cambió internamente el texto del paso.
        const tareas = sync.creadas || sync.cerradas
            ? ` (${sync.creadas} tarea(s) nueva(s) en el dashboard${sync.cerradas ? `, ${sync.cerradas} cerrada(s) sola(s) porque ya se resolvieron` : ''})`
            : '';
        return `🎯 Embudo — para hoy: ${partes.join(' · ')}.${tareas}\n    ${primeros}${paraHoy.length > 5 ? ` y ${paraHoy.length - 5} más` : ''} → /admin/leads`;
    },
};
