/**
 * SOLICITUD DE FACTURA DEL VENDEDOR.
 *
 * Decisión de Ishtar (15/10/2026): se acabaron las solicitudes automáticas
 * (al cargar un pago Pay Way / Mercado Pago y al cobrar una venta web). La
 * factura se pide a mano: el vendedor confirma que los datos están bien, dice
 * si hace falta una observación y la escribe. A la administración le llega un
 * WhatsApp con el link que abre la factura ya armada, observación incluida.
 *
 * El monto y la observación se guardan como DATOS en la `Notification`
 * (`requestedAmount`, `observations`), no adentro del texto: la pantalla de
 * Facturación los lee de ahí para precargar el modal de ARCA.
 */

import { prisma } from '@/lib/db';
import { Actor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { CRM_ORIGIN, METHOD_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format-date';
import { precioConSigno } from '@/lib/format-precio';
import { avisarEquipoPorWhatsApp } from '@/lib/whatsapp/aviso-interno';
import { PricingService } from '@/services/PricingService';

export interface SolicitudFacturaInput {
    orderId: string;
    monto: number;
    /** El vendedor confirmó que nombre, documento y monto están bien. */
    datosConfirmados: boolean;
    /** Texto para la factura o para quien factura; vacío = sin observación. */
    observaciones?: string | null;
}

export class SolicitudFacturaError extends Error {
    constructor(message: string, public status = 400) {
        super(message);
    }
}

/** Link que abre Facturación con esta solicitud ya cargada en el modal. */
export function linkSolicitudFactura(notificationId: string): string {
    return `${CRM_ORIGIN}/admin/facturacion?solicitud=${notificationId}`;
}

export const InvoiceRequestService = {
    async solicitar(input: SolicitudFacturaInput, actor: Actor) {
        if (!input.datosConfirmados) {
            throw new SolicitudFacturaError('Confirmá que los datos a facturar están bien.');
        }
        const monto = Number(input.monto);
        if (!Number.isFinite(monto) || monto <= 0) {
            throw new SolicitudFacturaError('Monto inválido.');
        }
        const observaciones = (input.observaciones || '').trim() || null;

        const order = await prisma.order.findUnique({
            where: { id: input.orderId },
            include: { items: true, payments: true, client: { select: { id: true, name: true, dni: true } } },
        });
        if (!order || order.isDeleted) throw new SolicitudFacturaError('No se encontró la venta.', 404);

        const cobrado = PricingService.calculateOrderFinancials(order).paidReal;
        if (cobrado <= 0) {
            throw new SolicitudFacturaError('No hay pagos registrados para esta venta. No se puede solicitar factura.');
        }
        if (monto > cobrado + 0.5) {
            throw new SolicitudFacturaError(`No se puede facturar más de lo que el cliente pagó (${precioConSigno(cobrado)}).`);
        }

        const pendiente = await prisma.notification.findFirst({
            where: { type: 'INVOICE_REQUEST', orderId: order.id, status: 'PENDING' },
            select: { id: true },
        });
        if (pendiente) {
            throw new SolicitudFacturaError('Ya hay una solicitud de factura pendiente para esta venta.', 409);
        }

        const numero = order.id.slice(-4).toUpperCase();
        const clienteNombre = order.client?.name || 'Cliente';
        const message = `Solicitar factura de ${precioConSigno(monto)} para venta #${numero} (${clienteNombre})` +
            (observaciones ? ` — Obs.: ${observaciones}` : '');

        const notification = await prisma.notification.create({
            data: {
                type: 'INVOICE_REQUEST',
                message,
                orderId: order.id,
                requestedBy: actor.name,
                status: 'PENDING',
                requestedAmount: monto,
                observations: observaciones,
            },
        });

        await prisma.interaction.create({
            data: {
                clientId: order.clientId,
                type: 'SISTEMA',
                content: `🧾 ${actor.name} solicitó factura de ${precioConSigno(monto)} (venta #${numero}).` +
                    (observaciones ? ` Observación: ${observaciones}` : ''),
                userId: actor.id,
                userName: actor.name,
            },
        });

        logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'CREATE',
            entityType: 'INVOICE',
            entityId: notification.id,
            details: { orderId: order.id, monto, observaciones },
        }).catch(console.error);

        // WhatsApp a la administración, con el link que abre la factura armada.
        const admins = await prisma.user.findMany({
            where: { role: 'ADMIN', whatsappPhone: { not: null } },
            select: { id: true, name: true, whatsappPhone: true },
        });
        const link = linkSolicitudFactura(notification.id);
        const doc = order.client?.dni ? `DNI ${order.client.dni}` : 'sin documento';
        // Los pagos de la venta, para verificar desde el celular antes de facturar.
        const pagos = [...order.payments]
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map(p => `${formatDate(p.date)} ${METHOD_LABELS[p.method] || p.method} ${precioConSigno(p.amount)}`)
            .join('; ');
        const texto =
            // El link va antes que los pagos: la plantilla corta a 700 caracteres.
            `Factura de ${precioConSigno(monto)} para ${clienteNombre} (${doc}), venta #${numero}.` +
            ` Facturar: ${link} .` +
            (observaciones ? ` Observación: ${observaciones}.` : ' Sin observación.') +
            ` Pagos (${precioConSigno(cobrado)} cobrado): ${pagos || 'ninguno'}.`;
        avisarEquipoPorWhatsApp({
            destinatarios: admins,
            remitente: { id: actor.id, name: actor.name },
            contexto: `una factura de ${clienteNombre}`,
            // El link ya va dentro del texto: así también llega por la plantilla.
            texto,
        }).catch(console.error);

        return notification;
    },
};
