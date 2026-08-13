import { sendEmail } from '@/lib/email';
import { ContactService } from '@/services/contact.service';
import { BotService } from '@/services/bot.service';
import { prisma } from '@/lib/db';
import { snapshotFromProduct } from '@/lib/order-snapshot';
import { PricingService, calculateQuoteTotals } from '@/services/PricingService';
import { recalculateCrystalPrices, applyTeñidoPromoDiscount } from '@/lib/promo-utils';
import { TOPE_VENDEDOR } from '@/lib/constants/descuentos';
import { z } from 'zod';
import { fetchWa, getAdminChatId } from '@/lib/wa-config';
import { normalizeArgentinePhone } from '@/services/contact.service';
import { AdsService } from '@/services/ads.service';
import { GoogleAdsService } from '@/services/google-ads.service';
import { GoogleContactsService } from '@/services/google-contacts.service';
import { formatOrderItemsSummary } from '@/lib/order-utils';
import { formatDateTime } from '@/lib/format-date';
import { DETALLE_MARK } from '@/lib/order-detail-summary';
import { frameRecapText, prescriptionRecapText } from '@/lib/sale-recap-text';
import { framesDeLaOrden } from '@/lib/order-frames';
import { sendSaleConfirmation } from '@/lib/sale-confirmation';
import { logAudit } from '@/lib/audit';
import { sendClientEmail, escHtml } from '@/lib/client-email';
import { getOrderShippedHtml } from '@/lib/checkout/checkout-emails';
import { alertDuplicateLabOrderNumber } from '@/lib/duplicate-lab-order-alert';
import { findLabNumberConflicts, duplicateMessage } from '@/lib/lab-order-numbers';
import { addBusinessDays, calculateEstimatedDays } from '@/lib/business-days';
import { notifyLowStockCrossing } from '@/lib/low-stock-alert';
import { notifyZeroCostSale } from '@/lib/zero-cost-alert';
import { format } from 'date-fns';
import { OptovisionAuditService } from '@/services/optovision-audit.service';
import { mapOrderPostSale } from '@/types/orders';

const OrderItemSchema = z.object({
    productId: z.string().nullable().optional(),
    quantity: z.number().min(1),
    price: z.number(),
    eye: z.string().nullable().optional(),
    sphereVal: z.number().nullable().optional(),
    cylinderVal: z.number().nullable().optional(),
    axisVal: z.number().nullable().optional(),
    additionVal: z.number().nullable().optional(),
    crystalColor: z.string().nullable().optional(),
    crystalColorType: z.string().nullable().optional(),
    crystalColorNote: z.string().nullable().optional(),
    productBrandSnapshot: z.string().nullable().optional(),
    productNameSnapshot: z.string().nullable().optional(),
    productCategorySnapshot: z.string().nullable().optional(),
});

const OrderUpdateSchema = z.object({
    orderType: z.enum(['QUOTE', 'SALE']).optional(),
    total: z.number().optional(),
    markup: z.number().min(0).optional(),
    // El piso en 0 no es cosmético: un descuento negativo INFLA la venta, y el
    // de transferencia además se usa para convertir pagos a equivalente de lista
    // (dividir por 1 - d/100), así que un valor fuera de rango descuadra el saldo.
    discountCash: z.number().min(0).optional(),
    discountTransfer: z.number().min(0).optional(),
    discountCard: z.number().min(0).optional(),
    specialDiscount: z.number().min(0).optional(),
    subtotalWithMarkup: z.number().optional(),
    prescriptionId: z.string().nullable().optional(),
    frameSource: z.enum(['OPTICA', 'USUARIO']).nullable().optional(),
    userFrameBrand: z.string().nullable().optional(),
    userFrameModel: z.string().nullable().optional(),
    userFrameNotes: z.string().nullable().optional(),
    items: z.array(OrderItemSchema).optional(),
    isLocked: z.boolean().optional(),
    // Despacho: datos del envío que se le mandan al cliente. Cargar el número
    // de seguimiento es lo que dispara el aviso (ver notifyOrderDispatched).
    shippingCarrier: z.string().nullable().optional(),
    trackingNumber: z.string().nullable().optional(),
    trackingUrl: z.string().nullable().optional(),
    // Despacho sin código de seguimiento (moto, entrega propia): permite avisarle
    // igual al cliente. Sin esto, esos envíos seguían siendo silencio total.
    markDispatched: z.boolean().optional(),
    // Lab fields
    labStatus: z.string().optional(),
    labNotes: z.string().nullable().optional(),
    clientNote: z.string().nullable().optional(),
    labOrderNumber: z.string().nullable().optional(),
    labColor: z.string().nullable().optional(),
    labTreatment: z.string().nullable().optional(),
    labDiameter: z.string().nullable().optional(),
    labPdOd: z.string().nullable().optional(),
    labPdOi: z.string().nullable().optional(),
    labPrismOD: z.string().nullable().optional(),
    labPrismOI: z.string().nullable().optional(),
    labBaseCurve: z.string().nullable().optional(),
    labFrameType: z.string().nullable().optional(),
    labBevelPosition: z.string().nullable().optional(),
    smartLabScreenshot: z.string().nullable().optional(),
    labFrameShape: z.string().nullable().optional(),
    labFrameDetails: z.string().nullable().optional(),
    frameA2: z.string().nullable().optional(),
    frameB2: z.string().nullable().optional(),
    frameDbl2: z.string().nullable().optional(),
    frameEdc2: z.string().nullable().optional(),
    labFrameShape2: z.string().nullable().optional(),
    labFrameDetails2: z.string().nullable().optional(),
    frameImageUrl: z.string().nullable().optional(),
    frameImageUrl2: z.string().nullable().optional(),
    labHeightOD: z.union([z.string(), z.number()]).nullable().optional(),
    labHeightOI: z.union([z.string(), z.number()]).nullable().optional(),
    labHeightOD2: z.union([z.string(), z.number()]).nullable().optional(),
    labHeightOI2: z.union([z.string(), z.number()]).nullable().optional(),
    // Promo
    appliedPromoName: z.string().nullable().optional(),
    authorizedByAdmin: z.boolean().optional(),
    // Post Sale
    postSaleNotes: z.string().nullable().optional(),
    postSaleCost: z.number().nullable().optional(),
    postSaleResponsible: z.string().nullable().optional(),
    postSaleOrderOption: z.string().nullable().optional(),
    postSaleNewOrderNumber: z.string().nullable().optional(),
    postSaleStatus: z.string().nullable().optional(),
    postSaleRxData: z.string().nullable().optional(),
    postSaleCaseType: z.string().nullable().optional(),
    postSaleFault: z.string().nullable().optional(),
    // Quién de la óptica cometió el error, cuando postSaleFault === 'Óptica'.
    // Es la caja a la que se va a proponer imputar el costo en el cierre
    // económico del caso (ver /api/post-sale/[id]/cost).
    postSaleFaultUserId: z.string().nullable().optional(),
    postSaleCoverage: z.string().nullable().optional(),
    // Imagen adjunta a la observación que se agrega en este PATCH
    postSaleNoteImageUrl: z.string().nullable().optional(),
    // Observación única a agregar (append server-side, sin reconstruir el string
    // completo desde el cliente). Evita duplicar notas si el cliente tiene un
    // snapshot desactualizado. Es el camino preferido para sumar una observación.
    postSaleNoteEntry: z.string().nullable().optional(),
}).passthrough();

// export const dynamic = 'force-dynamic';

export class OrderService {
    static async getOrder(id: string) {
        try {

        const order = await prisma.order.findUnique({
            where: { id },
            select: {
                id: true,
                clientId: true,
                status: true,
                orderType: true,
                isLocked: true,
                authorizedByAdmin: true,
                total: true,
                postSaleCases: {
                    orderBy: { createdAt: 'desc' as const },
                    select: {
                        id: true,
                        status: true,
                        cost: true,
                        newOrderNumber: true,
                        notes: true,
                        orderOption: true,
                        responsible: true,
                        caseType: true,
                        fault: true,
                        coverage: true,
                        rxData: true,
                        createdAt: true,
                        notesList: {
                            select: {
                                id: true,
                                content: true,
                                createdBy: true,
                                createdAt: true
                            }
                        }
                    }
                },
                paid: true,
                markup: true,
                discountCash: true,
                discountTransfer: true,
                discountCard: true,
                specialDiscount: true,
                subtotalWithMarkup: true,
                frameSource: true,
                userFrameBrand: true,
                userFrameModel: true,
                userFrameNotes: true,
                prescriptionId: true,
                labStatus: true,
                createdAt: true,
                updatedAt: true,
                items: {
                    select: {
                        id: true,
                        price: true,
                        quantity: true,
                        eye: true,
                        sphereVal: true,
                        cylinderVal: true,
                        axisVal: true,
                        additionVal: true,
                        crystalColor: true,
                        crystalColorType: true,
                        crystalColorNote: true,
                        productNameSnapshot: true,
                        productBrandSnapshot: true,
                        productCategorySnapshot: true,
                        productCostSnapshot: true,
                        laboratorySnapshot: true,
                        productTypeSnapshot: true,
                        productLensIndexSnapshot: true,
                        productUnitTypeSnapshot: true,
                        productOriginSnapshot: true,
                        product: {
                            select: {
                                id: true,
                                name: true,
                                brand: true,
                                model: true,
                                category: true,
                                type: true,
                                price: true,
                                stock: true,
                                lensIndex: true,
                                laboratory: true,
                                origin: true,
                            }
                        }
                    }
                },
                client: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        prescriptions: true,
                    }
                },
                prescription: true,
                payments: true,
                // Lab fields
                labOrderNumber: true,
                labNotes: true,
                clientNote: true,
                labSentAt: true,
                labColor: true,
                labTreatment: true,
                labDiameter: true,
                labPdOd: true,
                labPdOi: true,
                labPrismOD: true,
                labPrismOI: true,
                labBaseCurve: true,
                labFrameType: true,
                labBevelPosition: true,
                smartLabScreenshot: true,
                smartLabSector: true,
                smartLabProgress: true,
                smartLabLastSync: true,
                labFrameShape: true,
                labFrameDetails: true,
                frameA: true,
                frameB: true,
                frameDbl: true,
                frameEdc: true,
                frameA2: true,
                frameB2: true,
                frameDbl2: true,
                frameEdc2: true,
                labFrameShape2: true,
                labFrameDetails2: true,
                smartLabEntryDate: true,
                smartLabDays: true,
                smartLabDetails: true,
            }
        });

        // La ruta traduce este mensaje a un 404. Devolver un NextResponse desde
        // acá hacía que la ruta lo re-serializara y el 404 saliera como 200.
        if (!order) {
            throw new Error('Order not found');
        }

        const mapped = mapOrderPostSale(order);
        const response = {
            ...mapped,
            contact: order.client
        };

