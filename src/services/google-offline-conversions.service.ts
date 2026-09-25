import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { SYSTEM_ACTOR } from '@/lib/actor';
import { GoogleAdsService } from '@/services/google-ads.service';
import {
    VENTANA_CLIC_DIAS,
    clicParaLaVenta,
    esVentaReal,
    fechaDeCierre,
    valorDeVenta,
} from '@/lib/ads/conversiones-offline-core';

/**
 * Sube a Google Ads las ventas del CRM que empezaron con un clic en un anuncio
 * de Google: conversiones offline.
 *
 * El circuito completo (25/9/2026):
 *  1. La landing mete en el mensaje de WhatsApp la etiqueta de campaña Y el id
 *     del clic (`[gclid:…]`, ver wa-attribution.ts). Los sitelinks hacen lo
 *     mismo con el ValueTrack `{gclid}`.
 *  2. El mensaje queda guardado en WhatsAppMessage.content, así que el id del
 *     clic ya está persistido sin columna nueva (misma lógica con la que
 *     attribution.service lee la etiqueta del primer mensaje).
 *  3. Este service, corrido por el cron, busca las ventas cerradas en los
 *     últimos días, les encuentra el clic en los mensajes del cliente y las
 *     sube con importe. Google une la venta al anuncio.
 *
 * Qué NO hace: no cambia nada de la puja. Subir ventas como acción SECUNDARIA
 * solo mide; hacer que Google optimice por ellas es otra decisión (la del 15/9,
 * que espera datos), y se toma en el panel.
 *
 * Idempotente dos veces: Google desduplica por `orderId`, y acá se deja un
 * AuditLog por venta subida para no volver a mandarla. Nunca lanza por una
 * venta: cada falla queda en el resumen.
 */

export const AUDIT_ACTION_GOOGLE_CONVERSION = 'GOOGLE_CONVERSION';

export interface VentaSaltada {
    orderId: string;
    motivo: string;
}

export interface ResumenSubida {
    desde: string;
    hasta: string;
    validateOnly: boolean;
    /** Órdenes con cierre en la ventana. */
    ordenesRevisadas: number;
    /** De esas, ventas reales (pago o fábrica). */
    ventas: number;
    /** Ventas que tenían un clic de Google en los mensajes del cliente. */
    conClic: number;
    /** Ya estaban subidas (AuditLog): no se repiten. */
    yaSubidas: number;
    /** Subidas de verdad en esta corrida. */
    subidas: number;
    /** Aceptadas por Google en modo validateOnly (no registradas). */
    validadas: number;
    /** Sin clic de Google: la mayoría, y está bien (vinieron de Meta, de la calle, del boca a boca). */
    sinClic: number;
    saltadas: VentaSaltada[];
    errores: VentaSaltada[];
    /** Si la carga está apagada por entorno (los dos candados), el motivo. */
    bloqueo?: string;
}

export class GoogleOfflineConversionsService {
    /**
     * @param dias ventana de cierre a revisar (default 10: cubre un cron diario
     *   que haya fallado varios días seguidos; Google desduplica lo repetido).
     * @param validateOnly Google revisa el lote y no registra nada (modo seco).
     */
    static async subirVentasCerradas(
        { dias = 10, validateOnly = false }: { dias?: number; validateOnly?: boolean } = {},
    ): Promise<ResumenSubida> {
        const hasta = new Date();
        const desde = new Date(hasta.getTime() - Math.max(1, Math.min(dias, VENTANA_CLIC_DIAS)) * 864e5);
        const resumen: ResumenSubida = {
            desde: desde.toISOString(),
            hasta: hasta.toISOString(),
            validateOnly,
            ordenesRevisadas: 0,
            ventas: 0,
            conClic: 0,
            yaSubidas: 0,
            subidas: 0,
            validadas: 0,
            sinClic: 0,
            saltadas: [],
            errores: [],
        };

        const ordenes = await prisma.order.findMany({
            where: {
                isDeleted: false,
                OR: [
                    { labSentAt: { gte: desde } },
                    { payments: { some: { date: { gte: desde } } } },
                ],
            },
            select: {
                id: true,
                total: true,
                labStatus: true,
                labSentAt: true,
                clientId: true,
                client: { select: { adTag: true, email: true, phone: true } },
                payments: { select: { amount: true, date: true } },
            },
        });
        resumen.ordenesRevisadas = ordenes.length;

        for (const o of ordenes) {
            const venta = {
                id: o.id,
                total: Number(o.total || 0),
                labStatus: o.labStatus,
                labSentAt: o.labSentAt,
                payments: o.payments.map((p) => ({ amount: Number(p.amount || 0), date: p.date })),
            };
            if (!esVentaReal(venta)) continue;
            resumen.ventas++;

            const cierre = fechaDeCierre(venta);
            if (!cierre || cierre < desde) {
                // Cerrada antes de la ventana (un pago tardío sobre una venta vieja): ya pasó por acá.
                continue;
            }

            const yaSubida = await prisma.auditLog.findFirst({
                where: { action: AUDIT_ACTION_GOOGLE_CONVERSION, entityType: 'ORDER', entityId: o.id },
                select: { id: true },
            });
            if (yaSubida) {
                resumen.yaSubidas++;
                continue;
            }

            const mensajes = await prisma.whatsAppMessage.findMany({
                where: {
                    direction: 'INBOUND',
                    chat: { clientId: o.clientId },
                    createdAt: { gte: new Date(cierre.getTime() - VENTANA_CLIC_DIAS * 864e5), lte: cierre },
                    OR: [
                        { content: { contains: '[gclid:' } },
                        { content: { contains: '[gbraid:' } },
                        { content: { contains: '[wbraid:' } },
                    ],
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: { content: true, createdAt: true },
            });
            const clic = clicParaLaVenta(mensajes, cierre);
            if (!clic) {
                resumen.sinClic++;
                continue;
            }
            resumen.conClic++;

            const valor = valorDeVenta(venta);
            if (!(valor > 0)) {
                resumen.saltadas.push({ orderId: o.id, motivo: 'venta sin importe' });
                continue;
            }

            const subida = await GoogleAdsService.uploadOfflineConversion(
                {
                    orderId: o.id,
                    value: valor,
                    occurredAt: cierre,
                    client: { email: o.client?.email, phone: o.client?.phone },
                    gclid: clic.kind === 'gclid' ? clic.id : null,
                    wbraid: clic.kind === 'wbraid' ? clic.id : null,
                    gbraid: clic.kind === 'gbraid' ? clic.id : null,
                },
                { validateOnly },
            );

            if (subida.skipped) {
                // Los candados de entorno frenan TODO el lote, no una venta: se informa una vez y se corta.
                resumen.bloqueo = subida.skipped;
                break;
            }
            if (!subida.ok) {
                resumen.errores.push({ orderId: o.id, motivo: 'Google rechazó la conversión (ver log del servidor)' });
                continue;
            }
            if (validateOnly) {
                resumen.validadas++;
                continue;
            }
            resumen.subidas++;
            // Se espera el AuditLog: es lo que evita subirla dos veces mañana.
            await logAudit({
                userId: SYSTEM_ACTOR.id,
                userName: SYSTEM_ACTOR.name,
                action: AUDIT_ACTION_GOOGLE_CONVERSION,
                entityType: 'ORDER',
                entityId: o.id,
                details: {
                    valor,
                    cierre: cierre.toISOString(),
                    clic: clic.kind,
                    clicEn: clic.en.toISOString(),
                    campana: o.client?.adTag ?? null,
                },
            });
        }

        return resumen;
    }
}
