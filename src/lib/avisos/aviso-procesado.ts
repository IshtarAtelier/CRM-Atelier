// ────────────────────────────────────────────────────────────────────────────
// Aviso "tu pedido ya fue procesado", con la fecha estimada de entrega.
//
// Vivía escrito adentro de `order.service.updateOrder`, así que el único modo
// de mandarlo era pasar el pedido a IN_PROGRESS. El auditor de avisos
// (`avisos-auditor.service.ts`) necesita poder REDISPARARLO sin volver a mover
// el estado, y un aviso que no se puede reenviar no se puede arreglar cuando
// falla. Acá se arma y se manda una sola vez, y los dos lo usan.
// ────────────────────────────────────────────────────────────────────────────

import { format } from 'date-fns';
import { addBusinessDays, calculateEstimatedDays } from '@/lib/business-days';
import { PricingService } from '@/services/PricingService';
import { sendWhatsApp, explainSendFailure } from '@/lib/whatsapp/send';
import { templateSpec } from '@/lib/whatsapp/templates';
import { normalizeArgentinePhone } from '@/services/contact.service';
import { logAudit } from '@/lib/audit';

/**
 * Frase por la que se reconoce este aviso en la conversación. Es el ancla del
 * auditor: sin una marca estable no hay forma de saber si el mensaje salió.
 * Si se cambia la redacción, se cambia acá y el auditor la sigue encontrando.
 */
export const MARCA_AVISO_PROCESADO = 'tu pedido ya fue procesado';

export function textoAvisoProcesado(order: any, estimatedDate: string, labOrderNumber?: string | null): string {
    const financials = PricingService.calculateOrderFinancials(order);
    const balanceInfo = financials.hasBalance
        ? 'Adjuntamos el PDF con el detalle de tu presupuesto, pagos y saldo pendiente.'
        : 'Adjuntamos el PDF con el detalle de tu presupuesto (tu saldo está totalmente abonado).';
    const nro = labOrderNumber || order.labOrderNumber || '';
    const operationInfo = nro ? `• N° de Operación: ${nro}\n` : '';

    // La fecha al principio, como primer dato relevante y sin negrita.
    return `Fecha aproximada de entrega: ${estimatedDate}\n\nHola ${order.client?.name || ''}, ${MARCA_AVISO_PROCESADO} con éxito.\nPor favor, lee esta info importante: Una vez que el pedido esté listo te informaremos para que pases a retirarlo, si tenés dudas sobre el estado, por favor consultanos recién pasada la fecha prevista, recordá que los tiempos de confeccion son aproximados.\n\n${operationInfo}${balanceInfo}`;
}

/**
 * Manda el aviso de procesado por WhatsApp (texto + PDF dentro de la ventana de
 * 24 h; plantilla `estado_pedido` si está cerrada, sin PDF porque la plantilla
 * no lleva documento y el detalle ya viajó con la confirmación de compra).
 *
 * NO lanza: devuelve qué pasó para que el llamador decida si avisa al equipo.
 */
export async function enviarAvisoProcesado(
    order: any,
    opts: { labOrderNumber?: string | null } = {},
): Promise<{ ok: boolean; motivo?: string; estimatedDate: string }> {
    const estimatedDays = calculateEstimatedDays(order?.items || []);
    const estimatedDate = format(addBusinessDays(new Date(), estimatedDays), 'dd/MM/yyyy');

    // Cada intento queda auditado, salga o no. La auditoría del 16/9/2026 midió
    // que 39 de 88 pedidos que pasaron a "Procesado" en 30 días no tienen el
    // mensaje en la conversación, y que solo 5 de esos fallos avisaron al equipo:
    // los otros 34 se perdieron en silencio y no quedó UN registro de qué había
    // contestado el envío. Sin esa fila no se puede diagnosticar nada después.
    const auditar = (ok: boolean, motivo?: string) =>
        logAudit({
            userId: null,
            userName: 'Sistema',
            action: 'NOTIFY',
            entityType: 'ORDER',
            entityId: String(order?.id || ''),
            details: { tipo: 'aviso_procesado', ok, motivo: motivo || null, estimatedDate },
        }).catch(err => console.error('[Aviso procesado] audit:', err));

    const phone = (order?.client?.phone || '').replace(/\D/g, '');
    if (phone.length < 10) {
        const motivo = 'el cliente no tiene teléfono válido';
        auditar(false, motivo);
        return { ok: false, motivo, estimatedDate };
    }

    const msg = textoAvisoProcesado(order, estimatedDate, opts.labOrderNumber);

    let pdfMedia: { base64: string; mimetype: string; filename: string } | null = null;
    try {
        const { generateOrderPDF } = await import('@/lib/order-pdf-generator');
        const pdfResult = await generateOrderPDF(order, order.client);
        pdfMedia = { base64: pdfResult.base64, mimetype: 'application/pdf', filename: pdfResult.filename };
    } catch (pdfErr) {
        console.error('[Aviso procesado] No se pudo generar el PDF:', pdfErr);
    }

    const res = await sendWhatsApp({
        chatId: `${normalizeArgentinePhone(phone)}@c.us`,
        message: msg,
        senderName: 'Sistema Atelier',
        isProactive: true,
        media: pdfMedia,
        template: templateSpec('estado_pedido', [
            (order?.client?.name || 'cliente').split(' ')[0],
            `#${String(order.id).slice(-4).toUpperCase()}`,
            `ya fue enviado a fabricar, con fecha aproximada de entrega ${estimatedDate}`,
        ]),
    });

    if (!res.ok) {
        const motivo = explainSendFailure(res);
        auditar(false, `${motivo} [via:${res.via || '—'} code:${res.code || '—'} http:${res.status || '—'}]`);
        return { ok: false, motivo, estimatedDate };
    }
    // Salió pero no quedó en la conversación: para el auditor es lo mismo que no
    // haber salido, porque nadie lo puede verificar (ver sale-confirmation.ts).
    if (res.guardado === false) {
        const motivo = 'salió pero NO quedó registrado en la conversación';
        auditar(true, motivo);
        return { ok: true, motivo, estimatedDate };
    }
    auditar(true);
    return { ok: true, estimatedDate };
}
