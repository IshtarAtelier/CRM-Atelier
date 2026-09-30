import { prisma } from '../../lib/db';
import { logAudit } from '../../lib/audit';
import { enviarAvisoProcesado } from '../../lib/avisos/aviso-procesado';
import type { EstadoEnPortal } from './contrato';

/**
 * LA ÚNICA FUNCIÓN QUE MUEVE EL ESTADO DE UNA VENTA DESDE UN PORTAL.
 *
 * Copia el comportamiento probado de SmartLab (smartlab.service.ts:551-586):
 * IN_PROGRESS si el lab avanzó, FINISHED cuando TODOS los pedidos de la venta
 * terminaron, y en ese momento —una sola vez— la notificación LAB_READY que
 * dispara el aviso de "pedido listo". Nunca baja un estado, nunca toca READY
 * ni DELIVERED (esos los pone una persona al retirar/entregar).
 *
 * Toda escritura queda firmada en el historial del cliente y en el AuditLog
 * con el nombre del robot ('Robot <lab>').
 */

/** Del estado del portal al labStatus del CRM. Puro: `npm run check:lab-modulos`. */
export function transicionDeVenta(labStatusActual: string | null | undefined, estadoConjunto: EstadoEnPortal): 'IN_PROGRESS' | 'FINISHED' | null {
    const actual = labStatusActual || 'NONE';
    if (!['SENT', 'IN_PROGRESS'].includes(actual)) return null;
    if (estadoConjunto === 'TERMINADO' || estadoConjunto === 'DESPACHADO') return 'FINISHED';
    if (estadoConjunto === 'EN_PROCESO' || estadoConjunto === 'INGRESADO') return actual === 'SENT' ? 'IN_PROGRESS' : null;
    return null;
}

/**
 * El estado de la VENTA a partir de sus pedidos (un 2x1 tiene dos): el más
 * atrasado manda. Un anulado no frena a los demás; un desconocido sí (no se
 * afirma "terminado" sobre algo que no se entendió). Puro.
 */
export function estadoConjunto(estados: EstadoEnPortal[]): EstadoEnPortal {
    const vivos = estados.filter(e => e !== 'ANULADO');
    if (vivos.length === 0) return estados.length ? 'ANULADO' : 'DESCONOCIDO';
    const orden: EstadoEnPortal[] = ['DESCONOCIDO', 'INGRESADO', 'EN_PROCESO', 'TERMINADO', 'DESPACHADO'];
    return vivos.reduce((min, e) => (orden.indexOf(e) < orden.indexOf(min) ? e : min), 'DESPACHADO' as EstadoEnPortal);
}

/** ¿El nº que tiene la venta es un provisorio que el portal puede reemplazar? Puro. */
export function numeroProvisorio(labOrderNumber: string | null | undefined): boolean {
    const n = String(labOrderNumber || '').trim();
    return !n || /^(SML-|Borrador-)/i.test(n) || /sin\s+(lab|numero|laboratorio)/i.test(n);
}

export interface AplicacionDeEstado {
    orderId: string;
    lab: string;
    nombreLab: string;
    robot: string; // 'Robot Vitolen'
    pedidos: { portalNumber: string; status: EstadoEnPortal; statusRaw: string }[];
}

export async function aplicarEstadoEnVenta(a: AplicacionDeEstado): Promise<{ labStatus: string | null; numeroAsignado: boolean; notificado: boolean }> {
    const order = await prisma.order.findUnique({
        where: { id: a.orderId },
        select: { id: true, labStatus: true, labOrderNumber: true, clientId: true, client: { select: { name: true } } },
    });
    if (!order) return { labStatus: null, numeroAsignado: false, notificado: false };

    const conjunto = estadoConjunto(a.pedidos.map(p => p.status));
    const nuevo = transicionDeVenta(order.labStatus, conjunto);
    const numeros = a.pedidos.map(p => p.portalNumber);
    const asignarNumero = numeroProvisorio(order.labOrderNumber) && numeros.length > 0;
    const codigo = `#${order.id.slice(-4).toUpperCase()}`;
    const detalle = a.pedidos.map(p => `${p.portalNumber}: ${p.statusRaw}`).join(' | ');

    if (!nuevo && !asignarNumero) return { labStatus: order.labStatus, numeroAsignado: false, notificado: false };

    const data: Record<string, unknown> = {};
    if (nuevo) data.labStatus = nuevo;
    if (asignarNumero) data.labOrderNumber = numeros.join(', ');
    await prisma.order.update({ where: { id: order.id }, data });

    let notificado = false;
    if (nuevo === 'FINISHED') {
        await prisma.notification.create({
            data: {
                type: 'LAB_READY',
                message: `🏭 Pedido finalizado en ${a.nombreLab} — ${order.client?.name || 'Cliente'} (${numeros.join(', ')})`,
                orderId: order.id,
                requestedBy: a.robot,
                status: 'PENDING',
            },
        });
        notificado = true;
    }

    const lineas = [
        nuevo === 'FINISHED'
            ? `🏭 ${a.robot}: el pedido ${codigo} está TERMINADO en ${a.nombreLab}`
            : nuevo === 'IN_PROGRESS'
                ? `🏭 ${a.robot}: ${a.nombreLab} recibió el pedido ${codigo} y está en proceso`
                : `🏭 ${a.robot}: ${a.nombreLab} asignó el nº de pedido a la venta ${codigo}`,
        asignarNumero ? `Nº de pedido ${a.nombreLab}: ${numeros.join(', ')}` : null,
        `Estado en el portal: ${detalle}`,
    ].filter(Boolean).join('\n');

    await prisma.interaction.create({
        data: { clientId: order.clientId, type: 'LAB_STATUS', content: lineas, userId: null, userName: a.robot },
    }).catch(err => console.error('[lab-modulos] No se pudo registrar la interacción:', err));

    logAudit({
        userId: null, userName: a.robot, action: 'STATUS_CHANGE', entityType: 'ORDER', entityId: order.id,
        details: { lab: a.lab, de: order.labStatus, a: nuevo ?? order.labStatus, pedidos: a.pedidos, numeroAsignado: asignarNumero },
    }).catch(err => console.error('[lab-modulos] audit:', err));

    // El nº llegó con la venta todavía en SENT: es el mismo momento en que el
    // CRM manda el aviso de "procesado" cuando alguien tipea el número a mano.
    if (asignarNumero && order.labStatus === 'SENT') {
        const completa = await prisma.order.findUnique({
            where: { id: order.id },
            include: { client: true, items: { include: { product: true } } },
        });
        if (completa) {
            enviarAvisoProcesado(completa, { labOrderNumber: numeros.join(', ') })
                .catch(err => console.error('[lab-modulos] aviso procesado:', err));
        }
    }

    return { labStatus: nuevo ?? order.labStatus, numeroAsignado: asignarNumero, notificado };
}
