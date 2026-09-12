import { prisma } from '@/lib/db';
import { PIPELINE_COLUMNS, type PipelineStageKey, type PipelineLead, type PipelineColumn, type PipelineStats } from '@/types/leads';
import { classifyLead } from '@/lib/leads-pipeline';
import { proximaAccion, ordenarPorUrgencia } from '@/lib/embudo/playbook';
import { sincronizarTareasDelDia, type ResultadoSync } from '@/lib/embudo/sincronizar-tareas';
import { TAGS_NO_CLIENTE } from '@/lib/no-cliente';
import { tieneEtiquetaDeVisita } from '@/lib/embudo/visito-local';
import { presupuestoFueEnviado, MARCA_PDF_ENVIADO } from '@/lib/embudo/presupuesto-enviado';
import { tareasPorRespuestasSinAtender } from '@/lib/embudo/respuestas-a-seguimientos';

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
            // Turnos ya cumplidos: señal (floja) de que pasó por el local.
            // Ver el porqué del criterio en `lib/embudo/visito-local.ts`.
            tasks: { where: { type: 'TURNO' }, select: { dueDate: true } },
            // La señal BUENA: el botón "Visita" de la ficha, que el equipo ya usa.
            interactions: { where: { type: 'STORE_VISIT' }, select: { id: true }, take: 1 },
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

        // ── Último mensaje de una PERSONA por chat ──────────────────────────
        // UNA sola consulta agrupada, no una por lead: con 339 leads eso serían
        // 339 idas a la base cada vez que alguien abre el tablero (que además
        // se refresca solo).
        //
        // Para qué: dentro de la ventana de 24 h el equipo contesta con texto
        // libre, y eso no deja etiqueta. Sin este dato el tablero marcaba "Sin
        // contactar" a 194 de 339 leads a los que sí les habían escrito.
        // 'Bot' y 'Sistema Atelier' no cuentan: la pregunta es si una PERSONA
        // se ocupó.
        const chatIds = leads.map(l => l.whatsappChats[0]?.id).filter((x): x is string => !!x);
        const ultimoHumanoPorChat = new Map<string, Date>();
        if (chatIds.length > 0) {
            const filas = await prisma.whatsAppMessage.groupBy({
                by: ['chatId'],
                where: {
                    chatId: { in: chatIds },
                    direction: 'OUTBOUND',
                    senderName: { notIn: ['Bot', 'Sistema Atelier'] },
                },
                _max: { createdAt: true },
            });
            for (const f of filas) {
                if (f._max.createdAt) ultimoHumanoPorChat.set(f.chatId, f._max.createdAt);
            }
        }

        // ¿El presupuesto le LLEGÓ? La nota "📄 Presupuesto enviado" (PDF) o un
        // mensaje humano posterior lo prueban; sin eso, el lead sigue SIN
        // presupuesto para el embudo (ver presupuesto-enviado.ts: a Alina se le
        // preguntó "¿pudiste ver el presupuesto?" por uno que nunca se mandó).
        const pdfPorCliente = new Map<string, Date>();
        const conPresupuesto = leads.filter(l => l.orders[0]).map(l => l.id);
        if (conPresupuesto.length > 0) {
            const notas = await prisma.interaction.groupBy({
                by: ['clientId'],
                where: { clientId: { in: conPresupuesto }, type: 'NOTE', content: { startsWith: MARCA_PDF_ENVIADO } },
                _max: { createdAt: true },
            });
            for (const n of notas) if (n._max.createdAt) pdfPorCliente.set(n.clientId, n._max.createdAt);
        }

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
            const ultimoMensajeHumano = chat ? ultimoHumanoPorChat.get(chat.id) ?? null : null;
            const enviado = presupuestoFueEnviado({
                quoteCreatedAt: latestQuote?.createdAt ?? null,
                pdfEnviadoAt: pdfPorCliente.get(lead.id) ?? null,
                ultimoMensajeHumano,
            });
            const quoteCreatedAt = enviado ? latestQuote!.createdAt : null;
            const borradorSinEnviar = latestQuote && !enviado ? latestQuote.createdAt : null;

            const { stage, contactado, escalonCubierto } = classifyLead({
                quoteCreatedAt,
                hasPrescription: !!latestRx,
                chatLabels,
                tagNames: lead.tags.map(t => t.name),
                ultimoMensajeHumano,
                now,
            });

            const visitoElLocal = lead.interactions.length > 0
                || tieneEtiquetaDeVisita(lead.tags.map(t => t.name))
                || lead.tasks.some(t => t.dueDate !== null && t.dueDate.getTime() < now);

            const accion = proximaAccion({
                stage,
                escalonCubierto,
                hasPrescription: !!latestRx,
                visitoElLocal,
                quoteCreatedAt,
                borradorSinEnviar,
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
    async correrDiario(now = Date.now()): Promise<{ paraHoy: Tablero['paraHoy']; sync: ResultadoSync; respuestas: number; linea: string }> {
        const { paraHoy } = await EmbudoService.tablero(now);
        const sync = await sincronizarTareasDelDia(paraHoy);
        // Respuestas a seguimientos que quedaron sin tarea del vendedor (red diaria).
        const respuestas = await tareasPorRespuestasSinAtender().catch(err => { console.error('[Embudo] tareas por respuestas:', err); return 0; });
        return { paraHoy, sync, respuestas, linea: EmbudoService.armarLinea(paraHoy, sync, respuestas) };
    },

    /** La línea de texto del resumen diario. Separada de `correrDiario` para
     * poder probarla sola, sin tocar la base. */
    armarLinea(paraHoy: Tablero['paraHoy'], sync: ResultadoSync, respuestas = 0): string {
        const avisoRespuestas = respuestas ? `\n    💬 ${respuestas} cliente(s) respondieron a un seguimiento y quedaron sin tarea: ya la tienen (campanita).` : '';
        if (paraHoy.length === 0) return `🎯 Embudo: nadie con seguimiento vencido. Al día.${avisoRespuestas}`;
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
        return `🎯 Embudo — para hoy: ${partes.join(' · ')}.${tareas}\n    ${primeros}${paraHoy.length > 5 ? ` y ${paraHoy.length - 5} más` : ''} → /admin/leads${avisoRespuestas}`;
    },
};
