import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { SYSTEM_ACTOR, type Actor } from '@/lib/actor';
import { PricingService } from '@/services/PricingService';
import {
    TIPO_TAREA_RESENA,
    CREADOR_SEGUNDO_PEDIDO,
    DIAS_PARA_SEGUNDO_PEDIDO,
    DIAS_MAXIMOS_SEGUNDO_PEDIDO,
    DIAS_SIN_RECLAMOS,
    MAX_SEGUNDOS_PEDIDOS_POR_DIA,
    ESTADOS_POSVENTA_CERRADOS,
    TIPOS_INTERACCION_SIN_RECLAMO,
    decidirSegundoPedido,
    descripcionSegundoPedido,
    esTextoDeReclamo,
    cruzarResenasConClientes,
} from '@/lib/resenas/pedido-resena';

/**
 * Pedido de reseña en Google: "ya comentó" y el robot del 2º pedido.
 *
 * El robot (Ishtar, 16/10/2026) NO le escribe a nadie. Vuelve a poner UNA vez
 * la tarea REVIEW_REQUEST delante del vendedor, a los 7 días de que cerró la
 * primera, si el cliente no dejó la reseña y nada indica que esté disconforme.
 * El mensaje lo manda una persona (regla del 10/8/2026: el sistema no sabe si
 * el cliente está enojado, y una reseña mala no se borra).
 */

const DIA_MS = 24 * 3600 * 1000;
const ESTADOS_LAB_EN_CURSO = ['SENT', 'IN_PROGRESS', 'READY', 'FINISHED'];

export interface ResultadoSegundoPedido {
    revisados: number;
    creados: { clientId: string; nombre: string; taskId?: string }[];
    salteados: { clientId: string; nombre: string; motivo: string }[];
    dryRun: boolean;
}