        return response;
    } catch (error: any) {
        console.error('Error fetching order:', error);
        throw new Error(error.message);
    }
}

    static async deleteOrder(id: string, reason: string, role: string, userId: string | null, userName: string | null) {
        try {
        // Only ADMIN can delete orders
        if (role !== 'ADMIN') {
            throw new Error('Solo el administrador puede eliminar operaciones. Solicitá la eliminación desde el panel de ventas.');
        }

        // Snapshot de los pagos ANTES del borrado: deleteOrder hace hard-delete
        // de todos los Payment y sin esto desaparecerían sin rastro de qué eran.
        const paymentsSnapshot = await prisma.payment.findMany({
            where: { orderId: id },
            select: { id: true, amount: true, method: true, notes: true, receiptUrl: true, date: true, createdByName: true }
        });

        const order = await ContactService.deleteOrder(id, reason);

        await logAudit({
            userId,
            userName,
            action: 'DELETE',
            entityType: 'ORDER',
            entityId: id,
            details: { reason, orderType: order.orderType, total: order.total, deletedPayments: paymentsSnapshot }
        });

        // El borrado queda visible en la ficha del cliente
        await prisma.interaction.create({
            data: {
                clientId: order.clientId,
                type: 'SISTEMA',
                content: `🗑️ ${userName || 'Administrador'} eliminó el pedido #${id.slice(-4).toUpperCase()} (${order.orderType === 'SALE' ? 'venta' : 'presupuesto'} de $${(order.total || 0).toLocaleString('es-AR')}${paymentsSnapshot.length > 0 ? `, ${paymentsSnapshot.length} pago/s` : ''}). Motivo: ${reason}`,
                userId: userId || null,
                userName: userName || 'Administrador'
            }
        }).catch(err => console.error('Error registrando borrado de pedido en ficha:', err));

        return order;
    } catch (error) {
        console.error('Error deleting order:', error);
        throw new Error('Error al eliminar el pedido');
    }
}

    /**
     * Avisa al cliente que su pedido SALIÓ (o quedó en camino).
     *
     * Existe porque entre el cobro y la entrega no se le mandaba nada: una compra
     * web podía tener dos semanas de silencio después de haberle cobrado, y esa
     * es la principal causa de "¿qué pasó con mi pedido?".
     *
     * Sigue el patrón de BotService.notifyOrderReady: sale por WhatsApp y —si la
     * ficha tiene mail— también por email con copia al negocio; si no llega por
     * ningún canal, deja una tarea para avisar a mano. La diferencia es que este
     * aviso se manda UNA sola vez: `dispatchNotifiedAt` lo sella, así reeditar el
     * pedido (corregir el correo, el número, cualquier cosa) no lo repite.
     */
    static async notifyOrderDispatched(orderId: string, actorName: string = 'Sistema') {
        let clientIdParaFallback: string | null = null;
        let nombreParaFallback = 'Cliente';
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                select: {
                    id: true,
                    clientId: true,
                    shippingCarrier: true,
                    trackingNumber: true,
                    trackingUrl: true,
                    dispatchNotifiedAt: true,
                    client: { select: { name: true, phone: true, email: true } },
                },
            });
            if (!order) return false;
            // Ya avisado: cortar acá es lo que evita el segundo mail al cliente.
            if (order.dispatchNotifiedAt) return false;

            clientIdParaFallback = order.clientId;
            const clientName = order.client?.name || 'Cliente';
            nombreParaFallback = clientName;
            const firstName = clientName.trim().split(/\s+/)[0] || clientName;
            const clientPhone = order.client?.phone || null;
            const clientEmail = order.client?.email?.trim() || null;
            if (!clientPhone && !clientEmail) return false;

            const shortId = order.id.slice(-4).toUpperCase();
            const carrier = order.shippingCarrier?.trim() || null;
            const tracking = order.trackingNumber?.trim() || null;
            const trackingUrl = order.trackingUrl?.trim() || null;

            // Email primero: nunca lanza, así un fallo de WhatsApp no se lleva
            // puesto también este canal.
            const emailEnviado = await sendClientEmail({
                to: clientEmail,
                subject: `Tu pedido #${shortId} ya está en camino — Atelier Óptica`,
                bodyHtml: getOrderShippedHtml({
                    firstName: escHtml(firstName),
                    orderId: order.id,
                    carrier: carrier ? escHtml(carrier) : null,
                    tracking: tracking ? escHtml(tracking) : null,
                    trackingUrl: trackingUrl ? escHtml(trackingUrl) : null,
                }),
                label: 'pedido despachado',
            });

            let message = `*Hola ${clientName}*\n\n`;
            message += `Te avisamos que *tu pedido #${shortId} ya fue despachado* 📦\n\n`;
            if (carrier) message += `*Correo:* ${carrier}\n`;
            if (tracking) message += `*N° de seguimiento:* ${tracking}\n`;
            if (trackingUrl) message += `*Seguilo acá:* ${trackingUrl}\n`;
            message += `\nLlega en *3 a 5 días hábiles* desde el despacho.\n\n`;
            message += `Cualquier cosa, respondenos por acá. ¡Gracias por elegirnos!\n`;

            let whatsappEnviado = false;
            if (clientPhone) {
                const formattedPhone = normalizeArgentinePhone(clientPhone);
                if (formattedPhone) {
                    const res = await fetchWa('/api/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chatId: `${formattedPhone}@c.us`, message }),
                    });
                    whatsappEnviado = res.ok;
                    if (!res.ok) {
                        console.warn('[Auto-Notify DESPACHO] WhatsApp devolvió error:', await res.text());
                    }
                }
            }

            if (!whatsappEnviado && !emailEnviado) {
                throw new Error('No se pudo notificar por ningún canal');
            }

            // El sello va después de haber salido: si se marcara antes y el envío
            // fallara, el cliente quedaría sin aviso y sin forma de reintentarlo.
            await prisma.order.update({
                where: { id: order.id },
                data: { dispatchNotifiedAt: new Date() },
                select: { id: true },
            });

            const canales = [whatsappEnviado ? 'WhatsApp' : null, emailEnviado ? 'email' : null].filter(Boolean).join(' y ');
            const detalle = tracking ? ` Seguimiento: ${carrier ? `${carrier} ` : ''}${tracking}.` : '';
            await prisma.interaction.create({
                data: {
                    clientId: order.clientId,
                    type: 'NOTE',
                    content: `📦 Aviso de despacho enviado por ${canales} (pedido #${shortId}), despachado por ${actorName}.${detalle}`,
                    userName: actorName,
                },
            });

            logAudit({
                userId: null,
                userName: actorName,
                action: 'UPDATE',
                entityType: 'ORDER',
                entityId: order.id,
                details: { evento: 'aviso_despacho', canales, trackingNumber: tracking, shippingCarrier: carrier },
            }).catch(err => console.error('Error logging audit del aviso de despacho:', err));

            return true;
        } catch (error: any) {
            console.error('[Auto-Notify DESPACHO] Error:', error?.message);
            // Igual que en notifyOrderReady: si no se pudo avisar, alguien tiene
            // que hacerlo a mano. El silencio es justo lo que este aviso ataca.
            if (clientIdParaFallback) {
                try {
                    await prisma.clientTask.create({
                        data: {
                            clientId: clientIdParaFallback,
                            description: `⚠️ Falló el aviso automático de despacho a ${nombreParaFallback} (pedido #${orderId.slice(-4).toUpperCase()}). Avisarle a mano que su pedido salió.`,
                            status: 'PENDING',
                            type: 'TASK',
                        },
                    });
                } catch (dbErr) {
                    console.error('Error creando la tarea de fallback del aviso de despacho:', dbErr);
                }
            }
            return false;
        }
    }

    static async updateOrder(id: string, body: any, userId?: string | null, userName?: string | null, role?: string | null) {
        try {
        
        // Validation Layer (Bouncer)
        const validation = OrderUpdateSchema.safeParse(body);
        if (!validation.success) {
            throw new Error('Datos inválidos');
        }

        // ── Guard: prevent editing items/pricing on SALE orders based on lock state ──
        const existingForGuard = await prisma.order.findUnique({
            where: { id },
            select: { orderType: true, isLocked: true }
        });

        if (existingForGuard?.orderType === 'SALE') {
            // 1. Unlocking (isLocked: false) is ADMIN-only
            if (body.isLocked === false && existingForGuard.isLocked && role !== 'ADMIN') {
                throw new Error('Solo el administrador puede reabrir una venta.');
            }
            // 1.5 La reapertura exige MOTIVO: queda registrado en el historial
            // de la ficha (quién, cuándo, por qué). Sin motivo no hay reapertura.
            if (body.isLocked === false && existingForGuard.isLocked) {
                if (!(body.reopenReason || '').toString().trim()) {
                    throw new Error('La reapertura necesita un motivo: quedará registrado en el historial de la ficha.');
                }
            }

            // 2. CANDADO TOTAL (12/8/2026). Antes solo se frenaban los campos
            // financieros: las medidas del armazón, el teñido, la receta y las
            // notas de lab de una venta YA ENVIADA A FÁBRICA se podían pisar
            // desde la pestaña Ventas sin dejar rastro — "yo lo cargué bien" era
            // indemostrable. Regla del negocio: en una venta enviada no se
            // modifica NADA del pedido; lo único que puede avanzar es el flujo
            // posterior (laboratorio, despacho, post-venta, notas nuevas) y la
            // reapertura del admin.
            const isUnlockingNow = body.isLocked === false;
            if (existingForGuard.isLocked && !isUnlockingNow) {
                // Lo ÚNICO que puede tocar una venta enviada:
                const PERMITIDOS_VENTA_ENVIADA = new Set([
                    'labStatus', 'labOrderNumber', 'smartLabScreenshot',   // flujo de laboratorio
                    'shippingCarrier', 'trackingNumber', 'trackingUrl', 'markDispatched', // despacho
                    'clientNote', 'postSaleNoteEntry', 'postSaleNoteImageUrl', // notas nuevas
                    'isLocked', 'authorizedByAdmin', 'reopenReason',       // administración
                    // La foto del armazón DOCUMENTA lo que se vendió, no lo define:
                    // agregarla después no cambia una sola medida de lo que va a
                    // fabricar la fábrica. Si quedara congelada, una venta enviada
                    // sin foto no podría tenerla nunca — y el vendedor muchas veces
                    // la saca al entregar el armazón, no al cargar el pedido.
                    'frameImageUrl', 'frameImageUrl2',
                ]);
                // Campos del PEDIDO que quedan congelados con la venta.
                const CONGELADOS: string[] = [
                    'labNotes', 'labColor', 'labTreatment', 'labDiameter',
                    'labPdOd', 'labPdOi',
                    'labHeightOD', 'labHeightOI', 'labHeightOD2', 'labHeightOI2',
                    'labPrismOD', 'labPrismOI', 'labBaseCurve',
                    'labFrameType', 'labBevelPosition', 'labFrameShape', 'labFrameDetails',
                    'frameA', 'frameB', 'frameDbl', 'frameEdc',
                    'frameA2', 'frameB2', 'frameDbl2', 'frameEdc2', 'labFrameShape2', 'labFrameDetails2',
                    'frameSource', 'userFrameBrand', 'userFrameModel', 'userFrameNotes',
                    'prescriptionId', 'total', 'markup', 'subtotalWithMarkup',
                    'discountCash', 'discountTransfer', 'discountCard', 'specialDiscount',
                    'orderType', 'clientId', 'userId',
                ];
                const tocados = Object.keys(body).filter(k =>
                    !PERMITIDOS_VENTA_ENVIADA.has(k) && !k.startsWith('postSale')
                );
                if (tocados.length > 0) {
                    // Varias pantallas reenvían campos sin cambios en cada guardado
                    // (patrón del cotizador con los descuentos): rechazar solo lo
                    // que efectivamente CAMBIA, comparando contra lo guardado.
                    const actual: any = await prisma.order.findUnique({
                        where: { id },
                        select: Object.fromEntries(CONGELADOS.filter(c => c !== 'items').map(c => [c, true])) as any,
                    });
                    const cambiados = tocados.filter(k => {
                        if (!CONGELADOS.includes(k)) return true; // campo desconocido sobre venta enviada: afuera
                        const nuevo = body[k];
                        const viejo = actual?.[k];
                        if (nuevo === undefined) return false;
                        if (typeof nuevo === 'number' || typeof viejo === 'number') {
                            return Number(nuevo ?? 0) !== Number(viejo ?? 0);
                        }
                        return String(nuevo ?? '') !== String(viejo ?? '');
                    });
                    if (cambiados.length > 0) {
                        throw new Error(`Venta enviada a fábrica: no se puede modificar ${cambiados.join(', ')}. Para corregirla, un admin debe reabrirla (el cambio queda registrado).`);
                    }
                }
            }
        }

        if (body.items) {
            if (existingForGuard?.orderType === 'SALE' && existingForGuard?.isLocked) {
                throw new Error('No se pueden modificar los ítems de una venta bloqueada. Solicitá reapertura al administrador.');
            }
        }

        // Transiciones del candado de una VENTA — se registran en el historial
        // después del update (regla del 12/8/2026: el paso a paso completo).
        const esReapertura = existingForGuard?.orderType === 'SALE'
            && existingForGuard.isLocked && body.isLocked === false;
        const esReconfirmacion = existingForGuard?.orderType === 'SALE'
            && !existingForGuard.isLocked && body.isLocked === true;

        // ── Guard: authorizedByAdmin can only be changed by ADMIN ──
        if (body.authorizedByAdmin !== undefined && role !== 'ADMIN') {
            const currentOrderForAuth = await prisma.order.findUnique({
                where: { id },
                select: { authorizedByAdmin: true }
            });
            if (currentOrderForAuth && body.authorizedByAdmin !== currentOrderForAuth.authorizedByAdmin) {
                throw new Error('Solo el administrador puede autorizar señas menores al 50%.');
            }
        }

        // ── Guard: el descuento especial es una excepción que solo da el admin ──
        // El campo se oculta en la UI para el resto, pero el cotizador lo manda
        // siempre (en 0): solo rechazamos cuando el valor efectivamente cambia.
        if (body.specialDiscount !== undefined && role !== 'ADMIN') {
            const currentForDiscount = await prisma.order.findUnique({
                where: { id },
                select: { specialDiscount: true }
            });
            const actual = currentForDiscount?.specialDiscount || 0;
            if (Math.round(body.specialDiscount || 0) !== Math.round(actual)) {
                throw new Error('Solo el administrador puede aplicar o modificar el descuento especial.');
            }
        }

        // ── Guard: descuentos por forma de pago (tope del vendedor) ──
        // El techo no es el tope pelado sino el MAYOR entre el tope y lo que la
        // orden ya tiene: si el admin autorizó un 30%, el vendedor tiene que
        // poder seguir editando esa venta (el cotizador reenvía los tres campos
        // en cada guardado) y bajarlo, pero nunca subirlo por su cuenta.
        // (los negativos ya los frenó el Zod de arriba, con su `.min(0)`)
        if (role !== 'ADMIN'
            && (body.discountCash !== undefined || body.discountTransfer !== undefined)) {
            const actualDtos = await prisma.order.findUnique({
                where: { id },
                select: { discountCash: true, discountTransfer: true }
            });
            const sube = (propuesto: number | undefined, guardado: number | null | undefined, tope: number) =>
                propuesto !== undefined && propuesto > Math.max(tope, guardado ?? tope);
            if (sube(body.discountCash, actualDtos?.discountCash, TOPE_VENDEDOR.discountCash)) {
                throw new Error(`Solo el administrador puede dar más de ${TOPE_VENDEDOR.discountCash}% de descuento por efectivo.`);
            }
            if (sube(body.discountTransfer, actualDtos?.discountTransfer, TOPE_VENDEDOR.discountTransfer)) {
                throw new Error(`Solo el administrador puede dar más de ${TOPE_VENDEDOR.discountTransfer}% de descuento por transferencia.`);
            }
        }

        const { 
            labStatus, labNotes, clientNote, orderType, labOrderNumber, 
            frameSource, userFrameBrand, userFrameModel, userFrameNotes, 
            labColor, labTreatment, labDiameter, labPdOd, labPdOi, 
            frameA, frameB, frameDbl, frameEdc, smartLabScreenshot,
            labPrismOD, labPrismOI, labBaseCurve, labFrameType, labBevelPosition,
            labFrameShape, labFrameDetails,
            frameA2, frameB2, frameDbl2, frameEdc2, labFrameShape2, labFrameDetails2,
            shippingCarrier, trackingNumber, trackingUrl, markDispatched,
            prescriptionId, items, total, markup,
            discountCash, discountTransfer, discountCard, specialDiscount, subtotalWithMarkup,
            isLocked, authorizedByAdmin,
            postSaleNotes, postSaleCost, postSaleResponsible,
            postSaleOrderOption, postSaleNewOrderNumber, postSaleStatus, postSaleRxData, postSaleCaseType,
            postSaleFault, postSaleFaultUserId, postSaleCoverage, postSaleNoteImageUrl, postSaleNoteEntry
        } = body;

        // Observación única a agregar en este PATCH (camino preferido, sin que el
        // cliente reconstruya el historial). Se estampa server-side.
        const noteEntryText = (postSaleNoteEntry || '').toString().trim();
        const stampedNoteEntry = noteEntryText
            ? `[${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}]: ${noteEntryText}`
            : '';

        const data: any = {};
        if (isLocked !== undefined) data.isLocked = isLocked;

        // Re-confirmación de una venta reabierta: el snapshot de la receta se
        // VERSIONA — la versión anterior no se pisa, se apila en `history`. El
        // "pedido nuevo" que exige el negocio queda materializado como versión
        // + su propio evento en el historial; la que vale para fábrica es
        // siempre la última.
        if (esReconfirmacion) {
            const actualParaSnap = await prisma.order.findUnique({
                where: { id },
                select: { prescriptionId: true, prescriptionSnapshot: true },
            });
            const rxId = prescriptionId ?? actualParaSnap?.prescriptionId;
            if (rxId) {
                const rxCompleta = await prisma.prescription.findUnique({ where: { id: rxId } });
                if (rxCompleta) {
                    let prevSnap: any = null;
                    try { prevSnap = actualParaSnap?.prescriptionSnapshot ? JSON.parse(actualParaSnap.prescriptionSnapshot) : null; } catch { /* snapshot ilegible: se arranca de cero */ }
                    const history = prevSnap
                        ? [...(prevSnap.history || []), { v: prevSnap.v, frozenAt: prevSnap.frozenAt, frozenBy: prevSnap.frozenBy, rx: prevSnap.rx }]
                        : [];
                    data.prescriptionSnapshot = JSON.stringify({
                        v: (prevSnap?.v || 0) + 1,
                        frozenAt: new Date().toISOString(),
                        frozenBy: userName || 'Sistema',
                        rx: rxCompleta,
                        history,
                    });
                }
            }
        }
        if (authorizedByAdmin !== undefined) data.authorizedByAdmin = authorizedByAdmin;
        
        // Use existing values if not provided in body (need to fetch order first if totals are missing)
        let finalMarkup = markup;
        let finalDiscountCash = discountCash;

        if (items || markup !== undefined || discountCash !== undefined || specialDiscount !== undefined) {
            const currentOrder = await prisma.order.findUnique({
                where: { id },
                select: {
                    id: true, total: true, markup: true, discountCash: true, specialDiscount: true, orderType: true,
                    items: { select: { productId: true, price: true, quantity: true, product: { select: { id: true, is2x1: true, category: true, type: true } } } }
                }
            });

            if (currentOrder) {
                finalMarkup = markup !== undefined ? markup : currentOrder.markup;
                finalDiscountCash = discountCash !== undefined ? discountCash : currentOrder.discountCash;
                
                const itemsToCalculate = items || currentOrder.items;
                
                // Fetch full product details for items (essential for promo logic)
                const productIds = itemsToCalculate.map((it: any) => it.productId).filter(Boolean);
                const dbProducts = await prisma.product.findMany({
                    where: { id: { in: productIds } }
                });

                // If items are provided in the update body, recalculate crystal prices to prevent pricing bypasses
                if (items) {
                    items.forEach((it: any) => {
                        it.product = dbProducts.find(p => p.id === it.productId) || it.product;
                    });
                    recalculateCrystalPrices(items);
                    const tintStylePrices = Object.fromEntries(
                        (await prisma.tintStylePrice.findMany()).map(t => [t.category, t.price])
                    );
                    applyTeñidoPromoDiscount(items, tintStylePrices);
                }

                // Map items for calculateQuoteTotals utility
                const cartItems = itemsToCalculate.map((it: any) => ({
                    product: dbProducts.find(p => p.id === it.productId) || it.product || { price: it.price },
                    quantity: it.quantity,
                    customPrice: it.price
                }));

                // Fetch Atelier average price products if promo active
                const hasPromo = cartItems.some((it: any) => it.product?.is2x1);
                let allProducts: any[] = [];
                if (hasPromo) {
                    allProducts = await prisma.product.findMany({
                        where: { 
                            OR: [
                                { brand: { contains: 'Atelier' } },
                                { name: { contains: 'Atelier' } },
                                { category: 'FRAME' }
                            ]
                        }
                    });
                }

                const totals = calculateQuoteTotals(
                    cartItems, 
                    finalMarkup || 0, 
                    finalDiscountCash || 0, 
                    allProducts,
                    specialDiscount !== undefined ? specialDiscount : (currentOrder.specialDiscount || 0)
                );

                data.subtotalWithMarkup = totals.subtotalWithMarkup;
                data.specialDiscount = Math.round(totals.specialDiscountAmount);
                data.total = totals.totalCash;
                data.appliedPromoName = totals.appliedPromoName;
                data.appliedPromoDiscount = totals.promoFrameDiscount;
            }
        }
        
        if (labFrameShape !== undefined) data.labFrameShape = labFrameShape;
        if (labFrameDetails !== undefined) data.labFrameDetails = labFrameDetails;

        if (markup !== undefined) data.markup = Math.max(0, markup);
        if (discountCash !== undefined) data.discountCash = discountCash;
        if (discountTransfer !== undefined) data.discountTransfer = discountTransfer;
        if (discountCard !== undefined) data.discountCard = discountCard;
        // OJO: `data.specialDiscount` ya viene del recálculo de arriba, topeado al
        // subtotal. Pisarlo acá con el valor crudo guardaba un descuento mayor al
        // que el precio realmente absorbió (el subtotal se clampea en 0, el campo
        // no) y los reportes contaban un descuento que nunca se dio. Solo lo
        // escribimos cuando no hubo recálculo que lo definiera.
        if (specialDiscount !== undefined && data.specialDiscount === undefined) {
            data.specialDiscount = Math.max(0, specialDiscount);
        }

        if (items && Array.isArray(items)) {
            // Load prescription details if order has prescription (to sync with crystal items)
            let rxDetails: any = null;
            const effectiveRxId = prescriptionId !== undefined ? prescriptionId : (existingForGuard ? (await prisma.order.findUnique({ where: { id }, select: { prescriptionId: true } }))?.prescriptionId : null);
            if (effectiveRxId) {
                rxDetails = await prisma.prescription.findUnique({
                    where: { id: effectiveRxId }
                });
            }

            // If it is already a SALE order, we must revert the stock of old items and deduct stock for new items.
            if (existingForGuard?.orderType === 'SALE') {
                const currentOrderWithItems = await prisma.order.findUnique({
                    where: { id },
                    select: {
                        items: {
                            select: {
                                productId: true,
                                quantity: true,
                                product: { select: { category: true, type: true } }
                            }
                        }
                    }
                });

                const oldStockItems = (currentOrderWithItems?.items || []).filter((item: any) => {
                    const cat = item.product?.category;
                    const type = item.product?.type;
                    return item.productId && !(cat === 'Cristal' || cat === 'Tratamiento' || cat === 'TRATAMIENTO' || (type || '').includes('Cristal'));
                });

                const newProductIds = items.map((it: any) => it.productId).filter(Boolean);
                const dbNewProducts = await prisma.product.findMany({
                    where: { id: { in: newProductIds } }
                });

                const newStockItems = items.filter((item: any) => {
                    const dbProd = dbNewProducts.find(p => p.id === item.productId);
                    if (!dbProd) return false;
                    const cat = dbProd.category;
                    const type = dbProd.type;
                    return !(cat === 'Cristal' || cat === 'Tratamiento' || cat === 'TRATAMIENTO' || (type || '').includes('Cristal'));
                });

                // Check stock availability for new stock items (taking into account what is currently held by this order)
                const insufficientStock: string[] = [];
                for (const newItem of newStockItems) {
                    const dbProd = dbNewProducts.find(p => p.id === newItem.productId)!;
                    const oldItem = oldStockItems.find(o => o.productId === newItem.productId);
                    const oldQty = oldItem ? oldItem.quantity : 0;
                    const netQtyNeeded = newItem.quantity - oldQty;
                    if (netQtyNeeded > 0 && dbProd.stock < netQtyNeeded) {
                        const name = `${dbProd.brand || ''} ${dbProd.name || ''}`.trim();
                        insufficientStock.push(`${name}: stock ${dbProd.stock}, necesitás ${netQtyNeeded} más (neto)`);
                    }
                }

                if (insufficientStock.length > 0) {
                    throw new Error(`Stock insuficiente:\n${insufficientStock.join('\n')}`);
                }

                // In the transaction (or before updating), adjust the stocks
                await prisma.$transaction(async (tx) => {
                    // Revert old items stock
                    for (const oldItem of oldStockItems) {
                        await tx.product.update({
                            where: { id: oldItem.productId as string },
                            data: { stock: { increment: oldItem.quantity } }
                        });
                    }
                    // Apply new items stock
                    for (const newItem of newStockItems) {
                        await tx.product.update({
                            where: { id: newItem.productId as string },
                            data: { stock: { decrement: newItem.quantity } }
                        });
                    }
                }, { maxWait: 25000, timeout: 25000 });
            }

            const productIds = items.map((it: any) => it.productId).filter(Boolean);
            const dbProducts = await prisma.product.findMany({
                where: { id: { in: productIds } }
            });

            // Preservar la foto congelada de las líneas existentes (clave: id de OrderItem).
            // updateOrder recrea TODAS las líneas (deleteMany + create); si un producto fue
            // borrado (productId null) no hay de dónde re-derivar el snapshot, así que lo tomamos
            // de la fila vieja por id. Autoritativo: no depende de que el front reenvíe los 8 campos.
            const existingSnapshots = await prisma.orderItem.findMany({
                where: { orderId: id },
                select: {
                    id: true, productId: true, productNameSnapshot: true, productBrandSnapshot: true, productCategorySnapshot: true,
                    productCostSnapshot: true, laboratorySnapshot: true, productTypeSnapshot: true,
                    productLensIndexSnapshot: true, productUnitTypeSnapshot: true, productOriginSnapshot: true,
                },
            });
            const prevSnapById = new Map(existingSnapshots.map(e => [e.id, e]));

            data.items = {
                deleteMany: {},
                create: items.map((item: any) => {
                    const dbProd = dbProducts.find(p => p.id === item.productId);
                    const prev = item.id ? prevSnapById.get(item.id) : undefined;
                    const isOD = item.eye === 'OD';
                    const isOI = item.eye === 'OI';
                    const isCrystal = dbProd && (dbProd.category === 'Cristal' || (dbProd.type || '').includes('Cristal'));

                    const liveSnap = snapshotFromProduct(dbProd, {
                        name: prev?.productNameSnapshot ?? item.productNameSnapshot,
                        brand: prev?.productBrandSnapshot ?? item.productBrandSnapshot,
                        category: prev?.productCategorySnapshot ?? item.productCategorySnapshot,
                        cost: prev?.productCostSnapshot ?? item.productCostSnapshot,
                        laboratory: prev?.laboratorySnapshot ?? item.laboratorySnapshot,
                        type: prev?.productTypeSnapshot ?? item.productTypeSnapshot,
                        lensIndex: prev?.productLensIndexSnapshot ?? item.productLensIndexSnapshot,
                        unitType: prev?.productUnitTypeSnapshot ?? item.productUnitTypeSnapshot,
                        origin: prev?.productOriginSnapshot ?? item.productOriginSnapshot,
                    });
                    // Línea preexistente que sigue siendo el MISMO producto: la foto congelada
                    // manda (editar la orden no debe re-estampar el costo histórico con el costo
                    // vivo de hoy); lo vivo solo rellena campos que la foto nunca tuvo. Si la
                    // línea cambió de producto (o es nueva), foto fresca del producto actual.
                    const snap = prev && prev.productId === (item.productId || null)
                        ? {
                            productNameSnapshot: prev.productNameSnapshot ?? liveSnap.productNameSnapshot,
                            productBrandSnapshot: prev.productBrandSnapshot ?? liveSnap.productBrandSnapshot,
                            productCategorySnapshot: prev.productCategorySnapshot ?? liveSnap.productCategorySnapshot,
                            productCostSnapshot: prev.productCostSnapshot ?? liveSnap.productCostSnapshot,
                            laboratorySnapshot: prev.laboratorySnapshot ?? liveSnap.laboratorySnapshot,
                            productTypeSnapshot: prev.productTypeSnapshot ?? liveSnap.productTypeSnapshot,
                            productLensIndexSnapshot: prev.productLensIndexSnapshot ?? liveSnap.productLensIndexSnapshot,
                            productUnitTypeSnapshot: prev.productUnitTypeSnapshot ?? liveSnap.productUnitTypeSnapshot,
                            productOriginSnapshot: prev.productOriginSnapshot ?? liveSnap.productOriginSnapshot,
                        }
                        : liveSnap;

                    return {
                        productId: item.productId || null,
                        quantity: item.quantity,
                        price: item.price,
                        eye: item.eye || null,
                        sphereVal: isCrystal && rxDetails ? (isOD ? rxDetails.sphereOD : rxDetails.sphereOI) : (item.sphereVal ?? null),
                        cylinderVal: isCrystal && rxDetails ? (isOD ? rxDetails.cylinderOD : rxDetails.cylinderOI) : (item.cylinderVal ?? null),
                        axisVal: isCrystal && rxDetails ? (isOD ? rxDetails.axisOD : rxDetails.axisOI) : (item.axisVal ?? null),
                        additionVal: isCrystal && rxDetails ? (isOD ? (rxDetails.additionOD ?? rxDetails.addition) : (rxDetails.additionOI ?? rxDetails.addition)) : (item.additionVal ?? null),
                        ...snap,
                        crystalColor: item.crystalColor || null,
                        crystalColorType: item.crystalColorType || null,
                        crystalColorNote: item.crystalColorNote || null,
                    };
                }),
            };
        }

        // ── FACTORY GATE: Validate requirements before sending to lab ──
        const LAB_SENT_STATUSES = ['SENT', 'IN_PROGRESS', 'FINISHED', 'READY', 'DELIVERED'];
        if (labStatus && LAB_SENT_STATUSES.includes(labStatus)) {
            // Fetch the full order with items, prescription, and payments
            const orderForValidation = await prisma.order.findUnique({
                where: { id },
                select: {
                    id: true,
                    total: true,
                    paid: true,
                    labStatus: true,
                    authorizedByAdmin: true,
                    prescriptionId: true,
                    items: {
                        select: {
                            product: { select: { category: true, type: true, name: true } },
                            eye: true
                        }
                    },
                    prescription: {
                        select: {
                            imageUrl: true,
                            heightOD: true,
                            heightOI: true,
                            distanceOD: true,
                            distanceOI: true,
                            pd: true,
                        }
                    },
                    payments: {
                        select: { amount: true, method: true, receiptUrl: true }
                    },
                    client: {
                        select: { email: true, birthDate: true }
                    }
                }
            });

            if (orderForValidation) {
                // Only validate when advancing FROM NONE (first time sending)
                const currentLabStatus = orderForValidation.labStatus || 'NONE';
                const isFirstSend = currentLabStatus === 'NONE';

                if (isFirstSend) {
                    const errors: string[] = [];

                    // 0. Email validation (required for CAPI and billing)
                    if (!orderForValidation.client?.email) {
                        errors.push('El cliente debe tener un email registrado para enviar a fábrica (necesario para CAPI y facturación).');
                    }

                    // 0b. Birth date (dato obligatorio de la ficha para fabricar)
                    if (!orderForValidation.client?.birthDate) {
                        errors.push('El cliente debe tener la fecha de nacimiento cargada en su ficha para enviar a fábrica.');
                    }

                    // 1. Crystal validations
                    const hasCrystals = orderForValidation.items.some((item: any) =>
                        item.product?.category === 'Cristal' || 
                        item.product?.type === 'Cristal' || 
                        (item.product?.name || '').includes('Cristal')
                    );

                    if (hasCrystals) {
                        // Must have prescription
                        if (!orderForValidation.prescriptionId || !orderForValidation.prescription) {
                            errors.push('El pedido incluye cristales pero no tiene receta seleccionada.');
                        } else {
                            const rx = orderForValidation.prescription;
                            // Must have prescription photo
                            if (!rx.imageUrl) {
                                errors.push('Falta la foto de la receta adjunta.');
                            }
                            // Alturas obligatorias por cada ojo con cristal
                            const crystalEyes = new Set(
                                orderForValidation.items
                                    .filter((item: any) =>
                                        item.product?.category === 'Cristal' ||
                                        item.product?.type === 'Cristal' ||
                                        (item.product?.name || '').includes('Cristal'))
                                    .map((item: any) => item.eye)
                                    .filter(Boolean)
                            );
                            const needsHeightOD = crystalEyes.has('OD') || crystalEyes.size === 0;
                            const needsHeightOI = crystalEyes.has('OI') || crystalEyes.size === 0;
                            if (needsHeightOD && rx.heightOD == null) {
                                errors.push('Falta cargar la Altura del OD en la receta.');
                            }
                            if (needsHeightOI && rx.heightOI == null) {
                                errors.push('Falta cargar la Altura del OI en la receta.');
                            }
                            // Must have DP (at least one field)
                            const hasDP = rx.distanceOD != null || rx.distanceOI != null || rx.pd != null;
                            if (!hasDP) {
                                errors.push('Falta cargar la Distancia Pupilar (DP) en la receta.');
                            }
                        }
                    }

                    // 2. Payment validation: total paid must be >= 50% of order total
                    const totalPaid = orderForValidation.paid || 0;
                    const minRequired = (orderForValidation.total || 0) * 0.5;
                    if (totalPaid < minRequired && !orderForValidation.authorizedByAdmin) {
                        errors.push(`El pago ($${Math.round(totalPaid).toLocaleString()}) no cubre el 50% mínimo ($${Math.ceil(minRequired).toLocaleString()}) para enviar a fábrica.`);
                    }

                    // 3. All payments must have method specified
                    const paymentsWithoutMethod = (orderForValidation.payments || []).filter(
                        (p: any) => !p.method || p.method.trim() === ''
                    );
                    if (paymentsWithoutMethod.length > 0) {
                        errors.push(`Hay ${paymentsWithoutMethod.length} pago(s) sin método de pago especificado.`);
                    }

                    if (errors.length > 0) {
                        throw new Error(`No se puede enviar a fábrica:\n${errors.join('\n')}`);
                    }
                }
            }
        }

        if (labStatus) {
            // "Procesado" significa que el laboratorio ya lo tomó, y eso siempre
            // viene con un nº de operación. Sin él, el pedido queda sin forma de
            // cruzarse con la factura del lab ni de reclamarse.
            if (labStatus === 'IN_PROGRESS') {
                const numeroEntrante = labOrderNumber !== undefined
                    ? (labOrderNumber || '').trim()
                    : null;
                let numeroFinal = numeroEntrante;
                if (numeroFinal === null) {
                    const actualOrder = await prisma.order.findUnique({
                        where: { id },
                        select: { labOrderNumber: true },
                    });
                    numeroFinal = (actualOrder?.labOrderNumber || '').trim();
                }
                if (!numeroFinal) {
                    throw new Error('No se puede procesar el pedido sin N° de operación: cargá el número que devolvió el laboratorio.');
                }
            }

            data.labStatus = labStatus;
            if (labStatus === 'SENT') {
                data.labSentAt = new Date();
            }
            // Auto-complete order when lab marks as delivered
            if (labStatus === 'DELIVERED') {
                data.status = 'COMPLETED';
            }
        }

        // ── Despacho ── (la fecha y el aviso se resuelven más abajo, con el
        // estado previo a la vista: sin él, cada reedición pisaría `shippedAt`)
        if (shippingCarrier !== undefined) data.shippingCarrier = shippingCarrier;
        if (trackingUrl !== undefined) data.trackingUrl = trackingUrl;
        if (trackingNumber !== undefined) data.trackingNumber = trackingNumber;

        if (labNotes !== undefined) data.labNotes = labNotes;
        if (clientNote !== undefined) data.clientNote = clientNote;
        if (labOrderNumber !== undefined) {
            data.labOrderNumber = labOrderNumber;
            // Auto-set status to IN_PROGRESS (Procesado) when operation number is loaded
            if (labOrderNumber && labOrderNumber.trim() !== '' && !labStatus) {
                const fullOrder = await prisma.order.findUnique({
                    where: { id },
                    include: {
                        client: true,
                        items: {
                            include: {
                                product: true
                            }
                        },
                        prescription: true,
                        payments: true
                    }
                });
                // Auto-advance if still in NONE (Pendiente) or SENT (Falta procesar)
                if (fullOrder && (!fullOrder.labStatus || fullOrder.labStatus === 'NONE' || fullOrder.labStatus === 'SENT')) {
                    data.labStatus = 'IN_PROGRESS';
                    if (!fullOrder.labSentAt) {
                        data.labSentAt = new Date();
                    }

                    // Enviar mensaje automático de laboratorio procesado
                    try {
                        const estimatedDays = calculateEstimatedDays(fullOrder.items || []);
                        const estimatedDate = format(addBusinessDays(new Date(), estimatedDays), 'dd/MM/yyyy');
                        const phone = fullOrder.client?.phone?.replace(/\D/g, '');
                        
                        if (phone && phone.length >= 10) {
                            const financials = PricingService.calculateOrderFinancials(fullOrder);
                            const activeLabOrderNumber = labOrderNumber || fullOrder.labOrderNumber || '';

                            let balanceInfo = '';
                            if (financials.hasBalance) {
                                balanceInfo = `Adjuntamos el PDF con el detalle de tu presupuesto, pagos y saldo pendiente.`;
                            } else {
                                balanceInfo = `Adjuntamos el PDF con el detalle de tu presupuesto (tu saldo está totalmente abonado).`;
                            }

                            const operationInfo = activeLabOrderNumber ? `• N° de Operación: ${activeLabOrderNumber}\n` : '';

                            // La fecha al principio como primer dato relevante sin formato negrita
                            const msg = `Fecha aproximada de entrega: ${estimatedDate}\n\nHola ${fullOrder.client?.name || ''}, tu pedido ya fue procesado con éxito.\nPor favor, lee esta info importante: Una vez que el pedido esté listo te informaremos para que pases a retirarlo, si tenés dudas sobre el estado, por favor consultanos recién pasada la fecha prevista, recordá que los tiempos de confeccion son aproximados.\n\n${operationInfo}${balanceInfo}`;

                            // Generar PDF del presupuesto/venta completo
                            let pdfMedia: any = null;
                            try {
                                const { generateOrderPDF } = await import('@/lib/order-pdf-generator');
                                const pdfResult = await generateOrderPDF(fullOrder, fullOrder.client);
                                pdfMedia = {
                                    base64: pdfResult.base64,
                                    mimetype: 'application/pdf',
                                    filename: pdfResult.filename
                                };
                                console.log('[Lab Status Notification] Order PDF generated successfully:', pdfResult.filename);
                            } catch (pdfErr) {
                                console.error('[Lab Status Notification] Failed to generate Order PDF:', pdfErr);
                            }

                            const formattedPhone = normalizeArgentinePhone(phone);

                            fetchWa('/api/send', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    chatId: `${formattedPhone}@c.us`,
                                    message: msg,
                                    senderName: 'Sistema Atelier',
                                    media: pdfMedia
                                })
                            }).then(async (res) => {
                                if (!res.ok) {
                                    throw new Error(`HTTP ${res.status}`);
                                }
                            }).catch(async (err) => {
                                console.error('[Lab Status] Error enviando WhatsApp:', err);
                                try {
                                    if (fullOrder && fullOrder.clientId) {
                                        await prisma.clientTask.create({
                                            data: {
                                                clientId: fullOrder.clientId,
                                                description: `⚠️ Falló el mensaje automático de laboratorio al cliente (${fullOrder.client?.name || ''}). Por favor, notificar manualmente.`,
                                                status: 'PENDING',
                                                type: 'TASK'
                                            }
                                        });
                                    }
                                } catch (dbErr) {
                                    console.error('Error creating fallback task for WhatsApp failure:', dbErr);
                                }
                            });

                            // Enviar copia al admin
                            fetchWa('/api/send', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    chatId: getAdminChatId(),
                                    message: `🏭 *[Pedido enviado a fábrica — Copia]*\n\n👤 *Cliente:* ${fullOrder.client?.name || ''}\n📋 *N° Operación:* ${labOrderNumber || fullOrder.labOrderNumber || 'Sin asignar'}\n\n${msg}`,
                                    senderName: 'Sistema Atelier',
                                    media: pdfMedia
                                })
                            }).catch(err => console.error('[Lab Status] Error enviando copia al admin:', err));
                        }
                    } catch (err: any) {
                        console.error('[Lab Status Notification Error]:', err.message);
                    }
                }
            }
        }
        if (prescriptionId !== undefined) data.prescriptionId = prescriptionId;

        // Frame data updates
        if (frameSource !== undefined) data.frameSource = frameSource;
        if (userFrameBrand !== undefined) data.userFrameBrand = userFrameBrand;
        if (userFrameModel !== undefined) data.userFrameModel = userFrameModel;
        if (userFrameNotes !== undefined) data.userFrameNotes = userFrameNotes;
        // Post-Sale status initialization and email notification check
        // Post-Sale status initialization and email notification check
        if (postSaleNotes !== undefined || postSaleCost !== undefined || postSaleResponsible !== undefined || postSaleOrderOption !== undefined || postSaleStatus !== undefined || postSaleRxData !== undefined || postSaleNewOrderNumber !== undefined || postSaleCaseType !== undefined || postSaleFault !== undefined || postSaleFaultUserId !== undefined || postSaleCoverage !== undefined || noteEntryText) {
            const currentOrderForPostSale = await prisma.order.findUnique({
                where: { id },
                select: {
                    postSaleCases: {
                        orderBy: { createdAt: 'desc' as const },
                        select: {
                            notes: true,
                            status: true,
                            cost: true,
                            costSource: true,
                        }
                    },
                    client: { select: { name: true, phone: true, email: true, dni: true, insurance: true, doctor: true } },
                    items: {
                        select: {
                            quantity: true,
                            productNameSnapshot: true,
                            productBrandSnapshot: true,
                            productCategorySnapshot: true,
                            laboratorySnapshot: true,
                            product: { select: { name: true, brand: true, laboratory: true } }
                        }
                    },
                    labOrderNumber: true,
                    createdAt: true,
                    total: true,
                    id: true,
                    clientId: true
                }
            });

            if (currentOrderForPostSale) {
                const activeCaseObj = currentOrderForPostSale.postSaleCases?.[0];
                const currentCaseStatus = activeCaseObj?.status;

                // Initialize postSaleStatus if not present
                let resolvedStatus = postSaleStatus;
                if (resolvedStatus === undefined) {
                    if ((postSaleNotes || postSaleOrderOption || (postSaleCost !== undefined && postSaleCost !== null) || postSaleResponsible) && !currentCaseStatus) {
                        resolvedStatus = 'SENT';
                    }
                }

                // ── Find or Create PostSaleCase ──
                let activeCase = await prisma.postSaleCase.findFirst({
                    where: { orderId: id },
                    orderBy: { createdAt: 'desc' as const }
                });

                if (!activeCase) {
                    // Snapshot del contexto de la venta: si la venta se borra, el caso
                    // conserva a qué cliente y a qué venta pertenecía.
                    const orderLabelSnapshot = [
                        `Venta #${currentOrderForPostSale.id.slice(-4).toUpperCase()}`,
                        currentOrderForPostSale.labOrderNumber ? `Pedido ${currentOrderForPostSale.labOrderNumber}` : null,
                        currentOrderForPostSale.total != null ? `$${Number(currentOrderForPostSale.total).toLocaleString('es-AR')}` : null
                    ].filter(Boolean).join(' · ');

                    const initialCost = postSaleCost !== undefined && postSaleCost !== null ? Number(postSaleCost) : 0.0;
                    activeCase = await prisma.postSaleCase.create({
                        data: {
                            orderId: id,
                            clientId: currentOrderForPostSale.clientId || null,
                            orderLabel: orderLabelSnapshot,
                            status: resolvedStatus || 'SENT',
                            cost: initialCost,
                            // Lo que carga el vendedor al abrir el caso es una
                            // ESTIMACIÓN: el costo real lo cierra el laboratorio
                            // (ver completePostSaleCost en services/lab-recon).
                            ...(initialCost > 0 ? { costSource: 'MANUAL', costEstimated: initialCost } : {}),
                            newOrderNumber: postSaleNewOrderNumber || null,
                            notes: stampedNoteEntry || postSaleNotes || null,
                            orderOption: postSaleOrderOption || null,
                            responsible: postSaleResponsible || null,
                            caseType: postSaleCaseType || null,
                            fault: postSaleFault || null,
                            // Quién de la óptica se equivocó, si la atribución es 'Óptica'.
                            faultUserId: postSaleFault === 'Óptica' ? (postSaleFaultUserId || null) : null,
                            coverage: postSaleCoverage || null,
                            rxData: postSaleRxData || null
                        }
                    });

                    // Observación inicial. Preferir la entry única (append server-side);
                    // si no, extraer del string reconstruido (camino legacy del tablero).
                    if (noteEntryText) {
                        await prisma.postSaleNote.create({
                            data: {
                                caseId: activeCase.id,
                                content: noteEntryText,
                                createdBy: userName || 'Sistema',
                                imageUrl: postSaleNoteImageUrl || null
                            }
                        });
                    } else if (postSaleNotes) {
                        const lines = postSaleNotes.split('\n').filter((line: string) => line.trim() !== '');
                        const lastLine = lines[lines.length - 1] || postSaleNotes;
                        const match = lastLine.match(/^\[(.*?)\]:\s*(.*)$/);
                        const noteContent = match ? match[2] : lastLine;

                        await prisma.postSaleNote.create({
                            data: {
                                caseId: activeCase.id,
                                content: noteContent,
                                // El autor es SIEMPRE el usuario logueado; "responsable" del caso es otro dato
                                createdBy: userName || 'Sistema',
                                imageUrl: postSaleNoteImageUrl || null
                            }
                        });
                    }

                    // Log initial status to history
                    await prisma.postSaleStatusHistory.create({
                        data: {
                            caseId: activeCase.id,
                            fromStatus: 'SENT',
                            toStatus: resolvedStatus || 'SENT',
                            changedBy: userName || 'Sistema'
                        }
                    });

                    // Notificación por email SIEMPRE que se registra un caso nuevo de post-venta,
                    // con la ficha completa del cliente, el pedido y el caso.
                    {
                        const adminEmail = process.env.ADMIN_EMAIL || 'Pisano.ishtar@gmail.com';
                        const clientName = currentOrderForPostSale.client?.name || 'Cliente';
                        const html = buildPostSaleCaseEmailHtml({
                            heading: '⚠️ Nuevo Caso de Post-Venta Registrado',
                            intro: `${userName || 'Sistema'} registró un nuevo caso de post-venta en el sistema con los siguientes detalles:`,
                            orderId: id,
                            order: currentOrderForPostSale,
                            caseInfo: {
                                caseType: postSaleCaseType || body.postSaleCaseType,
                                responsible: postSaleResponsible || body.postSaleResponsible,
                                fault: postSaleFault || body.postSaleFault,
                                coverage: postSaleCoverage || body.postSaleCoverage,
                                cost: postSaleCost ?? body.postSaleCost ?? 0,
                                orderOption: postSaleOrderOption || body.postSaleOrderOption,
                                newOrderNumber: postSaleNewOrderNumber || body.postSaleNewOrderNumber
                            },
                            notes: body.postSaleNotesEntry || postSaleNotes || 'Sin notas descriptivas'
                        });
                        sendEmail({
                            to: adminEmail,
                            subject: `⚠️ Nuevo caso de Post-Venta registrado - ${clientName}`,
                            html
                        }).catch(err => console.error('[Post-Sale Email Error]:', err));
                    }

                    // Check if it is an Optovision case to run IMAP billing audit
                    const isOptovision = currentOrderForPostSale.items?.some((item: any) =>
                        item.product?.laboratory?.toUpperCase().includes('OPTOVISION') ||
                        item.laboratorySnapshot?.toUpperCase().includes('OPTOVISION')
                    );

                    if (isOptovision && currentOrderForPostSale.labOrderNumber) {
                        OptovisionAuditService.checkOptovisionBillingAndAlert(
                            id,
                            currentOrderForPostSale.labOrderNumber
                        ).catch(err => console.error('[Optovision Audit Trigger Error]:', err));
                    }
                } else {
                    // Update existing active case
                    const caseData: any = {};
                    // Backfill del vínculo directo al cliente en casos viejos (blindaje).
                    if (!(activeCase as any).clientId && currentOrderForPostSale.clientId) {
                        caseData.clientId = currentOrderForPostSale.clientId;
                    }
                    if (resolvedStatus !== undefined) caseData.status = resolvedStatus;

                    // ── Cargar el nº de operación mueve el caso solo ─────────────
                    // Si el caso tiene número de operación, el laboratorio ya lo tomó:
                    // pedir que además alguien lo arrastre a "En laboratorio" es pedir
                    // un paso que el dato ya contestó, y es el paso que se olvida.
                    // Solo empuja hacia adelante desde el arranque; nunca retrocede un
                    // caso que ya está más avanzado.
                    const teniaOperacion = Boolean((activeCase.newOrderNumber || '').trim());
                    const tieneOperacion = Boolean((postSaleNewOrderNumber || '').trim());
                    const estadoActual = resolvedStatus ?? activeCase.status;
                    if (!teniaOperacion && tieneOperacion && (estadoActual === 'SENT' || estadoActual === 'PENDING' || !estadoActual)) {
                        caseData.status = 'IN_PROGRESS';
                        resolvedStatus = 'IN_PROGRESS';
                    }

                    // El costo ya imputado a caja es de solo lectura desde acá: tocarlo
                    // desataría un descuento y un número de caso que ya no coinciden.
                    // La corrección de un caso cerrado se hace revirtiendo la caja, no
                    // pisando el caso.
                    const yaImputado = !!(activeCase as any).cashEntryId;
                    if (yaImputado && (postSaleCost !== undefined || postSaleFault !== undefined || postSaleFaultUserId !== undefined)) {
                        throw new Error('Este caso ya fue imputado a caja: el costo y la atribución quedan de solo lectura. Para corregirlo, hay que revertir el movimiento de caja primero.');
                    }

                    let costOverrideNote: string | null = null;
                    if (postSaleCost !== undefined && postSaleCost !== null) {
                        const nuevoCosto = Number(postSaleCost);
                        if (nuevoCosto !== activeCase.cost) {
                            // Toda edición de costo desde este formulario es una
                            // ESTIMACIÓN del vendedor — el valor real lo cierra el
                            // laboratorio (completePostSaleCost). Si el caso ya tenía el
                            // costo real cerrado (costSource 'LAB', sin imputar todavía),
                            // esta edición lo reabre: se deja constancia en la nota para
                            // que no se pierda el rastro de que hubo un número cerrado.
                            if ((activeCase as any).costSource === 'LAB') {
                                costOverrideNote = `Costo cerrado por el laboratorio ($${Math.round(activeCase.cost).toLocaleString('es-AR')}) reemplazado a mano por $${Math.round(nuevoCosto).toLocaleString('es-AR')}. El cruce con el laboratorio lo puede volver a cerrar si corresponde.`;
                            }
                            caseData.cost = nuevoCosto;
                            caseData.costSource = 'MANUAL';
                            caseData.costEstimated = nuevoCosto;
                        }
                    }
                    if (postSaleNotes !== undefined) caseData.notes = postSaleNotes;
                    // Append server-side de la observación única (camino preferido): se
                    // suma al historial existente, sin depender del snapshot del cliente.
                    if (noteEntryText) {
                        caseData.notes = (activeCase.notes ? `${activeCase.notes}\n` : '') + stampedNoteEntry;
                    }
                    if (postSaleOrderOption !== undefined) caseData.orderOption = postSaleOrderOption;
                    if (postSaleResponsible !== undefined) caseData.responsible = postSaleResponsible;
                    if (postSaleCaseType !== undefined) caseData.caseType = postSaleCaseType;
                    if (postSaleFault !== undefined) caseData.fault = postSaleFault;
                    // La caja de destino solo tiene sentido cuando la atribución es
                    // 'Óptica'; cualquier otro valor de fault la limpia (si no, quedaría
                    // apuntando a una persona por un error que no fue de ella).
                    if (postSaleFault !== undefined || postSaleFaultUserId !== undefined) {
                        const faultResuelto = postSaleFault !== undefined ? postSaleFault : activeCase.fault;
                        caseData.faultUserId = faultResuelto === 'Óptica' ? (postSaleFaultUserId ?? (activeCase as any).faultUserId ?? null) : null;
                    }
                    if (postSaleCoverage !== undefined) caseData.coverage = postSaleCoverage;
                    if (postSaleRxData !== undefined) caseData.rxData = postSaleRxData;
                    if (postSaleNewOrderNumber !== undefined) caseData.newOrderNumber = postSaleNewOrderNumber;

                    const oldStatus = activeCase.status;
                    const updatedCase = await prisma.postSaleCase.update({
                        where: { id: activeCase.id },
                        data: caseData
                    });
                    if (costOverrideNote) {
                        await prisma.postSaleNote.create({
                            data: { caseId: activeCase.id, content: costOverrideNote, createdBy: 'Sistema' },
                        });
                    }

                    // Log status transition if changed
                    if (resolvedStatus !== undefined && resolvedStatus !== oldStatus) {
                        await prisma.postSaleStatusHistory.create({
                            data: {
                                caseId: activeCase.id,
                                fromStatus: oldStatus,
                                toStatus: resolvedStatus,
                                changedBy: userName || 'Sistema'
                            }
                        });
                    }

                    // Extract and create new note entry if notes were updated/appended
                    let appendedNoteText = '';
                    if (noteEntryText) {
                        // Camino preferido: UNA sola observación, sin riesgo de duplicar.
                        appendedNoteText = noteEntryText;
                        await prisma.postSaleNote.create({
                            data: {
                                caseId: activeCase.id,
                                content: noteEntryText,
                                createdBy: userName || 'Sistema',
                                imageUrl: postSaleNoteImageUrl || null
                            }
                        });
                    } else if (postSaleNotes !== undefined && postSaleNotes !== activeCase.notes) {
                        const oldNotes = activeCase.notes || '';
                        let newAppendedNotes = postSaleNotes;
                        if (postSaleNotes.startsWith(oldNotes)) {
                            newAppendedNotes = postSaleNotes.slice(oldNotes.length).trim();
                        }
                        if (newAppendedNotes) {
                            appendedNoteText = newAppendedNotes;
                            const lines = newAppendedNotes.split('\n').filter((line: string) => line.trim() !== '');
                            for (const [i, line] of lines.entries()) {
                                const match = line.match(/^\[(.*?)\]:\s*(.*)$/);
                                const noteContent = match ? match[2] : line;

                                await prisma.postSaleNote.create({
                                    data: {
                                        caseId: activeCase.id,
                                        content: noteContent,
                                        // El autor es SIEMPRE el usuario logueado; "responsable" del caso es otro dato
                                        createdBy: userName || 'Sistema',
                                        // La imagen adjunta va en la última observación del lote (la recién escrita)
                                        imageUrl: i === lines.length - 1 ? (postSaleNoteImageUrl || null) : null
                                    }
                                });
                            }
                        }
                    }

                    // Email de actualización cuando cambia algo relevante del caso
                    // (n° de operación, tipo, costo, cobertura, notas nuevas, etc.).
                    // Mover la tarjeta de columna en el tablero (solo status) NO avisa.
                    const fmtVal = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v));
                    const changes: string[] = [];
                    if (postSaleNewOrderNumber !== undefined && (postSaleNewOrderNumber || null) !== (activeCase.newOrderNumber || null)) {
                        changes.push(`<b>N° de operación / nuevo pedido:</b> ${fmtVal(activeCase.newOrderNumber)} → ${fmtVal(postSaleNewOrderNumber)}`);
                    }
                    if (postSaleCaseType !== undefined && (postSaleCaseType || null) !== (activeCase.caseType || null)) {
                        changes.push(`<b>Tipo de caso:</b> ${fmtVal(activeCase.caseType)} → ${fmtVal(postSaleCaseType)}`);
                    }
                    if (postSaleResponsible !== undefined && (postSaleResponsible || null) !== (activeCase.responsible || null)) {
                        changes.push(`<b>Responsable:</b> ${fmtVal(activeCase.responsible)} → ${fmtVal(postSaleResponsible)}`);
                    }
                    if (postSaleFault !== undefined && (postSaleFault || null) !== (activeCase.fault || null)) {
                        changes.push(`<b>Culpa / origen:</b> ${fmtVal(activeCase.fault)} → ${fmtVal(postSaleFault)}`);
                    }
                    if (postSaleCoverage !== undefined && (postSaleCoverage || null) !== (activeCase.coverage || null)) {
                        changes.push(`<b>Cobertura:</b> ${fmtVal(activeCase.coverage)} → ${fmtVal(postSaleCoverage)}`);
                    }
                    if (postSaleOrderOption !== undefined && (postSaleOrderOption || null) !== (activeCase.orderOption || null)) {
                        changes.push(`<b>Opción en Lab:</b> ${fmtVal(activeCase.orderOption)} → ${fmtVal(postSaleOrderOption)}`);
                    }
                    if (postSaleCost !== undefined && postSaleCost !== null && Number(postSaleCost) !== activeCase.cost) {
                        changes.push(`<b>Costo adicional:</b> $${activeCase.cost} → $${Number(postSaleCost)}`);
                    }

                    // Los cambios de campos también quedan EN EL CASO, no solo en el
                    // email: si mañana alguien reemplaza el responsable o el costo,
                    // en la ficha se ve qué había antes y quién lo cambió.
                    if (changes.length > 0) {
                        const enTexto = changes.map(c => c.replace(/<\/?b>/g, '')).join(' · ');
                        await prisma.postSaleNote.create({
                            data: {
                                caseId: activeCase.id,
                                content: `Actualización del caso — ${enTexto}`,
                                createdBy: userName || 'Sistema',
                            },
                        });
                    }

                    if (changes.length > 0 || appendedNoteText) {
                        const adminEmail = process.env.ADMIN_EMAIL || 'Pisano.ishtar@gmail.com';
                        const clientName = currentOrderForPostSale.client?.name || 'Cliente';
                        const html = buildPostSaleCaseEmailHtml({
                            heading: '🔄 Caso de Post-Venta Actualizado',
                            intro: 'Se actualizó el caso de post-venta de este pedido.',
                            orderId: id,
                            order: currentOrderForPostSale,
                            caseInfo: updatedCase,
                            changes,
                            notes: appendedNoteText || null,
                            notesLabel: 'Nueva nota agregada'
                        });
                        sendEmail({
                            to: adminEmail,
                            subject: `🔄 Caso de Post-Venta actualizado - ${clientName}`,
                            html
                        }).catch(err => console.error('[Post-Sale Update Email Error]:', err));
                    }
                }
            }
        }


        // SmartLab lab fields
        if (labColor !== undefined) data.labColor = labColor;
        if (labTreatment !== undefined) data.labTreatment = labTreatment;
        if (labDiameter !== undefined) data.labDiameter = labDiameter;
        if (labPdOd !== undefined) {
            if (labPdOd === null || labPdOd === '') {
                data.labPdOd = null;
            } else {
                const parsed = parseFloat(String(labPdOd));
                data.labPdOd = isNaN(parsed) ? null : parsed;
            }
        }
        if (labPdOi !== undefined) {
            if (labPdOi === null || labPdOi === '') {
                data.labPdOi = null;
            } else {
                const parsed = parseFloat(String(labPdOi));
                data.labPdOi = isNaN(parsed) ? null : parsed;
            }
        }
        if (body.labFrameShape !== undefined) data.labFrameShape = body.labFrameShape;
        if (body.labFrameDetails !== undefined) data.labFrameDetails = body.labFrameDetails;

        // Frame measurement fields (for SmartLab)
        if (frameA !== undefined) data.frameA = frameA;
        if (frameB !== undefined) data.frameB = frameB;
        if (frameDbl !== undefined) data.frameDbl = frameDbl;
        if (frameEdc !== undefined) data.frameEdc = frameEdc;
        if (frameA2 !== undefined) data.frameA2 = frameA2;
        if (frameB2 !== undefined) data.frameB2 = frameB2;
        if (frameDbl2 !== undefined) data.frameDbl2 = frameDbl2;
        if (frameEdc2 !== undefined) data.frameEdc2 = frameEdc2;
        if (labFrameShape2 !== undefined) data.labFrameShape2 = labFrameShape2;
        if (labFrameDetails2 !== undefined) data.labFrameDetails2 = labFrameDetails2;

        // Fotos del armazón. OJO: estos campos estaban en la lista blanca del
        // candado pero NUNCA se copiaban a `data` — la pantalla los mandaba y
        // el service los tiraba en silencio. El zod es passthrough, así que un
        // campo sin mapeo explícito simplemente no se guarda.
        if (body.frameImageUrl !== undefined) data.frameImageUrl = body.frameImageUrl;
        if (body.frameImageUrl2 !== undefined) data.frameImageUrl2 = body.frameImageUrl2;

        // Altura pupilar POR ARMAZÓN: varía según el armazón elegido (se toma
        // con el armazón puesto), así que en un 2x1 cada par lleva la suya.
        // Mismo parseo numérico tolerante que labPdOd (la pantalla manda strings).
        const numerico = (v: unknown) => {
            if (v === null || v === '' || v === undefined) return null;
            const n = parseFloat(String(v));
            return isNaN(n) ? null : n;
        };
        if (body.labHeightOD !== undefined) data.labHeightOD = numerico(body.labHeightOD);
        if (body.labHeightOI !== undefined) data.labHeightOI = numerico(body.labHeightOI);
        if (body.labHeightOD2 !== undefined) data.labHeightOD2 = numerico(body.labHeightOD2);
        if (body.labHeightOI2 !== undefined) data.labHeightOI2 = numerico(body.labHeightOI2);
        if (smartLabScreenshot !== undefined) data.smartLabScreenshot = smartLabScreenshot;

        // High-precision lab fields
        if (labPrismOD !== undefined) data.labPrismOD = labPrismOD;
        if (labPrismOI !== undefined) data.labPrismOI = labPrismOI;
        if (labBaseCurve !== undefined) data.labBaseCurve = labBaseCurve;
        if (labFrameType !== undefined) data.labFrameType = labFrameType;
        if (labBevelPosition !== undefined) data.labBevelPosition = labBevelPosition;

        let existingOrder: any = null;
        if (orderType) {
            // Prevent reverting a SALE back to QUOTE
            if (orderType === 'QUOTE') {
                const current = await prisma.order.findUnique({ 
                    where: { id },
                    select: { orderType: true }
                });
                if (current?.orderType === 'SALE') {
                    throw new Error('No se puede revertir una venta a presupuesto');
                }
            }
            // Validation: when converting QUOTE → SALE
            if (orderType === 'SALE') {
                existingOrder = await prisma.order.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        total: true,
                        paid: true,
                        orderType: true,
                        authorizedByAdmin: true,
                        prescriptionId: true,
                        frameSource: true,
                        userFrameBrand: true,
                        userFrameModel: true,
                        frameImageUrl: true,
                        frameImageUrl2: true,
                        appliedPromoName: true,
                        client: true,
                        items: {
                            select: {
                                product: { select: { type: true, category: true, brand: true, model: true, name: true, stock: true } },
                                quantity: true,
                                eye: true
                            }
                        },
                        payments: true,
                        prescription: {
                            select: {
                                imageUrl: true,
                                heightOD: true,
                                heightOI: true,
                                distanceOD: true,
                                distanceOI: true,
                                pd: true,
                            }
                        }
                    },
                });

                if (!existingOrder) {
                    throw new Error('Pedido no encontrado');
                }

                if (existingOrder.orderType === 'SALE') {
                    throw new Error('Esta operación ya fue confirmada como venta anteriormente.');
                }

                // Check: la ficha del cliente debe estar completa para poder vender.
                // Estos datos son obligatorios para facturación (DNI/dirección), CAPI
                // (email) y fabricación (fecha de nacimiento).
                const client = existingOrder.client;
                const missingClientFields: string[] = [];
                if (!client?.name?.trim()) missingClientFields.push('nombre');
                if (!client?.phone?.trim()) missingClientFields.push('teléfono');
                if (!client?.email?.trim()) missingClientFields.push('email');
                if (!client?.birthDate) missingClientFields.push('fecha de nacimiento');
                if (!client?.dni?.trim()) missingClientFields.push('DNI');
                if (!client?.address?.trim()) missingClientFields.push('dirección');
                if (missingClientFields.length > 0) {
                    throw new Error(`La ficha del contacto debe tener ${missingClientFields.join(', ')} para generar la venta.`);
                }

                // Check: 50% minimum payment
                const minRequired = (existingOrder.total || 0) * 0.5;
                const totalPaid = existingOrder.paid || 0;
                if (totalPaid < minRequired && !existingOrder.authorizedByAdmin) {
                    throw new Error(`Se requiere un pago mínimo del 50% ($${Math.ceil(minRequired).toLocaleString()}) para convertir en venta. Pagado: $${totalPaid.toLocaleString()}`);
                }

                // Check: if order has crystals, frame info must be set
                const hasCrystals = existingOrder.items?.some((item: any) =>
                    item.product?.type === 'Cristal' || item.product?.category === 'Cristal' || (item.product?.name || '').includes('Cristal')
                );

                const effectiveRxId = prescriptionId || existingOrder.prescriptionId;

                if (hasCrystals && !effectiveRxId) {
                    throw new Error('Si el pedido incluye cristales, debe tener una receta seleccionada');
                }

                // ── Crystal prescription completeness: Height + DP + Image ──
                if (hasCrystals && effectiveRxId) {
                    // If prescriptionId is being changed now, fetch the new one; otherwise use existing
                    const rx = prescriptionId && prescriptionId !== existingOrder.prescriptionId
                        ? await prisma.prescription.findUnique({
                            where: { id: prescriptionId },
                            select: { imageUrl: true, heightOD: true, heightOI: true, distanceOD: true, distanceOI: true, pd: true }
                          })
                        : existingOrder.prescription;

                    if (rx) {
                        const saleErrors: string[] = [];
                        if (!rx.imageUrl) {
                            saleErrors.push('Falta la foto de la receta adjunta.');
                        }
                        // Alturas obligatorias para TODO pedido con cristales, por cada
                        // ojo que lleva cristal (los cristales por ojo tienen item.eye).
                        const crystalEyes = new Set(
                            (existingOrder.items || [])
                                .filter((item: any) =>
                                    item.product?.type === 'Cristal' ||
                                    item.product?.category === 'Cristal' ||
                                    (item.product?.name || '').includes('Cristal'))
                                .map((item: any) => item.eye)
                                .filter(Boolean)
                        );
                        const needsHeightOD = crystalEyes.has('OD') || crystalEyes.size === 0;
                        const needsHeightOI = crystalEyes.has('OI') || crystalEyes.size === 0;
                        if (needsHeightOD && rx.heightOD == null) {
                            saleErrors.push('Falta cargar la Altura del OD en la receta.');
                        }
                        if (needsHeightOI && rx.heightOI == null) {
                            saleErrors.push('Falta cargar la Altura del OI en la receta.');
                        }
                        const hasDP = rx.distanceOD != null || rx.distanceOI != null || rx.pd != null;
                        if (!hasDP) {
                            saleErrors.push('Falta cargar la Distancia Pupilar (DP) en la receta.');
                        }
                        if (saleErrors.length > 0) {
                            throw new Error(`No se puede convertir en venta:\n${saleErrors.join('\n')}`);
                        }
                    }
                }

                const hasFramesInCart = existingOrder.items?.some((item: any) => {
                    const cat = (item.product?.category || '').toLowerCase();
                    return cat === 'frame' || cat === 'atelier' || cat === 'armazón de receta' || cat.includes('armazon') || cat.includes('armazón');
                });

                const effectiveFrameSource = frameSource || existingOrder.frameSource || (hasFramesInCart ? 'OPTICA' : null);
                if (hasCrystals && !effectiveFrameSource) {
                    throw new Error('Si el pedido incluye cristales, debe seleccionar un armazón (de la óptica o del usuario)');
                }
                if (hasCrystals && effectiveFrameSource === 'USUARIO') {
                    const effBrand = userFrameBrand || existingOrder.userFrameBrand;
                    const effModel = userFrameModel || existingOrder.userFrameModel;
                    if (!effBrand && !effModel) {
                        throw new Error('Debe completar al menos la marca o modelo del armazón del usuario');
                    }
                }

                // Check: la foto de CADA armazón es obligatoria.
                //
                // Es lo que el cliente mira en la confirmación para reconocer lo que
                // se lleva, y lo único que después prueba qué se le vendió cuando
                // aparece un "yo elegí otro". Cuántos armazones son lo dicen los
                // PARES DE CRISTALES: cuatro pares son cuatro anteojos, cada uno con
                // su foto. Se exige con el mismo alcance que las medidas (pedido con
                // cristales y armazón), así una venta de solo cristales no queda trabada.
                if (hasCrystals && effectiveFrameSource) {
                    const conFrames = await prisma.order.findUnique({
                        where: { id },
                        select: {
                            appliedPromoName: true,
                            frames: { select: { position: true, imageUrl: true } },
                            items: { select: { eye: true, quantity: true, productNameSnapshot: true, productCategorySnapshot: true, productTypeSnapshot: true, product: { select: { name: true, category: true, type: true } } } },
                            labFrameShape: true, frameA: true, frameB: true, frameDbl: true, frameEdc: true,
                            labFrameDetails: true, frameImageUrl: true, labHeightOD: true, labHeightOI: true,
                            labFrameShape2: true, frameA2: true, frameB2: true, frameDbl2: true, frameEdc2: true,
                            labFrameDetails2: true, frameImageUrl2: true, labHeightOD2: true, labHeightOI2: true,
                        },
                    });
                    const armazones = framesDeLaOrden(conFrames as any);
                    const sinFoto = armazones.filter(f => !f.imageUrl);
                    if (sinFoto.length > 0) {
                        const cuales = armazones.length === 1
                            ? 'la foto del armazón'
                            : sinFoto.map(f => `la foto del ${f.position}º armazón`).join(' y ');
                        throw new Error(`No se puede convertir en venta: falta ${cuales}. La saca el vendedor y viaja en la confirmación que recibe el cliente.`);
                    }
                }

                // Check: stock availability for non-crystal products
                const stockItems = (existingOrder.items || []).filter((item: any) => {
                    const cat = item.product?.category;
                    const type = item.product?.type;
                    const isCrystalOrTreatment = cat === 'Cristal' || cat === 'Tratamiento' || cat === 'TRATAMIENTO' || (type || '').includes('Cristal');
                    return !isCrystalOrTreatment;
                });
                const insufficientStock: string[] = [];
                for (const item of stockItems) {
                    const product = item.product;
                    if (product && product.stock < item.quantity) {
                        const name = `${product.brand || ''} ${product.name || ''}`.trim();
                        insufficientStock.push(`${name}: stock ${product.stock}, necesitás ${item.quantity}`);
                    } else if (!product) {
                        // If product is missing, we treat it as an error or just skip? 
                        // Usually it shouldn't happen during conversion if it was valid before.
                    }
                }
                if (insufficientStock.length > 0) {
                    throw new Error(`Stock insuficiente:\n${insufficientStock.join('\n')}`);
                }
            }

            data.orderType = orderType;
            // When converting to SALE, automatically send to lab and lock it
            if (orderType === 'SALE') {
                data.isLocked = true;
                if (!labStatus) {
                    data.labStatus = 'SENT';
                    data.labSentAt = new Date();
                }
                // Vendedor de una venta = quien la envió a fábrica (regla del
                // negocio). Hasta hoy quedaban en null y el dueño de la venta
                // era indeterminable.
                data.labSentBy = userName || null;
                data.labSentById = userId || null;

                // ── SNAPSHOT INMUTABLE de la receta (12/8/2026) ──────────────
                // La venta mostraba la receta VIVA por referencia: editarla desde
                // la ficha cambiaba retroactivamente una venta ya enviada, sin
                // rastro. Acá se congela COMPLETA (todos los campos + la foto)
                // en el momento exacto del envío a fábrica. La pantalla de la
                // venta lee esto; la relación viva queda solo como linaje.
                const rxIdFinal = prescriptionId ?? existingOrder?.prescriptionId;
                if (rxIdFinal) {
                    const rxCompleta = await prisma.prescription.findUnique({ where: { id: rxIdFinal } });
                    if (rxCompleta) {
                        data.prescriptionSnapshot = JSON.stringify({
                            v: 1,
                            frozenAt: new Date().toISOString(),
                            frozenBy: userName || 'Sistema',
                            rx: rxCompleta,
                        });
                    }
                }
            }

            // Stock decrement: when converting to SALE, atomically decrement stock
            if (orderType === 'SALE') {
                const orderForStock = await prisma.order.findUnique({
                    where: { id },
                    select: {
                        items: {
                            select: {
                                productId: true,
                                quantity: true,
                                product: { select: { category: true, type: true, stock: true } }
                            }
                        }
                    }
                });
                const stockItems = (orderForStock?.items || []).filter((item: any) => {
                    const cat = item.product?.category;
                    const type = item.product?.type;
                    return !(cat === 'Cristal' || cat === 'Tratamiento' || cat === 'TRATAMIENTO' || (type || '').includes('Cristal'));
                });

                const stockUpdates = stockItems
                    .filter((item: any) => item.productId)
                    .map((item: any) =>
                    prisma.product.update({
                        where: { id: item.productId, stock: { gte: item.quantity } },
                        data: { stock: { decrement: item.quantity } },
                    })
                );

                const updatedOrder = await prisma.$transaction(async (tx) => {
                    // 1. Decrement stock
                    for (const item of stockItems) {
                        if (!item.productId) continue;
                        await tx.product.update({
                            where: { id: item.productId, stock: { gte: item.quantity } },
                            data: { stock: { decrement: item.quantity } },
                        });
                    }

                    // 2. Update client
                    await tx.client.update({
                        where: { id: existingOrder.client.id },
                        data: { status: 'CLIENT', isFavorite: false }
                    });

                    // 2.5 Al convertirse la venta, el cliente sale SOLO de todo lo
                    // automático (regla del negocio, 12/8/2026: "deben salirse en
                    // cuanto el pedido se convierte en venta; solo queda lo que el
                    // vendedor registró de forma específica"). Se borran las tareas
                    // pendientes que generó el sistema —extractor pasivo, tiers de
                    // seguimiento del bot— y las etiquetas SEGUIMIENTO_* de sus
                    // chats, que son las que alimentan los seguimientos automáticos.
                    // Las tareas creadas a mano por un vendedor NO se tocan.
                    const purgaTareas = await tx.clientTask.deleteMany({
                        where: {
                            clientId: existingOrder.client.id,
                            status: 'PENDING',
                            OR: [
                                { type: 'FOLLOWUP' },
                                { createdBy: { startsWith: 'Sistema' } },
                                { createdBy: 'Bot' },
                            ],
                        },
                    });
                    const chatsDelCliente = await tx.whatsAppChat.findMany({
                        where: { clientId: existingOrder.client.id },
                        select: { id: true, chatLabels: true },
                    });
                    for (const c of chatsDelCliente) {
                        const limpio = (c.chatLabels || []).filter((l: string) => !l.startsWith('SEGUIMIENTO_'));
                        if (limpio.length !== (c.chatLabels || []).length) {
                            await tx.whatsAppChat.update({
                                where: { id: c.id },
                                data: { chatLabels: limpio, followUpPausedUntil: null },
                            });
                        }
                    }
                    if (purgaTareas.count > 0) {
                        console.log(`[Venta] Purga de automatismos del cliente ${existingOrder.client.id}: ${purgaTareas.count} tareas del sistema eliminadas.`);
                        // Borrado destructivo → auditoría esperada (regla del
                        // proyecto). logAudit nunca lanza, así que no puede
                        // voltear la venta.
                        await logAudit({
                            userId,
                            userName,
                            action: 'DELETE',
                            entityType: 'TASK',
                            entityId: existingOrder.client.id,
                            details: {
                                motivo: 'Conversión a venta: purga de tareas automáticas y etiquetas de seguimiento',
                                orderId: id,
                                tareasEliminadas: purgaTareas.count,
                            }
                        });
                    }

                    // 3. Update order
                    const ord = await tx.order.update({
                        where: { id },
                        data,
                        select: {
                            id: true,
                            total: true,
                            paid: true,
                            createdAt: true,
                            updatedAt: true,
                            // El repaso completo del armazón (los dos pares del 2x1,
                            // teñido y notas de laboratorio) y la receta congelada:
                            // sin estos campos la nota del historial y la
                            // confirmación al cliente salían a medias.
                            orderType: true,
                            isLocked: true,
                            labSentBy: true,
                            labSentAt: true,
                            labStatus: true,
                            labColor: true,
                            labTreatment: true,
                            labNotes: true,
                            labFrameShape: true,
                            labFrameDetails: true,
                            frameA: true, frameB: true, frameDbl: true, frameEdc: true,
                            labFrameShape2: true,
                            labFrameDetails2: true,
                            frameA2: true, frameB2: true, frameDbl2: true, frameEdc2: true,
                            frameImageUrl: true, frameImageUrl2: true,
                            labHeightOD: true, labHeightOI: true,
                            labHeightOD2: true, labHeightOI2: true,
                            frames: { orderBy: { position: 'asc' as const } },
                            frameSource: true,
                            userFrameBrand: true,
                            userFrameModel: true,
                            userFrameNotes: true,
                            appliedPromoName: true,
                            prescriptionSnapshot: true,
                            client: {
                                select: { id: true, name: true, email: true, phone: true }
                            },
                            items: {
                                select: {
                                    id: true, price: true, quantity: true, eye: true,
                                    sphereVal: true, cylinderVal: true, axisVal: true, additionVal: true, pdVal: true, heightVal: true, prismVal: true,
                                    productNameSnapshot: true, productCategorySnapshot: true, productTypeSnapshot: true,
                                    product: { select: { id: true, name: true, brand: true, model: true, category: true, type: true, price: true, stock: true, imagenesCatalogo: true } }
                                }
                            },
                            payments: true,
                            prescription: true,
                            postSaleCases: {
                                orderBy: { createdAt: 'desc' as const },
                                select: {
                                    id: true,
                                    status: true,
                                    cost: true,
                                    newOrderNumber: true,
                                    notes: true,
                                    orderOption: true,
                                    responsible: true,
                                    rxData: true,
                                    createdAt: true
                                }
                            },
                        },
                    });

                    // 4. Update crystal order items prescription details
                    if (ord.prescription) {
                        const rx = ord.prescription;
                        const crystalItems = ord.items.filter((item: any) => {
                            const cat = item.product?.category;
                            const type = item.product?.type;
                            return cat === 'Cristal' || (type || '').includes('Cristal');
                        });

                        for (const item of crystalItems) {
                            const isOD = item.eye === 'OD';
                            const isOI = item.eye === 'OI';
                            if (!isOD && !isOI) continue;
                            await tx.orderItem.update({
                                where: { id: item.id },
                                data: {
                                    sphereVal: isOD ? rx.sphereOD : rx.sphereOI,
                                    cylinderVal: isOD ? rx.cylinderOD : rx.cylinderOI,
                                    axisVal: isOD ? rx.axisOD : rx.axisOI,
                                    additionVal: isOD ? (rx.additionOD ?? rx.addition) : (rx.additionOI ?? rx.addition),
                                },
                            });
                        }
                    }

                    return ord;
                }, { maxWait: 25000, timeout: 25000 });

                // Aviso de stock bajo: armazones (sol/receta/clip-on) que quedaron en su
                // última unidad tras confirmar la venta. Fire-and-forget, no rompe la venta.
                notifyLowStockCrossing(
                    stockItems.map((it: any) => ({
                        productId: it.productId,
                        prevStock: it.product?.stock ?? 0,
                        quantity: it.quantity,
                    }))
                ).catch(err => console.error('Error en alerta de stock bajo (venta CRM):', err));

                // Red de seguridad de costos: si alguna línea quedó con costo $0 y
                // precio > 0, avisa al admin. Fire-and-forget, no frena la venta.
                notifyZeroCostSale(updatedOrder.id)
                    .catch(err => console.error('Error en alerta de costo $0 (venta CRM):', err));

                // Enviar conversión offline a Meta/Google de forma asíncrona (fire and forget)
                AdsService.sendOfflineConversion(updatedOrder as any).catch(err => {
                    console.error('Error al notificar conversión offline:', err);
                });

                // Lo mismo hacia Google Ads. Va aparte porque son dos APIs
                // distintas: el comentario de arriba decía "Meta/Google" pero
                // sólo se le avisaba a Meta, así que Google pujaba sin saber
                // nunca qué clic terminaba en venta.
                //
                // El gclid se busca ANTES de mandar: sin identificador de clic
                // Google no puede atribuirle la venta al anuncio que la trajo, y
                // la conversión se sube sin servir para pujar. Vive en
                // `AnalyticsEvent` (lo guarda el tracker de la tienda), no en la
                // orden, por eso hay que ir a buscarlo. Todo el bloque sigue
                // siendo fire-and-forget: medir no puede frenar ni romper la venta.
                GoogleAdsService.findClickIds(updatedOrder.id)
                    .then(clickIds => {
                        GoogleAdsService.sendOfflineConversion({
                            orderId: updatedOrder.id,
                            value: updatedOrder.total ?? 0,
                            occurredAt: updatedOrder.createdAt ?? new Date(),
                            client: {
                                email: updatedOrder.client?.email,
                                phone: updatedOrder.client?.phone,
                            },
                            ...clickIds,
                        });
                    })
                    .catch(err => console.error('Error al resolver el clic de Google para la conversión offline:', err));

                // Enviar vCard por WhatsApp (Sincronización de Contacto)
                if (updatedOrder.client) {
                    GoogleContactsService.syncClient({
                        name: updatedOrder.client.name,
                        phone: updatedOrder.client.phone,
                        email: updatedOrder.client.email
                    }).catch(err => console.error('Error syncClient:', err));
                }

                // Registrar conversión a VENTA en el historial del cliente — con el vendedor que confirmó
                const saleSummaries = formatOrderItemsSummary(updatedOrder.items);
                const confirmedBy = userName || 'Sistema';
                // La nota lleva el repaso ENTERO, no un resumen: es el registro al
                // que se recurre "ante cualquier eventualidad", y tiene que decir
                // quién la envió a fábrica, a qué hora y exactamente qué se fabrica.
                // La foto de la receta va en la interacción misma (imageUrl).
                const recetaCongeladaTx = (() => {
                    try { return updatedOrder.prescriptionSnapshot ? JSON.parse(updatedOrder.prescriptionSnapshot)?.rx : null; } catch { return null; }
                })();
                const rxParaNota = recetaCongeladaTx || updatedOrder.prescription;
                const enviadaEl = updatedOrder.labSentAt ? formatDateTime(updatedOrder.labSentAt) : null;

                // Resumen de una línea arriba y el repaso completo detrás del
                // separador: la ficha lo muestra colapsado, así el historial sigue
                // siendo escaneable y el detalle está a un clic.
                const historyContent = [
                    `🛒 ${confirmedBy} confirmó el presupuesto #${updatedOrder.id.slice(-4).toUpperCase()} como VENTA por $${(updatedOrder.total || 0).toLocaleString('es-AR')}`,
                    `Enviada a fábrica por: ${updatedOrder.labSentBy || confirmedBy}${enviadaEl ? ` — ${enviadaEl}` : ''}`,
                ].join('\n') + DETALLE_MARK + [
                    `Abonado: $${(updatedOrder.paid || 0).toLocaleString('es-AR')} · Saldo: $${Math.max(0, (updatedOrder.total || 0) - (updatedOrder.paid || 0)).toLocaleString('es-AR')}`,
                    ``,
                    `Productos:`,
                    `• ${saleSummaries}`,
                    ``,
                    `— ARMAZÓN Y TEÑIDO —`,
                    frameRecapText(updatedOrder as any),
                    ``,
                    `— RECETA (congelada al enviar a fábrica) —`,
                    prescriptionRecapText(rxParaNota as any),
                ].join('\n');

                await prisma.interaction.create({
                    data: {
                        clientId: existingOrder.client.id,
                        type: 'SALE_CONFIRMED',
                        content: historyContent,
                        imageUrl: (rxParaNota as any)?.imageUrl || null,
                        userId: userId || null,
                        userName: confirmedBy,
                    },
                }).catch(err => console.error('Error al registrar interacción de venta:', err));

                // La confirmación de venta es la mutación más importante del negocio:
                // queda SIEMPRE en AuditLog (el early return de esta rama salteaba el log genérico).
                logAudit({
                    userId: userId || null,
                    userName: confirmedBy,
                    action: 'STATUS_CHANGE',
                    entityType: 'ORDER',
                    entityId: updatedOrder.id,
                    details: { from: 'QUOTE', to: 'SALE', total: updatedOrder.total, paid: updatedOrder.paid }
                }).catch(err => console.error('Error logging audit for sale confirmation:', err));

                // Confirmación de compra al cliente (mail + WhatsApp + PDF). Es el
                // momento previo a que la fábrica empiece: si un dato está mal, este
                // mensaje es la única chance de detectarlo a tiempo.
                // Fire-and-forget a propósito — la venta ya está hecha; un aviso que
                // falla no puede voltearla (y si fallan los dos canales, la propia
                // función deja una tarea para mandarla a mano).
                sendSaleConfirmation(updatedOrder.id, { version: 1 })
                    .catch(err => console.error('Error enviando la confirmación de compra:', err));

                // Enviar mensaje al grupo de ventas
                try {
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
                    const link = `${appUrl}/admin/contactos?id=${existingOrder.client.id}`;
                    
                    const groupMessage = `🎉 *NUEVA VENTA CONFIRMADA* 🎉\n` +
                        `👤 *Cliente:* ${existingOrder.client.name}\n` +
                        `🧑 *Confirmada por:* ${confirmedBy}\n` +
                        `💵 *Total:* $${(updatedOrder.total || 0).toLocaleString('es-AR')}\n` +
                        `💳 *Abonado:* $${(updatedOrder.paid || 0).toLocaleString('es-AR')}\n` +
                        `Detalle:\n• ${saleSummaries}\n` +
                        `🔗 *Ficha:* ${link}`;

                    fetchWa('/api/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chatId: process.env.WHATSAPP_SALES_GROUP_ID || '120363321589178129@g.us', // Requiere el ID real en .env
                            message: groupMessage,
                            senderName: 'Sistema Atelier'
                        }),
                    }).catch(err => console.error('[Sales Notification] Error sending WhatsApp:', err));
                } catch (e) {
                    console.error('Error al preparar mensaje de venta al grupo WhatsApp:', e);
                }

                return updatedOrder;
            }
        }

        // Estado previo para historizar transiciones (quién cambió qué estado)
        let prevState: {
            labStatus: string | null;
            status: string;
            labOrderNumber: string | null;
            trackingNumber: string | null;
            shippedAt: Date | null;
            dispatchNotifiedAt: Date | null;
        } | null = null;
        if (data.labStatus !== undefined || data.status !== undefined || data.labOrderNumber !== undefined
            || data.trackingNumber !== undefined || markDispatched) {
            prevState = await prisma.order.findUnique({
                where: { id },
                select: {
                    labStatus: true, status: true, labOrderNumber: true,
                    trackingNumber: true, shippedAt: true, dispatchNotifiedAt: true
                }
            });
        }

        // ── Despacho: cuándo se considera que el pedido SALIÓ ──
        // Sale cuando se le carga el número de seguimiento por primera vez, o
        // cuando se lo marca despachado a mano (envíos sin código). `shippedAt`
        // se estampa una sola vez: corregir después el número del correo no
        // puede mover la fecha de salida, que es la que sostiene el plazo de
        // entrega que le prometimos al cliente.
        const trackingEntrante = (data.trackingNumber ?? '').toString().trim();
        const trackingPrevio = (prevState?.trackingNumber || '').trim();
        const seDespachaAhora = !!prevState
            && !prevState.shippedAt
            && ((!!trackingEntrante && trackingEntrante !== trackingPrevio) || !!markDispatched);
        if (seDespachaAhora) {
            data.shippedAt = new Date();
        }

        // BLOQUEO: el nº de operación no se puede repetir. Es la llave con la que
        // se cruza la factura del laboratorio contra la venta; el mismo número en
        // dos ventas deja el costo colgado de la equivocada. El aviso en vivo del
        // formulario avisa antes, pero el que decide es este guard: el bot, el
        // copiloto y cualquier otro camino de escritura pasan por acá.
        //
        // Solo se controla cuando el número CAMBIA: los duplicados que ya existen
        // en la base (cargados antes de esta regla) no pueden quedar congelados —
        // hay que poder abrir esas ventas y corregirlas.
        if (data.labOrderNumber !== undefined
            && (data.labOrderNumber || '').trim()
            && (data.labOrderNumber || '').trim() !== (prevState?.labOrderNumber || '').trim()) {
            const conflictos = await findLabNumberConflicts({ value: data.labOrderNumber, excludeOrderId: id });
            if (conflictos.length > 0) throw new Error(duplicateMessage(conflictos));
        }

        const order = await prisma.order.update({
            where: { id },
            data,
            select: {
                id: true,
                clientId: true,
                orderType: true,
                total: true,
                paid: true,
                subtotalWithMarkup: true,
                discountCash: true,
                discountTransfer: true,
                discountCard: true,
                markup: true,
                isLocked: true,
                prescriptionId: true,
                items: {
                    select: {
                        id: true, price: true, quantity: true, eye: true,
                        sphereVal: true, cylinderVal: true, axisVal: true, additionVal: true,
                        product: { select: { id: true, name: true, brand: true, model: true, category: true, type: true, price: true, stock: true } }
                    }
                },
                payments: true,
                postSaleCases: {
                    orderBy: { createdAt: 'desc' as const },
                    select: {
                        id: true,
                        status: true,
                        cost: true,
                        newOrderNumber: true,
                        notes: true,
                        orderOption: true,
                        responsible: true,
                        rxData: true,
                        createdAt: true
                    }
                },
                frameA: true,
                frameB: true,
                frameDbl: true,
                frameEdc: true,
                frameA2: true,
                frameB2: true,
                frameDbl2: true,
                frameEdc2: true,
                labFrameShape: true,
                labFrameDetails: true,
                labFrameShape2: true,
                labFrameDetails2: true,
                shippingCarrier: true,
                trackingNumber: true,
                trackingUrl: true,
                shippedAt: true,
                client: {
                    // El email va acá porque notifyOrderReady lo necesita: sin él
                    // el aviso de "listo para retirar" salía SOLO por WhatsApp
                    // desde el CRM (el cron sí lo mandaba, porque trae el cliente
                    // entero). Un cliente sin WhatsApp válido no se enteraba.
                    select: { id: true, name: true, phone: true, email: true }
                }
            },
        });

        // ── Historial: reapertura y re-confirmación de una VENTA ────────────
        // Antes reabrir no dejaba rastro en ningún lado (solo un logAudit
        // genérico con `changes:['isLocked']`): un vendedor podía reabrir,
        // cambiar el pedido y re-trabar sin que la ficha mostrara nada.
        if (esReapertura) {
            const motivo = (body.reopenReason || '').toString().trim();
            await prisma.interaction.create({
                data: {
                    clientId: order.clientId,
                    type: 'SISTEMA',
                    content: `🔓 ${userName || 'Sistema'} REABRIÓ la venta #${id.slice(-4).toUpperCase()} para editarla — motivo: "${motivo}". El pedido queda editable hasta que se vuelva a confirmar.`,
                    userId: userId || null,
                    userName: userName || 'Sistema',
                },
            }).catch(err => console.error('Error registrando reapertura en ficha:', err));
            logAudit({
                userId: userId || null,
                userName: userName || 'Sistema',
                action: 'STATUS_CHANGE',
                entityType: 'ORDER',
                entityId: id,
                details: { evento: 'REAPERTURA', motivo },
            }).catch(err => console.error('Error auditando reapertura:', err));
        }
        if (esReconfirmacion) {
            let version = 2;
            try { version = JSON.parse(data.prescriptionSnapshot || '{}').v || 2; } catch { /* usar 2 */ }

            // El repaso completo se repite en CADA versión: leer la ficha de arriba
            // a abajo tiene que alcanzar para saber qué se fabricó en cada intento,
            // sin ir a comparar campos entre notas.
            const reconf: any = await prisma.order.findUnique({
                where: { id },
                select: {
                    total: true, paid: true, appliedPromoName: true, prescriptionSnapshot: true,
                    frameSource: true, userFrameBrand: true, userFrameModel: true,
                    labFrameShape: true, labFrameDetails: true,
                    frameA: true, frameB: true, frameDbl: true, frameEdc: true,
                    labFrameShape2: true, labFrameDetails2: true,
                    frameA2: true, frameB2: true, frameDbl2: true, frameEdc2: true,
                    labColor: true, labTreatment: true, labNotes: true,
                    labHeightOD: true, labHeightOI: true, labHeightOD2: true, labHeightOI2: true,
                    frames: { orderBy: { position: 'asc' as const } },
                    prescription: true,
                    items: { select: { productNameSnapshot: true, productCategorySnapshot: true, productTypeSnapshot: true, product: { select: { name: true, category: true, type: true } } } },
                },
            }).catch(() => null);

            const rxReconf = (() => {
                try { return reconf?.prescriptionSnapshot ? JSON.parse(reconf.prescriptionSnapshot)?.rx : null; } catch { return null; }
            })() || reconf?.prescription || null;

            await prisma.interaction.create({
                data: {
                    clientId: order.clientId,
                    type: 'SISTEMA',
                    content: `✅ ${userName || 'Sistema'} RE-CONFIRMÓ la venta #${id.slice(-4).toUpperCase()} después de reabrirla (versión ${version} del pedido). Lo que va a fábrica es esta versión.`
                        + (reconf ? DETALLE_MARK + [
                            `— ARMAZÓN Y TEÑIDO (v${version}) —`,
                            frameRecapText(reconf),
                            ``,
                            `— RECETA (v${version}) —`,
                            prescriptionRecapText(rxReconf),
                        ].join('\n') : ''),
                    imageUrl: rxReconf?.imageUrl || null,
                    userId: userId || null,
                    userName: userName || 'Sistema',
                },
            }).catch(err => console.error('Error registrando re-confirmación en ficha:', err));

            // Y el cliente recibe el repaso corregido, marcado como actualización.
            sendSaleConfirmation(id, { esActualizacion: true, version })
                .catch(err => console.error('Error re-enviando la confirmación de compra:', err));
            logAudit({
                userId: userId || null,
                userName: userName || 'Sistema',
                action: 'STATUS_CHANGE',
                entityType: 'ORDER',
                entityId: id,
                details: { evento: 'RE_CONFIRMACION', version },
            }).catch(err => console.error('Error auditando re-confirmación:', err));
        }

        // ── Historial: cambio de estado de laboratorio en la ficha del cliente ──
        if (prevState && data.labStatus !== undefined && prevState.labStatus !== data.labStatus) {
            const LAB_LABELS: Record<string, string> = {
                NONE: 'Pendiente', SENT: 'Enviado a fábrica', IN_PROGRESS: 'Procesado',
                FINISHED: 'Finalizado', READY: 'Listo para retirar', DELIVERED: 'Entregado'
            };
            const fromLabel = LAB_LABELS[prevState.labStatus || 'NONE'] || prevState.labStatus || 'Pendiente';
            const toLabel = LAB_LABELS[data.labStatus] || data.labStatus;
            await prisma.interaction.create({
                data: {
                    clientId: order.clientId,
                    type: 'SISTEMA',
                    content: `📦 ${userName || 'Sistema'} cambió el estado del pedido #${id.slice(-4).toUpperCase()}: ${fromLabel} → ${toLabel}`,
                    userId: userId || null,
                    userName: userName || 'Sistema'
                }
            }).catch(err => console.error('Error registrando cambio de estado en ficha:', err));
        }

        // ── Historial: número de operación del laboratorio ──
        // Se registra tanto el alta como la corrección posterior: el nº de operación
        // es lo que ata el pedido al lab, y sin esto no quedaba rastro de quién lo cargó.
        if (prevState && data.labOrderNumber !== undefined) {
            const prevNumber = (prevState.labOrderNumber || '').trim();
            const newNumber = (data.labOrderNumber || '').trim();
            if (prevNumber !== newNumber) {
                const who = userName || 'Sistema';
                const shortId = id.slice(-4).toUpperCase();
                const content = !prevNumber
                    ? `🏭 ${who} asignó el N° de operación ${newNumber} al pedido #${shortId}`
                    : !newNumber
                        ? `🏭 ${who} borró el N° de operación (era ${prevNumber}) del pedido #${shortId}`
                        : `🏭 ${who} cambió el N° de operación del pedido #${shortId}: ${prevNumber} → ${newNumber}`;

                await prisma.interaction.create({
                    data: {
                        clientId: order.clientId,
                        type: 'SISTEMA',
                        content,
                        userId: userId || null,
                        userName: who
                    }
                }).catch(err => console.error('Error registrando N° de operación en ficha:', err));

                logAudit({
                    userId: userId || null,
                    userName: who,
                    action: 'UPDATE',
                    entityType: 'ORDER',
                    entityId: id,
                    details: { field: 'labOrderNumber', from: prevNumber || null, to: newNumber || null }
                }).catch(err => console.error('Error logging audit de N° de operación:', err));

                // Un mismo nº de operación en dos pedidos rompe la conciliación de
                // costos (cruza factura del lab por ese número). No se bloquea
                // (continúa abajo)
                // —a veces es legítimo— pero nunca puede pasar en silencio.
                if (newNumber) {
                    alertDuplicateLabOrderNumber({ orderId: id, labOrderNumber: newNumber, actorName: who })
                        .catch(err => console.error('Error en alerta de N° repetido:', err));
                }
            }
        }

        // ── Auto-Task: Request Review when DELIVERED ──
        if (labStatus === 'DELIVERED') {
            const taskDescription = `Solicitar comentario a ${order.client.name}`;
            
            // Avoid duplicate pending review requests
            const existingTask = await prisma.clientTask.findFirst({
                where: {
                    clientId: order.clientId,
                    description: taskDescription,
                    status: 'PENDING',
                    type: 'REVIEW_REQUEST'
                }
            });

            if (!existingTask) {
                await ContactService.addReviewRequest(order.clientId, taskDescription);
            }
        }

        // ── Auto-Notify: WhatsApp pickup when READY ──
        // El gate pedía teléfono y solo teléfono: un cliente web que compró con
        // mail y dejó un número mal tipeado no recibía el aviso por ningún lado.
        // notifyOrderReady ya sabe elegir canal, así que acá solo se controla que
        // haya AL MENOS uno.
        if (labStatus === 'READY' && (order.client.phone || order.client.email)) {
            // Delegate sending logic and DB interaction updates to the background service
            // Note: In Next.js App Router, we avoid awaiting background non-critical tasks
            // if we don't want to delay the API response, but for DB consistency it's fine.
            await BotService.notifyOrderReady(order);
        }

        // ── Auto-Notify: pedido despachado ──
        if (seDespachaAhora && !prevState?.dispatchNotifiedAt) {
            await OrderService.notifyOrderDispatched(id, userName || 'Sistema');
        }

        // Log Audit for update — siempre (aunque falte userId), con transición old→new si hubo cambio de estado
        await logAudit({
            userId: userId || null,
            userName: userName || 'Sistema',
            action: (data.labStatus !== undefined || data.status !== undefined) ? 'STATUS_CHANGE' : 'UPDATE',
            entityType: 'ORDER',
            entityId: id,
            details: {
                changes: Object.keys(data),
                ...(prevState ? {
                    from: { labStatus: prevState.labStatus, status: prevState.status },
                    to: { labStatus: data.labStatus ?? prevState.labStatus, status: data.status ?? prevState.status }
                } : {}),
                orderType: order.orderType,
                total: order.total
            }
        }).catch(err => console.error('Error logging audit for order update:', err));

        return order;
    } catch (error: any) {
        console.error('Error updating order:', error);
        
        // Handle Prisma's "Record to update not found" specifically for stock constraint
        if (error.code === 'P2025') {
            throw new Error('No hay suficiente stock disponible para uno de los productos seleccionados.');
        }

        throw new Error(error.message);
    }
}
}

