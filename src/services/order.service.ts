import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { ContactService } from '@/services/contact.service';
import { BotService } from '@/services/bot.service';
import { prisma } from '@/lib/db';
import { PricingService, calculateQuoteTotals } from '@/services/PricingService';
import { recalculateCrystalPrices } from '@/lib/promo-utils';
import { z } from 'zod';
import { fetchWa, getAdminChatId } from '@/lib/wa-config';
import { normalizeArgentinePhone } from '@/services/contact.service';
import { AdsService } from '@/services/ads.service';
import { GoogleContactsService } from '@/services/google-contacts.service';
import { formatOrderItemsSummary } from '@/lib/order-utils';
import { logAudit } from '@/lib/audit';
import { addBusinessDays, calculateEstimatedDays } from '@/lib/business-days';
import { format } from 'date-fns';

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
    productBrandSnapshot: z.string().nullable().optional(),
    productNameSnapshot: z.string().nullable().optional(),
    productCategorySnapshot: z.string().nullable().optional(),
});

const OrderUpdateSchema = z.object({
    orderType: z.enum(['QUOTE', 'SALE']).optional(),
    total: z.number().optional(),
    markup: z.number().min(0).optional(),
    discountCash: z.number().optional(),
    discountTransfer: z.number().optional(),
    discountCard: z.number().optional(),
    specialDiscount: z.number().min(0).optional(),
    subtotalWithMarkup: z.number().optional(),
    prescriptionId: z.string().nullable().optional(),
    frameSource: z.enum(['OPTICA', 'USUARIO']).nullable().optional(),
    userFrameBrand: z.string().nullable().optional(),
    userFrameModel: z.string().nullable().optional(),
    userFrameNotes: z.string().nullable().optional(),
    items: z.array(OrderItemSchema).optional(),
    isLocked: z.boolean().optional(),
    // Lab fields
    labStatus: z.string().optional(),
    labNotes: z.string().nullable().optional(),
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
                postSaleNotes: true,
                postSaleCost: true,
                postSaleResponsible: true,
                postSaleOrderOption: true,
                postSaleNewOrderNumber: true,
                postSaleStatus: true,
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

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Map client → contact shape expected by cotizador/page.tsx
        const response = {
            ...order,
            contact: order.client,
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

        const order = await ContactService.deleteOrder(id, reason);

        await logAudit({
            userId,
            userName,
            action: 'DELETE',
            entityType: 'ORDER',
            entityId: id,
            details: { reason, orderType: order.orderType, total: order.total }
        });

        return order;
    } catch (error) {
        console.error('Error deleting order:', error);
        throw new Error('Error al eliminar el pedido');
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

            // 2. Financial changes/items changes are only allowed if the sale is currently unlocked
            // or if the admin is unlocking it in this same request.
            const financialFields = [
                'items', 'markup', 'discountCash', 'discountTransfer', 
                'discountCard', 'specialDiscount', 'total', 'subtotalWithMarkup',
                'clientId', 'userId', 'orderType'
            ];
            const hasFinancialEdits = Object.keys(body).some(key => financialFields.includes(key));
            const isUnlockingNow = body.isLocked === false;
            
            if (existingForGuard.isLocked && !isUnlockingNow && hasFinancialEdits) {
                throw new Error('La venta está bloqueada. El administrador debe reabrirla para poder editar.');
            }
        }

        if (body.items) {
            if (existingForGuard?.orderType === 'SALE' && existingForGuard?.isLocked) {
                throw new Error('No se pueden modificar los ítems de una venta bloqueada. Solicitá reapertura al administrador.');
            }
        }

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

        const { 
            labStatus, labNotes, orderType, labOrderNumber, 
            frameSource, userFrameBrand, userFrameModel, userFrameNotes, 
            labColor, labTreatment, labDiameter, labPdOd, labPdOi, 
            frameA, frameB, frameDbl, frameEdc, smartLabScreenshot,
            labPrismOD, labPrismOI, labBaseCurve, labFrameType, labBevelPosition,
            labFrameShape, labFrameDetails,
            frameA2, frameB2, frameDbl2, frameEdc2, labFrameShape2, labFrameDetails2,
            prescriptionId, items, total, markup, 
            discountCash, discountTransfer, discountCard, specialDiscount, subtotalWithMarkup,
            isLocked, authorizedByAdmin,
            postSaleNotes, postSaleCost, postSaleResponsible,
            postSaleOrderOption, postSaleNewOrderNumber, postSaleStatus
        } = body;

        const data: any = {};
        if (isLocked !== undefined) data.isLocked = isLocked;
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
                data.specialDiscount = totals.specialDiscountAmount;
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
        if (specialDiscount !== undefined) data.specialDiscount = specialDiscount;

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

            data.items = {
                deleteMany: {},
                create: items.map((item: any) => {
                    const dbProd = dbProducts.find(p => p.id === item.productId);
                    const isOD = item.eye === 'OD';
                    const isOI = item.eye === 'OI';
                    const isCrystal = dbProd && (dbProd.category === 'Cristal' || (dbProd.type || '').includes('Cristal'));

                    return {
                        productId: item.productId || null,
                        quantity: item.quantity,
                        price: item.price,
                        eye: item.eye || null,
                        sphereVal: isCrystal && rxDetails ? (isOD ? rxDetails.sphereOD : rxDetails.sphereOI) : (item.sphereVal ?? null),
                        cylinderVal: isCrystal && rxDetails ? (isOD ? rxDetails.cylinderOD : rxDetails.cylinderOI) : (item.cylinderVal ?? null),
                        axisVal: isCrystal && rxDetails ? (isOD ? rxDetails.axisOD : rxDetails.axisOI) : (item.axisVal ?? null),
                        additionVal: isCrystal && rxDetails ? (isOD ? (rxDetails.additionOD ?? rxDetails.addition) : (rxDetails.additionOI ?? rxDetails.addition)) : (item.additionVal ?? null),
                        productNameSnapshot: dbProd ? (dbProd.model || dbProd.name || null) : (item.productNameSnapshot || null),
                        productBrandSnapshot: dbProd ? (dbProd.brand || null) : (item.productBrandSnapshot || null),
                        productCategorySnapshot: dbProd ? (dbProd.category || null) : (item.productCategorySnapshot || null),
                        productCostSnapshot: dbProd ? (dbProd.cost || 0) : null,
                        laboratorySnapshot: dbProd ? (dbProd.laboratory || null) : null,
                        crystalColor: item.crystalColor || null,
                        crystalColorType: item.crystalColorType || null,
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
                            product: { select: { category: true, type: true, name: true } }
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
                        select: { email: true }
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
                            // Must have height (at least one eye)
                            if (rx.heightOD == null && rx.heightOI == null) {
                                errors.push('Falta cargar la Altura en la receta (OD y/o OI).');
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
            data.labStatus = labStatus;
            if (labStatus === 'SENT') {
                data.labSentAt = new Date();
            }
            // Auto-complete order when lab marks as delivered
            if (labStatus === 'DELIVERED') {
                data.status = 'COMPLETED';
            }
        }

        if (labNotes !== undefined) data.labNotes = labNotes;
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
        if (postSaleNotes !== undefined || postSaleCost !== undefined || postSaleResponsible !== undefined || postSaleOrderOption !== undefined || postSaleStatus !== undefined) {
            const currentOrderForPostSale = await prisma.order.findUnique({
                where: { id },
                select: {
                    postSaleNotes: true,
                    postSaleStatus: true,
                    client: { select: { name: true } },
                    id: true
                }
            });

            if (currentOrderForPostSale) {
                // Initialize postSaleStatus if not present
                if (postSaleStatus !== undefined) {
                    data.postSaleStatus = postSaleStatus;
                } else if ((postSaleNotes || postSaleOrderOption || postSaleCost) && !currentOrderForPostSale.postSaleStatus) {
                    data.postSaleStatus = 'PENDING';
                }

                // If adding postSaleNotes (a new entry) and previously there were no notes,
                // or if it was not in postSaleStatus and now it is initialized to 'PENDING',
                // send email notification to admin.
                const wasPostSaleInitialized = (data.postSaleStatus === 'PENDING' && !currentOrderForPostSale.postSaleStatus);
                const isNewPostSaleNotes = (postSaleNotes && !currentOrderForPostSale.postSaleNotes);

                if (wasPostSaleInitialized || isNewPostSaleNotes) {
                    const adminEmail = process.env.ADMIN_EMAIL || 'Pisano.ishtar@gmail.com';
                    const clientName = currentOrderForPostSale.client?.name || 'Cliente';
                    const subject = `⚠️ Nuevo caso de Post-Venta registrado - ${clientName}`;
                    const html = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; background-color: #ffffff; color: #1f2937;">
                            <h2 style="color: #d97706; margin-top: 0; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">⚠️ Nuevo Caso de Post-Venta Registrado</h2>
                            <p style="font-size: 14px; line-height: 1.5;">Se ha registrado un nuevo caso de post-venta en el sistema con los siguientes detalles:</p>
                            <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
                                <tr style="border-bottom: 1px solid #f3f4f6;">
                                    <td style="padding: 10px 0; font-weight: bold; color: #4b5563; width: 150px;">Cliente:</td>
                                    <td style="padding: 10px 0; color: #1f2937; font-weight: bold;">${clientName}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f3f4f6;">
                                    <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">N° Pedido:</td>
                                    <td style="padding: 10px 0; color: #2563eb; font-family: monospace; font-weight: bold;">#${id.slice(-6).toUpperCase()}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f3f4f6;">
                                    <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Responsable:</td>
                                    <td style="padding: 10px 0; color: #1f2937;">${postSaleResponsible || body.postSaleResponsible || 'No especificado'}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f3f4f6;">
                                    <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Costo Adicional:</td>
                                    <td style="padding: 10px 0; color: #b91c1c; font-weight: bold;">$${postSaleCost || body.postSaleCost || 0}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f3f4f6;">
                                    <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">Opción en Lab:</td>
                                    <td style="padding: 10px 0; color: #1f2937; text-transform: uppercase; font-size: 12px; font-weight: bold;">${postSaleOrderOption || body.postSaleOrderOption || 'No requiere'}</td>
                                </tr>
                            </table>
                            <div style="margin-top: 24px; padding: 16px; background-color: #fffbeb; border-left: 4px solid #d97706; border-radius: 8px;">
                                <strong style="color: #b45309; display: block; margin-bottom: 6px; font-size: 14px;">Detalle / Observaciones del caso:</strong>
                                <p style="margin: 0; color: #4b5563; white-space: pre-wrap; font-size: 13px; line-height: 1.5;">${body.postSaleNotesEntry || postSaleNotes || 'Sin notas descriptivas'}</p>
                            </div>
                            <p style="margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px;">Este es un mensaje automático del Sistema de Gestión de Atelier Óptica.</p>
                        </div>
                    `;
                    sendEmail({
                        to: adminEmail,
                        subject,
                        html
                    }).catch(err => console.error('[Post-Sale Email Error]:', err));
                }
            }
        }

        if (postSaleNotes !== undefined) data.postSaleNotes = postSaleNotes;
        if (postSaleCost !== undefined) data.postSaleCost = postSaleCost;
        if (postSaleResponsible !== undefined) data.postSaleResponsible = postSaleResponsible;
        if (postSaleOrderOption !== undefined) {
            data.postSaleOrderOption = postSaleOrderOption;
            if (postSaleOrderOption === 'SAME' || postSaleOrderOption === 'DIFFERENT') {
                const currentOrder = await prisma.order.findUnique({
                    where: { id },
                    select: { labStatus: true }
                });
                if (currentOrder && currentOrder.labStatus !== 'SENT' && currentOrder.labStatus !== 'IN_PROGRESS') {
                    data.labStatus = 'SENT';
                    data.labSentAt = new Date();
                    data.smartLabProgress = 0;
                }
            }
        }
        if (postSaleNewOrderNumber !== undefined) data.postSaleNewOrderNumber = postSaleNewOrderNumber;

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
                        client: true,
                        items: {
                            select: {
                                product: { select: { type: true, category: true, brand: true, model: true, name: true, stock: true } },
                                quantity: true
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

                // Check: client must have name and phone at minimum
                const client = existingOrder.client;
                if (!client?.name || !client?.phone || !client?.dni || !client?.address) {
                    throw new Error('La ficha del contacto debe estar completa (nombre, teléfono, DNI y dirección obligatorios)');
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
                        const hasProgressiveOrMultifocal = existingOrder.items?.some((item: any) => {
                            const name = (item.product?.name || '').toLowerCase();
                            const type = (item.product?.type || '').toLowerCase();
                            const cat = (item.product?.category || '').toLowerCase();
                            return name.includes('multifocal') || name.includes('progresivo') || name.includes('ocupacional') ||
                                   type.includes('multifocal') || type.includes('progresivo') || type.includes('ocupacional') ||
                                   cat.includes('multifocal') || cat.includes('progresivo') || cat.includes('ocupacional');
                        });

                        if (hasProgressiveOrMultifocal) {
                            if (rx.heightOD == null && rx.heightOI == null) {
                                saleErrors.push('Falta cargar la Altura en la receta (OD y/o OI) para cristales progresivos/ocupacionales.');
                            }
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
                                product: { select: { category: true, type: true } }
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
                            client: {
                                select: { name: true, email: true, phone: true }
                            },
                            items: {
                                select: {
                                    id: true, price: true, quantity: true, eye: true,
                                    sphereVal: true, cylinderVal: true, axisVal: true, additionVal: true, pdVal: true, heightVal: true, prismVal: true,
                                    product: { select: { id: true, name: true, brand: true, model: true, category: true, type: true, price: true, stock: true } }
                                }
                            },
                            payments: true,
                            prescription: true,
                            postSaleNotes: true,
                            postSaleCost: true,
                            postSaleResponsible: true,
                            postSaleOrderOption: true,
                            postSaleNewOrderNumber: true,
                            postSaleStatus: true,
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

                // Enviar conversión offline a Meta/Google de forma asíncrona (fire and forget)
                AdsService.sendOfflineConversion(updatedOrder as any).catch(err => {
                    console.error('Error al notificar conversión offline:', err);
                });

                // Enviar vCard por WhatsApp (Sincronización de Contacto)
                if (updatedOrder.client) {
                    GoogleContactsService.syncClient({
                        name: updatedOrder.client.name,
                        phone: updatedOrder.client.phone,
                        email: updatedOrder.client.email
                    }).catch(err => console.error('Error syncClient:', err));
                }

                // Registrar conversión a VENTA en el historial del cliente
                const saleSummaries = formatOrderItemsSummary(updatedOrder.items);
                const historyContent = `🛒 Presupuesto #${updatedOrder.id.slice(-4).toUpperCase()} confirmado como VENTA por $${(updatedOrder.total || 0).toLocaleString('es-AR')}\n\nProductos:\n• ${saleSummaries}`;
                await prisma.interaction.create({
                    data: {
                        clientId: existingOrder.client.id,
                        type: 'SALE_CONFIRMED',
                        content: historyContent,
                    },
                }).catch(err => console.error('Error al registrar interacción de venta:', err));

                // Enviar mensaje al grupo de ventas
                try {
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
                    const link = `${appUrl}/admin/contactos?id=${existingOrder.client.id}`;
                    
                    const groupMessage = `🎉 *NUEVA VENTA CONFIRMADA* 🎉\n` + 
                        `👤 *Cliente:* ${existingOrder.client.name}\n` +
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
                postSaleNotes: true,
                postSaleCost: true,
                postSaleResponsible: true,
                postSaleOrderOption: true,
                postSaleNewOrderNumber: true,
                postSaleStatus: true,
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
                client: {
                    select: { id: true, name: true, phone: true }
                }
            },
        });

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
        if (labStatus === 'READY' && order.client.phone) {
            // Delegate sending logic and DB interaction updates to the background service
            // Note: In Next.js App Router, we avoid awaiting background non-critical tasks 
            // if we don't want to delay the API response, but for DB consistency it's fine.
            await BotService.notifyOrderReady(order);
        }

        // Log Audit for update
        if (userId) {
            await logAudit({
                userId,
                userName,
                action: 'UPDATE',
                entityType: 'ORDER',
                entityId: id,
                details: {
                    changes: Object.keys(data),
                    orderType: order.orderType,
                    total: order.total
                }
            }).catch(err => console.error('Error logging audit for order update:', err));
        }

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
