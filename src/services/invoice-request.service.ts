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
import { getFileBuffer } from '@/lib/storage';
import type { WhatsAppMedia } from '@/lib/whatsapp/send';
import { templateSpec, TEMPLATE_LANGUAGE } from '@/lib/whatsapp/templates';

export interface SolicitudFacturaInput {
    orderId: string;
    monto: number;
    /** Nombre y DNI tal como van en la factura; si difieren de la ficha, la ficha se corrige. */
    cliente?: { nombre: string; dni: string | null } | null;
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

        // Facturación arma el comprobante con la ficha del cliente: lo que el
        // vendedor corrigió en el modal se guarda ahí, firmado en la ficha.
        if (order.client && input.cliente) {
            const nombreNuevo = input.cliente.nombre.trim();
            const dniNuevo = (input.cliente.dni || '').trim() || null;
            const cambios: string[] = [];
            if (nombreNuevo.length > 1 && nombreNuevo !== order.client.name) cambios.push(`nombre "${order.client.name}" → "${nombreNuevo}"`);
            if (dniNuevo !== (order.client.dni || null)) cambios.push(`DNI ${order.client.dni || 'sin dato'} → ${dniNuevo || 'sin dato'}`);
            if (cambios.length > 0) {
                await prisma.client.update({
                    where: { id: order.client.id },
                    data: { ...(nombreNuevo.length > 1 ? { name: nombreNuevo } : {}), dni: dniNuevo },
                    select: { id: true },
                });
                order.client = { ...order.client, name: nombreNuevo.length > 1 ? nombreNuevo : order.client.name, dni: dniNuevo };
                await prisma.interaction.create({
                    data: {
                        clientId: order.clientId,
                        type: 'SISTEMA',
                        content: `✏️ ${actor.name} corrigió los datos para facturar: ${cambios.join('; ')}.`,
                        userId: actor.id,
                        userName: actor.name,
                    },
                });
                logAudit({
                    userId: actor.id,
                    userName: actor.name,
                    action: 'UPDATE',
                    entityType: 'CONTACT',
                    entityId: order.client.id,
                    details: { motivo: 'solicitud de factura', cambios },
                }).catch(console.error);
            }
        }

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
        // Las imágenes de los comprobantes de cada pago, para verificar desde
        // el celular sin abrir el CRM (Ishtar, 16/10/2026). Van después del
        // texto, un mensaje por comprobante.
        const adjuntos = await comprobantesDePagos(order.payments);
        const texto =
            // El link va antes que los pagos: la plantilla corta a 700 caracteres.
            `Factura de ${precioConSigno(monto)} para ${clienteNombre} (${doc}), venta #${numero}.` +
            ` Facturar: ${link} .` +
            (observaciones ? ` Observación: ${observaciones}.` : ' Sin observación.') +
            ` Pagos (${precioConSigno(cobrado)} cobrado): ${pagos || 'ninguno'}.` +
            (adjuntos.length > 0 ? ` Te mando ${adjuntos.length === 1 ? 'el comprobante' : `los ${adjuntos.length} comprobantes`} a continuación.` : ' Sin comprobantes cargados.');

        // Ventana cerrada: la plantilla propia arranca con "Solicitud de
        // factura" y lleva el (primer) comprobante como encabezado. Solo si
        // Meta ya la aprobó; si no, cae a nota_interna como siempre.
        const plantillaPropia = adjuntos.length > 0 && await plantillaAprobada('solicitud_factura')
            ? templateSpec('solicitud_factura', [actor.name, precioConSigno(monto), clienteNombre, doc, `#${numero}`, observaciones || 'sin observación', pagos || 'ninguno', link])
            : null;

        avisarEquipoPorWhatsApp({
            destinatarios: admins,
            remitente: { id: actor.id, name: actor.name },
            contexto: `una solicitud de factura de ${clienteNombre}`,
            titulo: `🧾 *Solicitud de factura* — ${actor.name}`,
            // El link ya va dentro del texto: así también llega por la plantilla.
            texto,
            adjuntos,
            plantilla: plantillaPropia,
            plantillaMedia: plantillaPropia ? adjuntos[0] : null,
        }).catch(console.error);

        return notification;
    },
};

const MIME_POR_EXTENSION: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf',
};

/**
 * Los comprobantes cargados en los pagos de la venta, listos para mandar por
 * WhatsApp. Un archivo que no se puede leer se saltea (y se loguea): la
 * solicitud sale igual, con los que haya.
 */
async function comprobantesDePagos(
    payments: { date: Date; method: string; amount: number; receiptUrl: string | null }[],
): Promise<WhatsAppMedia[]> {
    const adjuntos: WhatsAppMedia[] = [];
    for (const p of [...payments].sort((a, b) => a.date.getTime() - b.date.getTime())) {
        if (!p.receiptUrl) continue;
        const ext = (p.receiptUrl.split('?')[0].split('.').pop() || '').toLowerCase();
        const mimetype = MIME_POR_EXTENSION[ext];
        if (!mimetype) { console.warn('[invoice-request] Comprobante con extensión desconocida:', p.receiptUrl); continue; }
        try {
            const buffer = await getFileBuffer(p.receiptUrl);
            if (!buffer) { console.warn('[invoice-request] Comprobante ilegible:', p.receiptUrl); continue; }
            adjuntos.push({
                base64: buffer.toString('base64'),
                mimetype,
                filename: `Comprobante ${formatDate(p.date)} ${METHOD_LABELS[p.method] || p.method} ${precioConSigno(p.amount)}`,
            });
        } catch (e: any) {
            console.error('[invoice-request] No se pudo leer el comprobante', p.receiptUrl, e?.message);
        }
    }
    return adjuntos;
}

/** true solo si el espejo local de Meta dice que la plantilla está APPROVED. */
async function plantillaAprobada(nombre: string): Promise<boolean> {
    const fila = await prisma.whatsAppTemplate.findFirst({
        where: { name: nombre, language: TEMPLATE_LANGUAGE },
        select: { status: true },
    }).catch(() => null);
    return fila?.status === 'APPROVED';
}