// ── Email de casos de post-venta ─────────────────────────────────────────────
// Arma el HTML con la ficha completa (cliente, pedido y caso). Lo usan tanto
// el alta de un caso nuevo como las actualizaciones relevantes del caso.
function buildPostSaleCaseEmailHtml(opts: {
    heading: string;
    intro: string;
    orderId: string;
    order: {
        clientId?: string | null;
        client?: { name?: string | null; phone?: string | null; email?: string | null; dni?: string | null; insurance?: string | null; doctor?: string | null } | null;
        items?: any[];
        labOrderNumber?: string | null;
        createdAt?: Date | string | null;
        total?: number | null;
    };
    caseInfo: {
        caseType?: string | null;
        responsible?: string | null;
        fault?: string | null;
        coverage?: string | null;
        cost?: number | null;
        orderOption?: string | null;
        newOrderNumber?: string | null;
    };
    changes?: string[];
    notes?: string | null;
    notesLabel?: string;
}): string {
    const { heading, intro, orderId, order, caseInfo, changes, notes, notesLabel } = opts;
    const cli = order.client;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';

    const row = (label: string, value: string | null | undefined, valueStyle = 'color: #1f2937;') => `
                                    <tr style="border-bottom: 1px solid #f3f4f6;">
                                        <td style="padding: 8px 0; font-weight: bold; color: #4b5563; width: 160px; vertical-align: top;">${label}:</td>
                                        <td style="padding: 8px 0; ${valueStyle}">${value || 'No registrado'}</td>
                                    </tr>`;
    const sectionTitle = (title: string) => `
                                <h3 style="color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 4px 0; border-bottom: 1px solid #fde68a; padding-bottom: 4px;">${title}</h3>`;

    const productsList = (order.items || [])
        .map((item: any) => {
            const name = item.productNameSnapshot || item.product?.name || 'Producto';
            const brand = item.productBrandSnapshot || item.product?.brand;
            const lab = item.laboratorySnapshot || item.product?.laboratory;
            const qty = item.quantity && item.quantity > 1 ? `${item.quantity} × ` : '';
            return `${qty}${brand ? `${brand} — ` : ''}${name}${lab ? ` (Lab: ${lab})` : ''}`;
        })
        .join('<br/>');

    const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('es-AR') : null;
    const orderTotal = order.total ? `$${Number(order.total).toLocaleString('es-AR')}` : null;

    const changesBlock = changes && changes.length > 0 ? `
                                <div style="margin-top: 16px; padding: 16px; background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 8px;">
                                    <strong style="color: #1d4ed8; display: block; margin-bottom: 6px; font-size: 14px;">Qué cambió:</strong>
                                    <p style="margin: 0; color: #374151; font-size: 13px; line-height: 1.7;">${changes.join('<br/>')}</p>
                                </div>` : '';

    const notesBlock = notes ? `
                                <div style="margin-top: 24px; padding: 16px; background-color: #fffbeb; border-left: 4px solid #d97706; border-radius: 8px;">
                                    <strong style="color: #b45309; display: block; margin-bottom: 6px; font-size: 14px;">${notesLabel || 'Detalle / Observaciones del caso'}:</strong>
                                    <p style="margin: 0; color: #4b5563; white-space: pre-wrap; font-size: 13px; line-height: 1.5;">${notes}</p>
                                </div>` : '';

    return `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; background-color: #ffffff; color: #1f2937;">
                                <h2 style="color: #d97706; margin-top: 0; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">${heading}</h2>
                                <p style="font-size: 14px; line-height: 1.5;">${intro}</p>
                                ${changesBlock}
                                ${sectionTitle('Cliente')}
                                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                    ${row('Nombre', cli?.name, 'color: #1f2937; font-weight: bold;')}
                                    ${row('Teléfono', cli?.phone)}
                                    ${row('Email', cli?.email)}
                                    ${row('DNI', cli?.dni)}
                                    ${row('Obra social', cli?.insurance)}
                                    ${row('Médico', cli?.doctor)}
                                </table>
                                ${sectionTitle('Pedido')}
                                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                    ${row('N° Pedido', `#${orderId.slice(-6).toUpperCase()}`, 'color: #2563eb; font-family: monospace; font-weight: bold;')}
                                    ${row('N° Lab', order.labOrderNumber)}
                                    ${row('Fecha del pedido', orderDate)}
                                    ${row('Total', orderTotal)}
                                    ${row('Productos', productsList || null)}
                                </table>
                                ${sectionTitle('Caso')}
                                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                    ${row('Tipo de caso', caseInfo.caseType, 'color: #1f2937; font-weight: bold;')}
                                    ${row('Responsable', caseInfo.responsible)}
                                    ${/* La atribución se deriva del responsable: solo se
                                         muestra cuando aporta algo distinto (casos viejos,
                                         cargados cuando eran dos campos separados). */''}
                                    ${caseInfo.fault && caseInfo.fault !== caseInfo.responsible ? row('Atribución', caseInfo.fault) : ''}
                                    ${row('Cobertura', caseInfo.coverage)}
                                    ${row('Costo Adicional', `$${caseInfo.cost || 0}`, 'color: #b91c1c; font-weight: bold;')}
                                    ${row('Opción en Lab', caseInfo.orderOption || 'No requiere', 'color: #1f2937; text-transform: uppercase; font-size: 12px; font-weight: bold;')}
                                    ${caseInfo.newOrderNumber
            ? row('N° de operación / nuevo pedido', caseInfo.newOrderNumber, 'color: #2563eb; font-family: monospace; font-weight: bold;')
            : row('N° de operación / nuevo pedido', 'Pendiente de cargar', 'color: #b45309; font-weight: bold;')}
                                </table>
                                ${notesBlock}
                                <div style="margin-top: 24px; text-align: center;">
                                    ${order.clientId ? `<a href="${appUrl}/admin/contactos?clientId=${order.clientId}&section=postsale" style="display: inline-block; padding: 12px 24px; background-color: #d97706; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(217, 119, 6, 0.2);">Ver caso en la ficha del cliente</a><br>` : ''}
                                    <a href="${appUrl}/admin/ventas?id=${orderId}" style="display: inline-block; margin-top: ${order.clientId ? '12px' : '0'}; padding: 10px 20px; background-color: #ffffff; color: #b45309; border: 1px solid #d97706; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px;">Ver pedido en CRM</a>
                                </div>
                                <p style="margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px;">Este es un mensaje automático del Sistema de Gestión de Atelier Óptica.</p>
                            </div>
                        `;
}
