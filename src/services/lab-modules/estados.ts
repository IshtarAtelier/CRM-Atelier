import { prisma } from '../../lib/db';
import { logAudit } from '../../lib/audit';
import { enviarAvisoProcesado } from '../../lib/avisos/aviso-procesado';
import { LAB_ITEM_PATTERNS } from '../lab-recon/types';
import { parseLabNumbers, findLabNumberConflicts, duplicateMessage } from '../../lib/lab-order-numbers';
import { alertDuplicateLabOrderNumber } from '../../lib/duplicate-lab-order-alert';
import { cantidadDeArmazones } from '../../lib/order-frames';
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
 * UN 2x1 NO TERMINA HASTA QUE LLEGUEN AMBOS PARES (Ishtar, 3/10/2026: "que se
 * informe cuando lleguen ambos"). "Todos los pedidos" se mide contra los
 * ARMAZONES de la venta (`cantidadDeArmazones`), no contra los pedidos que el
 * espejo haya vinculado: con un solo pedido vinculado en una venta de dos
 * pares, el conjunto quedaba TERMINADO, la venta pasaba a FINISHED y a las
 * 24 h el cron le avisaba al cliente "listo para retirar" con un par solo.
 * Mientras falte un pedido, el conjunto se topea en EN_PROCESO.
 *
 * EL Nº DE PEDIDO NO SE REPITE: antes de escribirlo se cruza contra las demás
 * ventas y reprocesos (`findLabNumberConflicts`). Si ya está en otra venta no
 * se asigna, se anota en la ficha y se avisa por mail — el estado se mueve
 * igual, porque eso lo dice el portal y es verdad.
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

/** ¿Hay un pedido vivo en el portal por cada armazón de la venta? Puro. */
export function paresCompletos(paresEsperados: number, pedidosVivos: number): boolean {
    return pedidosVivos >= Math.max(1, paresEsperados);
}

/**
 * El estado de la venta MIRANDO CUÁNTOS PARES LLEVA: igual que `estadoConjunto`,
 * pero si todavía no apareció un pedido por cada armazón, nunca pasa de
 * EN_PROCESO (el otro par está sin pedido, no "terminado"). Puro.
 */
export function estadoConjuntoDeVenta(estados: EstadoEnPortal[], paresEsperados: number): EstadoEnPortal {
    const base = estadoConjunto(estados);
    const vivos = estados.filter(e => e !== 'ANULADO').length;
    if ((base === 'TERMINADO' || base === 'DESPACHADO') && !paresCompletos(paresEsperados, vivos)) return 'EN_PROCESO';
    return base;
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
    /** La persona cuya aprobación disparó esto (carga asistida): firma la mutación junto al robot. */
    aprobadoPor?: { id: string | null; name: string } | null;
}

/** Los números de pedido que faltan en el campo de la venta (un 2º par confirmado después del 1º). Puro. */
export function numerosQueFaltan(labOrderNumber: string | null | undefined, numeros: string[]): string[] {
    const actuales = new Set(parseLabNumbers(labOrderNumber));
    return numeros.filter(n => !parseLabNumbers(n).every(d => actuales.has(d)));
}

export async function aplicarEstadoEnVenta(a: AplicacionDeEstado): Promise<{ labStatus: string | null; numeroAsignado: boolean; notificado: boolean }> {
    const order = await prisma.order.findUnique({
        where: { id: a.orderId },
        select: {
            id: true, labStatus: true, labOrderNumber: true, clientId: true, appliedPromoName: true,
            client: { select: { name: true } },
            // Lo que `cantidadDeArmazones` necesita para contar los pares.
            items: {
                select: {
                    eye: true, quantity: true, framePosition: true,
                    productCategorySnapshot: true, productNameSnapshot: true, productTypeSnapshot: true, laboratorySnapshot: true,
                    product: { select: { category: true, name: true, type: true, laboratory: true } },
                },
            },
            postSaleCases: { where: { newOrderNumber: { not: null } }, select: { newOrderNumber: true } },
        },
    });
    if (!order) return { labStatus: null, numeroAsignado: false, notificado: false };

    // Los pedidos de un REPROCESO (postventa) no son pares de la venta: ni se
    // suman a su nº (el costo se cruzaría dos veces) ni cuentan para "llegaron
    // los dos pares" (auditoría del 3/10/2026, I4).
    const deReprocesos = new Set(order.postSaleCases.flatMap(c => parseLabNumbers(c.newOrderNumber)));
    a = { ...a, pedidos: a.pedidos.filter(p => !parseLabNumbers(p.portalNumber).some(n => deReprocesos.has(n))) };
    if (a.pedidos.length === 0) return { labStatus: order.labStatus, numeroAsignado: false, notificado: false };

    // Los pares que se esperan de ESTE laboratorio: un 2x1 con el 2º par en otro
    // lab no puede quedar esperando acá un pedido que nunca va a llegar (I5).
    const patron = LAB_ITEM_PATTERNS[a.lab];
    const esCristal = (i: (typeof order.items)[number]) => /cristal|lens/i.test(i.productCategorySnapshot || i.product?.category || '');
    // Solo se descartan los cristales de OTRO laboratorio conocido: uno sin
    // laboratorio cargado cuenta, para no dar por terminado un 2x1 con un par.
    const deOtroLab = (i: (typeof order.items)[number]) => {
        const lab = i.laboratorySnapshot || i.product?.laboratory || '';
        return !!lab.trim() && !patron!.test(lab);
    };
    const itemsDelLab = patron ? order.items.filter(i => !esCristal(i) || !deOtroLab(i)) : order.items;
    const paresEsperados = cantidadDeArmazones({ ...order, items: itemsDelLab as any });
    const pedidosVivos = a.pedidos.filter(p => p.status !== 'ANULADO').length;
    const faltaOtroPar = !paresCompletos(paresEsperados, pedidosVivos);
    const conjunto = estadoConjuntoDeVenta(a.pedidos.map(p => p.status), paresEsperados);
    const nuevo = transicionDeVenta(order.labStatus, conjunto);
    const numeros = a.pedidos.map(p => p.portalNumber);
    // El nº se escribe si la venta tiene uno provisorio, o si al campo le falta
    // uno de los pedidos (el 2º par confirmado después del 1º se AGREGA).
    const faltan = numeroProvisorio(order.labOrderNumber) ? numeros : numerosQueFaltan(order.labOrderNumber, numeros);
    let asignarNumero = faltan.length > 0;
    const numeroNuevo = numeroProvisorio(order.labOrderNumber) ? numeros.join(', ') : [order.labOrderNumber, ...faltan].filter(Boolean).join(', ');
    const codigo = `#${order.id.slice(-4).toUpperCase()}`;
    const detalle = a.pedidos.map(p => `${p.portalNumber}: ${p.statusRaw}`).join(' | ');
    const firma = a.aprobadoPor ? `${a.robot} (aprobó ${a.aprobadoPor.name})` : a.robot;
    const firmaId = a.aprobadoPor?.id ?? null;

    if (!nuevo && !asignarNumero) return { labStatus: order.labStatus, numeroAsignado: false, notificado: false };

    // Un nº que ya está en otra venta o reproceso NO se escribe: la factura del
    // lab se cruza por ese número y quedaría colgada de la venta equivocada.
    // Se anota en la ficha y se avisa; el estado se mueve igual.
    let mensajeDuplicado: string | null = null;
    if (asignarNumero) {
        const conflictos = await findLabNumberConflicts({ value: faltan.join(', '), excludeOrderId: order.id })
            .catch(err => { console.error('[lab-modulos] no se pudo verificar duplicados:', err); return []; });
        if (conflictos.length > 0) {
            asignarNumero = false;
            mensajeDuplicado = duplicateMessage(conflictos);
            for (const numero of [...new Set(conflictos.map(c => c.numero))]) {
                alertDuplicateLabOrderNumber({ orderId: order.id, labOrderNumber: numero, actorName: firma })
                    .catch(err => console.error('[lab-modulos] aviso de duplicado:', err));
            }
            if (!nuevo) {
                await prisma.interaction.create({
                    data: { clientId: order.clientId, type: 'LAB_STATUS', content: `⚠️ ${firma}: no se asignó el nº de pedido de ${a.nombreLab} a la venta ${codigo}. ${mensajeDuplicado}`, userId: firmaId, userName: firma },
                }).catch(err => console.error('[lab-modulos] No se pudo registrar la interacción:', err));
                return { labStatus: order.labStatus, numeroAsignado: false, notificado: false };
            }
        }
    }

    const data: Record<string, unknown> = {};
    if (nuevo) data.labStatus = nuevo;
    if (asignarNumero) data.labOrderNumber = numeroNuevo;
    await prisma.order.update({ where: { id: order.id }, data, select: { id: true } });

    let notificado = false;
    if (nuevo === 'FINISHED') {
        await prisma.notification.create({
            data: {
                type: 'LAB_READY',
                message: `🏭 Pedido finalizado en ${a.nombreLab} — ${order.client?.name || 'Cliente'} (${numeros.join(', ')})`,
                orderId: order.id,
                requestedBy: firma,
                status: 'PENDING',
            },
        });
        notificado = true;
    }

    const lineas = [
        nuevo === 'FINISHED'
            ? `🏭 ${firma}: el pedido ${codigo} está TERMINADO en ${a.nombreLab}`
            : nuevo === 'IN_PROGRESS'
                ? `🏭 ${firma}: ${a.nombreLab} recibió el pedido ${codigo} y está en proceso`
                : `🏭 ${firma}: ${a.nombreLab} asignó el nº de pedido a la venta ${codigo}`,
        faltaOtroPar && nuevo !== 'FINISHED'
            ? `La venta lleva ${paresEsperados} pares y en el portal hay ${pedidosVivos}: falta el pedido del otro par, así que no se da por terminada hasta que llegue`
            : null,
        asignarNumero ? `Nº de pedido ${a.nombreLab}: ${numeroNuevo}` : null,
        mensajeDuplicado ? `⚠️ No se asignó el nº de pedido: ${mensajeDuplicado}` : null,
        `Estado en el portal: ${detalle}`,
    ].filter(Boolean).join('\n');

    await prisma.interaction.create({
        data: { clientId: order.clientId, type: 'LAB_STATUS', content: lineas, userId: firmaId, userName: firma },
    }).catch(err => console.error('[lab-modulos] No se pudo registrar la interacción:', err));

    logAudit({
        userId: firmaId, userName: firma, action: 'STATUS_CHANGE', entityType: 'ORDER', entityId: order.id,
        details: { lab: a.lab, de: order.labStatus, a: nuevo ?? order.labStatus, pedidos: a.pedidos, paresEsperados, numeroAsignado: asignarNumero, labOrderNumber: asignarNumero ? numeroNuevo : undefined, duplicado: mensajeDuplicado ?? undefined },
    }).catch(err => console.error('[lab-modulos] audit:', err));

    // El nº llegó con la venta todavía en SENT: es el mismo momento en que el
    // CRM manda el aviso de "procesado" cuando alguien tipea el número a mano.
    if (asignarNumero && order.labStatus === 'SENT') {
        const completa = await prisma.order.findUnique({
            where: { id: order.id },
            include: { client: true, items: { include: { product: true } } },
        });
        if (completa) {
            enviarAvisoProcesado(completa, { labOrderNumber: numeroNuevo })
                .catch(err => console.error('[lab-modulos] aviso procesado:', err));
        }
    }

    return { labStatus: nuevo ?? order.labStatus, numeroAsignado: asignarNumero, notificado };
}
