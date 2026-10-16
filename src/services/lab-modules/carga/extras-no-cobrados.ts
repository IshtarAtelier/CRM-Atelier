import { prisma } from '../../../lib/db';
import { codigoCortoDeVenta } from '../../../lib/laboratorios/identidad';
import { logAudit } from '../../../lib/audit';
import type { Actor } from '../../../lib/actor';
import { formatearPrecio, precioConSigno } from '../../../lib/format-precio';
import { formatDate } from '../../../lib/format-date';
import { InternalMessagingService } from '../../internal-messaging.service';
import { appUrl } from '../../lab-recon/types';

/**
 * ALGO QUE SE CARGA AL LABORATORIO Y NO ESTÁ COBRADO EN LA VENTA (regla de
 * Ishtar, 8/10/2026). El caso típico: el robot preparó el pedido tal cual la
 * venta y el vendedor quiere agregarle un Essential que el cliente no pagó.
 *
 * Se puede, pero con tres frenos:
 *  1. la ficha avisa "no está cobrado, ¿estás seguro?" y pide explicar por qué
 *     (sin motivo no se prepara);
 *  2. queda en la ficha del cliente (Interaction firmada) y en el AuditLog;
 *  3. le llega a la dueña por la mensajería interna, urgente y con copia al
 *     celular, con el motivo completo y los datos de la venta.
 *
 * Lo que se carga de más NO redefine la venta: el precio queda como está, y
 * el cruce de costos lo va a ver como sobrecosto contra lo vendido — que es
 * exactamente lo que es.
 */
export interface ExtraNoCobrado {
    /** La clave del campo (`essential`). */
    clave: string;
    /** Cómo se llama lo que se agrega ("Essential (antirreflejo)"). */
    nombre: string;
    /** Lo que escribió quien lo agregó. */
    motivo: string;
}

export interface DatosDelAviso {
    codigoVenta: string;
    orderId: string;
    cliente: string;
    vendedor: string | null;
    fechaVenta: string;
    nombreLab: string;
    pair: number;
    pares: number;
    /** Qué se vendió, renglón por renglón (ya formateado). */
    renglones: string[];
    total: string;
    promo: string | null;
    /** Qué va a cargar el robot con el extra. */
    loQueSeCarga: string;
    extra: ExtraNoCobrado;
    quien: string;
    /** Origen de la app, para que el link sirva también en el WhatsApp. */
    baseUrl: string;
}

/** El texto del mensaje a la dueña: completo, sin resumir. Puro. */
export function textoDeExtraNoCobrado(d: DatosDelAviso): string {
    return [
        `⚠️ ${d.quien} agregó ${d.extra.nombre} al pedido de ${d.nombreLab} de la venta ${d.codigoVenta}, y NO está cobrado en la venta.`,
        '',
        `Motivo que escribió: "${d.extra.motivo}"`,
        '',
        `Venta ${d.codigoVenta} · ${d.cliente} · ${d.fechaVenta}${d.vendedor ? ` · vendió ${d.vendedor}` : ''}`,
        ...d.renglones.map(r => `  · ${r}`),
        `  Total: ${d.total}${d.promo ? ` · promo: ${d.promo}` : ''}`,
        '',
        `Se carga${d.pares > 1 ? ` (par ${d.pair})` : ''}: ${d.loQueSeCarga}`,
        `Ficha: ${d.baseUrl}/admin/ventas?id=${d.orderId}`,
    ].join('\n');
}

/** Lo que quedó en la ficha del cliente (una línea). Puro. */
export function lineaDeFicha(d: DatosDelAviso): string {
    return `⚠️ ${d.quien} agregó ${d.extra.nombre} al pedido de ${d.nombreLab}${d.pares > 1 ? ` (par ${d.pair})` : ''} de la venta ${d.codigoVenta} SIN estar cobrado. Motivo: ${d.extra.motivo}`;
}

/** A quién se le avisa: las cuentas ADMIN del equipo (la dueña), nunca el que lo decidió. */
export async function destinatariosDeExtras(excluirUserId: string | null): Promise<string[]> {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', ...(excluirUserId ? { id: { not: excluirUserId } } : {}) }, select: { id: true } });
    return admins.map(a => a.id);
}