export const ReviewRequestService = {
    /** "✅ Ya comentó": marca la ficha y cierra los pedidos de reseña abiertos. */
    async marcarYaComento(clientId: string, actor: Actor, source: 'MANUAL' | 'GOOGLE' = 'MANUAL', detalle?: string) {
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: { id: true, name: true, googleReviewAt: true },
        });
        if (!client) throw new Error('Cliente no encontrado');

        const ahora = new Date();
        if (client.googleReviewAt) {
            // Ya estaba marcado: igual se cierra lo que haya quedado abierto
            // (sin volver a firmar la ficha ni duplicar la nota).
            const { count } = await prisma.clientTask.updateMany({
                where: { clientId, type: TIPO_TAREA_RESENA, status: 'PENDING' },
                data: { status: 'COMPLETED', completedBy: actor.name, completedAt: ahora },
            });
            return { yaEstaba: true, cerradas: count };
        }

        const { count } = await prisma.$transaction(async tx => {
            await tx.client.update({
                where: { id: clientId },
                data: { googleReviewAt: ahora, googleReviewSource: source, googleReviewBy: actor.name },
                select: { id: true },
            });
            const cerradas = await tx.clientTask.updateMany({
                where: { clientId, type: TIPO_TAREA_RESENA, status: 'PENDING' },
                data: { status: 'COMPLETED', completedBy: actor.name, completedAt: ahora },
            });
            await tx.interaction.create({
                data: {
                    clientId,
                    type: 'NOTE',
                    userId: actor.id,
                    userName: actor.name,
                    content: source === 'GOOGLE'
                        ? `⭐ ${actor.name} detectó la reseña de ${client.name} en Google${detalle ? ` (${detalle})` : ''}. No se le vuelve a pedir.`
                        : `⭐ ${actor.name} marcó que ${client.name} ya dejó su reseña en Google. No se le vuelve a pedir.`,
                },
            });
            return cerradas;
        });

        logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'UPDATE',
            entityType: 'CONTACT',
            entityId: clientId,
            details: { field: 'googleReviewAt', to: ahora.toISOString(), source, detalle: detalle || null, tareasCerradas: count },
        }).catch(console.error);

        return { yaEstaba: false, cerradas: count };
    },

    /**
     * Cruce best-effort con las reseñas que devuelve Places (solo 5). Marca
     * únicamente a quien aparece con nombre completo y sin homónimos entre los
     * clientes a los que se les pidió. Nunca concluye "no comentó".
     */
    async cruzarConGoogle(dryRun: boolean) {
        const { getGoogleReviews } = await import('@/lib/googleReviews');
        const data: any = await getGoogleReviews();
        // rating 0 = getGoogleReviews devolvió las reseñas de RESPALDO, que son
        // fijas y viejas: cruzarlas marcaría gente por una reseña de hace meses.
        if (!data?.rating) return { autores: 0, marcados: [] as string[], respaldo: true };
        const autores: string[] = (data.reviews || []).map((r: any) => String(r.author_name || '')).filter(Boolean);
        if (!autores.length) return { autores: 0, marcados: [], respaldo: false };

        const pedidos = await prisma.clientTask.findMany({
            where: { type: TIPO_TAREA_RESENA },
            select: { client: { select: { id: true, name: true, googleReviewAt: true, isDeleted: true } } },
            distinct: ['clientId'],
        });
        const clientes = pedidos.map(p => p.client).filter(c => !c.isDeleted);
        const matches = cruzarResenasConClientes(autores, clientes);
        const marcados: string[] = [];
        for (const m of matches) {
            const c = clientes.find(x => x.id === m.clientId);
            if (!c || c.googleReviewAt) continue;
            marcados.push(c.name);
            if (!dryRun) await this.marcarYaComento(c.id, SYSTEM_ACTOR, 'GOOGLE', `reseña de "${m.autor}"`);
        }
        return { autores: autores.length, marcados, respaldo: false };
    },

    /** El robot: crea, a lo sumo, UN 2º pedido por cada 1º pedido cerrado. */
    async crearSegundosPedidos(opts: { dryRun: boolean; ahora?: Date }): Promise<ResultadoSegundoPedido> {
        const ahora = opts.ahora || new Date();
        const desde = new Date(ahora.getTime() - DIAS_MAXIMOS_SEGUNDO_PEDIDO * DIA_MS);
        const hasta = new Date(ahora.getTime() - DIAS_PARA_SEGUNDO_PEDIDO * DIA_MS);

        const primeros = await prisma.clientTask.findMany({
            where: {
                type: TIPO_TAREA_RESENA,
                status: 'COMPLETED',
                reminderOfTaskId: null,
                completedAt: { gte: desde, lte: hasta },
            },
            select: { id: true, clientId: true, status: true, completedAt: true, completedBy: true, description: true, reminderOfTaskId: true },
            // Los más frescos primero: el tope diario deja afuera a los más viejos.
            orderBy: { completedAt: 'desc' },
        });

        const res: ResultadoSegundoPedido = { revisados: primeros.length, creados: [], salteados: [], dryRun: opts.dryRun };
        const vistos = new Set<string>();

        for (const t of primeros) {
            if (res.creados.length >= MAX_SEGUNDOS_PEDIDOS_POR_DIA) {
                res.salteados.push({ clientId: t.clientId, nombre: '', motivo: `tope diario (${MAX_SEGUNDOS_PEDIDOS_POR_DIA}); queda para mañana` });
                continue;
            }
            // Un cliente con dos 1º pedidos en la ventana recibe un solo 2º.
            if (vistos.has(t.clientId)) continue;
            vistos.add(t.clientId);

            const c = await prisma.client.findUnique({
                where: { id: t.clientId },
                select: {
                    id: true, name: true, phone: true, isDeleted: true, googleReviewAt: true,
                    tasks: {
                        where: { type: TIPO_TAREA_RESENA },
                        select: { id: true, status: true, reminderOfTaskId: true, createdAt: true },
                    },
                    postSaleCases: { select: { status: true } },
                    interactions: {
                        where: {
                            createdAt: { gte: new Date(ahora.getTime() - DIAS_SIN_RECLAMOS * DIA_MS) },
                            type: { notIn: TIPOS_INTERACCION_SIN_RECLAMO },
                        },
                        select: { content: true },
                    },
                    orders: {
                        where: { isDeleted: false, orderType: 'SALE' },
                        include: { items: { include: { product: true } }, payments: true },
                        orderBy: { createdAt: 'desc' },
                    },
                },
            });
            if (!c || c.isDeleted) continue;

            const ventas = c.orders;
            const ultima = ventas.find(o => o.labSentAt) || ventas[0];
            const decision = decidirSegundoPedido({
                tarea: t,
                ahora,
                yaComento: !!c.googleReviewAt,
                // Un 2º pedido de CUALQUIER 1º de este cliente después de este
                // 1º: no se le pide dos veces aunque haya tenido otra venta.
                yaTieneSegundoPedido: c.tasks.some(x => x.reminderOfTaskId && t.completedAt && x.createdAt >= t.completedAt),
                tienePedidoDeResenaAbierto: c.tasks.some(x => x.status === 'PENDING'),
                tienePosventaAbierta: c.postSaleCases.some(p => !ESTADOS_POSVENTA_CERRADOS.includes(p.status)),
                // El saldo sale de PricingService, nunca de lista − cobrado.
                tieneSaldo: ventas.some(o => {
                    try { return !!PricingService.calculateOrderFinancials(o).hasBalance; } catch { return true; }
                }),
                ultimaVentaEntregada: !!ultima && ultima.labStatus === 'DELIVERED',
                tieneVentaEnCurso: ventas.some(o => ESTADOS_LAB_EN_CURSO.includes(String(o.labStatus))),
                tieneReclamoReciente: c.interactions.some(i => esTextoDeReclamo(i.content)),
                tieneTelefono: !!c.phone && c.phone.replace(/\D/g, '').length >= 8,
            });

            if (!decision.crear) {
                res.salteados.push({ clientId: c.id, nombre: c.name, motivo: decision.motivo });
                continue;
            }
            if (opts.dryRun) {
                res.creados.push({ clientId: c.id, nombre: c.name });
                continue;
            }

            try {
                const nueva = await prisma.$transaction(async tx => {
                    const task = await tx.clientTask.create({
                        data: {
                            clientId: c.id,
                            description: descripcionSegundoPedido(c.name),
                            status: 'PENDING',
                            type: TIPO_TAREA_RESENA,
                            createdBy: CREADOR_SEGUNDO_PEDIDO,
                            reminderOfTaskId: t.id,
                        },
                        select: { id: true },
                    });
                    await tx.interaction.create({
                        data: {
                            clientId: c.id,
                            type: 'SISTEMA',
                            userId: SYSTEM_ACTOR.id,
                            userName: SYSTEM_ACTOR.name,
                            content: `⭐ ${SYSTEM_ACTOR.name} volvió a poner el pedido de reseña de ${c.name} para el vendedor (2º y último pedido; el 1º lo cerró ${t.completedBy}). No se le escribió al cliente.`,
                        },
                    });
                    return task;
                });
                res.creados.push({ clientId: c.id, nombre: c.name, taskId: nueva.id });
                logAudit({
                    userId: SYSTEM_ACTOR.id,
                    userName: SYSTEM_ACTOR.name,
                    action: 'CREATE',
                    entityType: 'TASK',
                    entityId: nueva.id,
                    details: { tipo: 'segundo-pedido-resena', clientId: c.id, reminderOfTaskId: t.id },
                }).catch(console.error);
            } catch (err: any) {
                // P2002 = otra instancia ya lo creó (índice único): está bien.
                if (err?.code === 'P2002') { res.salteados.push({ clientId: c.id, nombre: c.name, motivo: 'ya lo creó otra corrida' }); continue; }
                throw err;
            }
        }
        return res;
    },
};