export async function registrarExtraNoCobrado(args: { orderId: string; nombreLab: string; pair: number; pares: number; extra: ExtraNoCobrado; loQueSeCarga: string; actor: Actor; quien?: string }): Promise<void> {
    const { orderId, actor } = args;
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
            id: true, clientId: true, createdAt: true, total: true, appliedPromoName: true, labSentBy: true,
            client: { select: { name: true } },
            items: { orderBy: { id: 'asc' }, select: { eye: true, framePosition: true, quantity: true, price: true, productNameSnapshot: true, product: { select: { name: true } } } },
        },
    });
    if (!order) throw new Error('La venta no existe.');
    const quien = args.quien || actor.name || 'Alguien del equipo';
    const datos: DatosDelAviso = {
        codigoVenta: codigoCortoDeVenta(orderId),
        orderId,
        cliente: order.client?.name || 'sin cliente',
        vendedor: order.labSentBy || null,
        fechaVenta: formatDate(order.createdAt),
        nombreLab: args.nombreLab, pair: args.pair, pares: args.pares,
        renglones: order.items.map(i => `${i.product?.name ?? i.productNameSnapshot ?? 'ítem'}${i.eye ? ` (${i.eye})` : ''}${i.framePosition ? ` · par ${i.framePosition}` : ''}${(i.quantity || 1) > 1 ? ` ×${i.quantity}` : ''}: $ ${formatearPrecio(i.price)}`),
        total: precioConSigno(order.total),
        promo: order.appliedPromoName || null,
        loQueSeCarga: args.loQueSeCarga,
        extra: args.extra,
        quien,
        baseUrl: appUrl(),
    };

    // Ya avisado (un reintento, o un borrador preparado antes del 10/10/2026 que avisaba al preparar): no se repite.
    const firmaDeLinea = `agregó ${args.extra.nombre} al pedido de ${args.nombreLab}${args.pares > 1 ? ` (par ${args.pair})` : ''}`;
    const yaEnFicha = await prisma.interaction.findFirst({
        where: { clientId: order.clientId, type: 'LAB_STATUS', content: { contains: firmaDeLinea }, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
        select: { id: true, content: true },
    }).catch(() => null);
    if (yaEnFicha && yaEnFicha.content.includes(datos.codigoVenta)) return;
    // 1. La ficha del cliente, firmada por quien lo decidió.
    await prisma.interaction.create({
        data: { clientId: order.clientId, type: 'LAB_STATUS', content: lineaDeFicha(datos), userId: actor.id, userName: quien },
    }).catch(err => console.error('[lab-modulos] no se pudo anotar el extra no cobrado en la ficha:', err));
    // 2. AuditLog (se espera: es una decisión sobre plata).
    await logAudit({
        userId: actor.id, userName: quien, action: 'UPDATE', entityType: 'ORDER', entityId: orderId,
        details: { tipo: 'EXTRA_NO_COBRADO', lab: args.nombreLab, pair: args.pair, extra: args.extra, loQueSeCarga: args.loQueSeCarga },
    });
    // 3. A la dueña, por la mensajería interna: urgente y con copia al celular.
    const para = await destinatariosDeExtras(actor.id);
    if (!actor.id || para.length === 0) {
        // La única ADMIN es quien lo decidió (o no hay cuentas ADMIN): no hay a quién
        // escribirle, pero que quede dicho en el AuditLog y en el log.
        console.error('[lab-modulos] extra no cobrado sin destinatario interno (actor sin id o sin cuentas ADMIN):', datos.codigoVenta);
        await logAudit({ userId: actor.id, userName: quien, action: 'NOTIFY', entityType: 'ORDER', entityId: orderId, details: { tipo: 'EXTRA_NO_COBRADO_SIN_AVISO', motivo: 'sin destinatario interno' } }).catch(() => null);
        return;
    }
    await InternalMessagingService.crearConversacion({
        creadorId: actor.id, paraIds: para,
        subject: `Extra no cobrado en un pedido de ${args.nombreLab}`,
        primerMensaje: textoDeExtraNoCobrado(datos),
        urgent: true, copiaWhatsapp: true,
    }, actor).catch(async err => {
        console.error('[lab-modulos] no se pudo avisar el extra no cobrado por mensajería interna:', err);
        await logAudit({ userId: actor.id, userName: quien, action: 'NOTIFY', entityType: 'ORDER', entityId: orderId, details: { tipo: 'EXTRA_NO_COBRADO_SIN_AVISO', motivo: String(err?.message || err) } }).catch(() => null);
    });
}

/**
 * Alguien cambió a mano el pedido en el portal antes de aprobar (Vitolen:
 * "Modificar" + releer). Nunca bloquea; al CARGAR queda en la ficha del
 * cliente y en el AuditLog, y la dueña recibe un mensaje interno con el
 * detalle, el impacto de costo según la lista y la justificación (Ishtar,
 * 15/10/2026). A diferencia del extra no cobrado, acá el aviso le llega a
 * TODAS las cuentas ADMIN, también si la que aprobó es la dueña.
 */
export async function registrarCambioAMano(args: { orderId: string; nombreLab: string; pair: number; numero: string | null; lineas: string[]; costoExtra: number; aConfirmar: boolean; motivo: string; quien: string; actor: Actor }): Promise<void> {
    const { orderId, actor } = args;
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, clientId: true, createdAt: true, total: true, labSentBy: true, client: { select: { name: true } } },
    });
    if (!order) throw new Error('La venta no existe.');
    const codigoVenta = codigoCortoDeVenta(orderId);
    const impacto = args.costoExtra > 0 ? `sale ${precioConSigno(args.costoExtra)} MÁS caro que lo que dice la venta`
        : args.costoExtra < 0 ? `sale ${precioConSigno(-args.costoExtra)} más barato que lo que dice la venta`
            : 'sin cambio de costo según la lista';
    const linea = `✏️ ${args.quien} cambió a mano en ${args.nombreLab} el pedido${args.numero ? ` ${args.numero}` : ''} de la venta ${codigoVenta} (par ${args.pair}): ${args.lineas.join(' · ')}. Costo: ${impacto}${args.aConfirmar ? ' (parte sin precio en la lista: a confirmar con el laboratorio)' : ''}. Motivo: ${args.motivo}`;
    const yaEnFicha = await prisma.interaction.findFirst({
        where: { clientId: order.clientId, type: 'LAB_STATUS', content: { contains: `cambió a mano en ${args.nombreLab} el pedido${args.numero ? ` ${args.numero}` : ''}` }, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
        select: { id: true },
    }).catch(() => null);
    if (yaEnFicha) return;
    await prisma.interaction.create({ data: { clientId: order.clientId, type: 'LAB_STATUS', content: linea, userId: actor.id, userName: args.quien } })
        .catch(err => console.error('[lab-modulos] no se pudo anotar el cambio a mano en la ficha:', err));
    await logAudit({
        userId: actor.id, userName: args.quien, action: 'UPDATE', entityType: 'ORDER', entityId: orderId,
        details: { tipo: 'CAMBIO_A_MANO_EN_PORTAL', lab: args.nombreLab, pair: args.pair, numero: args.numero, cambios: args.lineas, costoExtra: args.costoExtra, aConfirmar: args.aConfirmar, motivo: args.motivo },
    });
    const admins = await destinatariosDeExtras(null);
    const creadorId = actor.id ?? admins[0] ?? null;
    const para = admins.filter(id => id !== creadorId);
    if (!creadorId) { console.error('[lab-modulos] cambio a mano sin cuentas ADMIN a quien avisar:', codigoVenta); return; }
    await InternalMessagingService.crearConversacion({
        creadorId, paraIds: para.length ? para : [creadorId],
        subject: `Cambio a mano en un pedido de ${args.nombreLab}`,
        primerMensaje: [
            `✏️ ${args.quien} cambió a mano en el portal de ${args.nombreLab} el pedido${args.numero ? ` ${args.numero}` : ''} de la venta ${codigoVenta} (par ${args.pair}) antes de aprobarlo.`,
            '',
            'Qué cambió:',
            ...args.lineas.map(l => `  · ${l}`),
            '',
            `Costo según la lista: ${impacto}.${args.aConfirmar ? ' Parte del cambio no tiene precio en la lista: confirmarlo con el laboratorio.' : ''}`,
            '',
            `Justificación que escribió: "${args.motivo}"`,
            '',
            `Venta ${codigoVenta} · ${order.client?.name || 'sin cliente'} · ${formatDate(order.createdAt)}${order.labSentBy ? ` · vendió ${order.labSentBy}` : ''} · total ${precioConSigno(order.total)}`,
            `Ficha: ${appUrl()}/admin/ventas?id=${orderId}`,
        ].join('\n'),
        urgent: true, copiaWhatsapp: true,
    }, actor).catch(async err => {
        console.error('[lab-modulos] no se pudo avisar el cambio a mano por mensajería interna:', err);
        await logAudit({ userId: actor.id, userName: args.quien, action: 'NOTIFY', entityType: 'ORDER', entityId: orderId, details: { tipo: 'CAMBIO_A_MANO_SIN_AVISO', motivo: String(err?.message || err) } }).catch(() => null);
    });
}
