import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { ContactService } from '@/services/contact.service';
import { BotService } from '@/services/bot.service';
import { prisma } from '@/lib/db';
import { snapshotFromProduct } from '@/lib/order-snapshot';
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
    postSaleRxData: z.string().nullable().optional(),
    postSaleCaseType: z.string().nullable().optional(),
    postSaleFault: z.string().nullable().optional(),
    postSaleCoverage: z.string().nullable().optional(),
    // Imagen adjunta a la observación que se agrega en este PATCH
    postSaleNoteImageUrl: z.string().nullable().optional(),
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
            postSaleOrderOption, postSaleNewOrderNumber, postSaleStatus, postSaleRxData, postSaleCaseType,
            postSaleFault, postSaleCoverage, postSaleNoteImageUrl
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

        // ── FACTORY GATE: Validate requirements before sending to lab ──
        // Corre ANTES del ajuste de stock: si alguna validación tira, el stock
        // todavía no se tocó (antes se ejecutaba después, y un throw acá dejaba el
        // stock revertido/decrementado a medias de forma permanente).
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
                    // Apply new items stock. Como el stock de los ítems viejos ya se
                    // devolvió arriba, acá se descuenta la cantidad COMPLETA del nuevo
                    // ítem, condicionada a stock suficiente (gte). El updateMany atómico
                    // cierra el TOCTOU del pre-chequeo stale: dos ediciones simultáneas
                    // del último armazón no pueden dejar el stock en negativo.
                    for (const newItem of newStockItems) {
                        const dec = await tx.product.updateMany({
                            where: { id: newItem.productId as string, stock: { gte: newItem.quantity } },
                            data: { stock: { decrement: newItem.quantity } }
                        });
                        if (dec.count === 0) {
                            const dbProd = dbNewProducts.find(p => p.id === newItem.productId);
                            const name = `${dbProd?.brand || ''} ${dbProd?.name || ''}`.trim() || 'un producto';
                            throw new Error(`Stock insuficiente para ${name}: otra operación tomó las últimas unidades.`);
                        }
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
                    // Datos de armado que carga el checkout web/payway (no el cotizador):
                    // se preservan para que una edición de ítems no los borre.
                    pdVal: true, heightVal: true, prismVal: true, crystalColor: true, crystalColorType: true,
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
                        // pd/height/prism y color: si el front no los reenvía, se toman de la
                        // fila previa (los carga el checkout web) para no borrarlos al editar.
                        pdVal: item.pdVal ?? prev?.pdVal ?? null,
                        heightVal: item.heightVal ?? prev?.heightVal ?? null,
                        prismVal: item.prismVal ?? prev?.prismVal ?? null,
                        ...snap,
                        crystalColor: item.crystalColor ?? prev?.crystalColor ?? null,
                        crystalColorType: item.crystalColorType ?? prev?.crystalColorType ?? null,
                    };
                }),
            };
        }

        if (labStatus) {
            data.labStatus = labStatus;
            if (labStatus === 'SENT') {
                data.labSentAt = new Date();
                // El vendedor "dueño" de la venta es quien la envía a fábrica
                data.labSentBy = userName || 'Sistema';
                data.labSentById = userId || null;
            }
            // Auto-complete order when lab marks as delivered.
            // Solo las ventas (SALE) pasan a COMPLETED; un presupuesto (QUOTE) no debe
            // quedar COMPLETED sin haber descontado stock ni convertido a venta.
            if (labStatus === 'DELIVERED' && existingForGuard?.orderType === 'SALE') {
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
                        data.labSentBy = userName || 'Sistema';
                        data.labSentById = userId || null;
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
        if (postSaleNotes !== undefined || postSaleCost !== undefined || postSaleResponsible !== undefined || postSaleOrderOption !== undefined || postSaleStatus !== undefined || postSaleRxData !== undefined || postSaleNewOrderNumber !== undefined || postSaleCaseType !== undefined || postSaleFault !== undefined || postSaleCoverage !== undefined) {
            const currentOrderForPostSale = await prisma.order.findUnique({
                where: { id },
                select: {
                    postSaleCases: {
                        orderBy: { createdAt: 'desc' as const },
                        select: {
                            notes: true,
                            status: true
                        }
                    },
                    client: { select: { id: true, name: true, phone: true, email: true, dni: true, insurance: true, doctor: true } },
                    // Dueño de la venta: para dejar registrado en la ficha "de quién es la venta"
                    user: { select: { name: true } },
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
                    id: true
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
                    activeCase = await prisma.postSaleCase.create({
                        data: {
                            orderId: id,
                            status: resolvedStatus || 'SENT',
                            cost: postSaleCost !== undefined && postSaleCost !== null ? Number(postSaleCost) : 0.0,
                            newOrderNumber: postSaleNewOrderNumber || null,
                            notes: postSaleNotes || null,
                            orderOption: postSaleOrderOption || null,
                            responsible: postSaleResponsible || null,
                            caseType: postSaleCaseType || null,
                            fault: postSaleFault || null,
                            coverage: postSaleCoverage || null,
                            rxData: postSaleRxData || null
                        }
                    });

                    // Add note if notes are present
                    if (postSaleNotes) {
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

                    // Registrar el caso en el historial de la ficha del cliente:
                    // queda la fecha (createdAt), quién lo cargó (userName) y de quién
                    // es la venta (el vendedor dueño del pedido).
                    if (currentOrderForPostSale.client?.id) {
                        const loadedBy = userName || 'Sistema';
                        const sellerName = currentOrderForPostSale.user?.name || 'vendedor no registrado';
                        const shortId = id.slice(-4).toUpperCase();
                        const caseDetail = postSaleCaseType ? ` — ${postSaleCaseType}` : '';
                        const firstNote = (postSaleNotes || '').split('\n').map((l: string) => l.trim()).filter(Boolean).pop();
                        const noteLine = firstNote ? `\n\n${firstNote}` : '';
                        await prisma.interaction.create({
                            data: {
                                clientId: currentOrderForPostSale.client.id,
                                type: 'POST_SALE_CASE',
                                content: `🛡️ ${loadedBy} registró un caso de post-venta en el pedido #${shortId} (venta de ${sellerName})${caseDetail}.${noteLine}`,
                                userId: userId || null,
                                userName: loadedBy,
                            },
                        }).catch(err => console.error('Error al registrar interacción de post-venta:', err));
                    }

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
                    if (resolvedStatus !== undefined) caseData.status = resolvedStatus;
                    if (postSaleCost !== undefined && postSaleCost !== null) caseData.cost = Number(postSaleCost);
                    if (postSaleNotes !== undefined) caseData.notes = postSaleNotes;
                    if (postSaleOrderOption !== undefined) caseData.orderOption = postSaleOrderOption;
                    if (postSaleResponsible !== undefined) caseData.responsible = postSaleResponsible;
                    if (postSaleCaseType !== undefined) caseData.caseType = postSaleCaseType;
                    if (postSaleFault !== undefined) caseData.fault = postSaleFault;
                    if (postSaleCoverage !== undefined) caseData.coverage = postSaleCoverage;
                    if (postSaleRxData !== undefined) caseData.rxData = postSaleRxData;
                    if (postSaleNewOrderNumber !== undefined) caseData.newOrderNumber = postSaleNewOrderNumber;

                    const oldStatus = activeCase.status;
                    const updatedCase = await prisma.postSaleCase.update({
                        where: { id: activeCase.id },
                        data: caseData
                    });

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
                    if (postSaleNotes !== undefined && postSaleNotes !== activeCase.notes) {
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
                        changes.push(`<b>Responsable del error:</b> ${fmtVal(activeCase.fault)} → ${fmtVal(postSaleFault)}`);
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
                if (!client?.name || !client?.phone) {
                    throw new Error('La ficha del contacto debe tener al menos nombre y teléfono para generar la venta');
                }

                // Convertir a SALE fija labStatus='SENT' salteando el Factory Gate del
                // path de labStatus. Replicamos acá sus validaciones de ficha (email y
                // fecha de nacimiento) para no mandar a fábrica un cliente incompleto.
                const gateErrors: string[] = [];
                if (!client?.email) {
                    gateErrors.push('El cliente debe tener un email registrado para enviar a fábrica (necesario para CAPI y facturación).');
                }
                if (!client?.birthDate) {
                    gateErrors.push('El cliente debe tener la fecha de nacimiento cargada en su ficha para enviar a fábrica.');
                }
                if (gateErrors.length > 0) {
                    throw new Error(`No se puede convertir en venta:\n${gateErrors.join('\n')}`);
                }

                // Check: 50% minimum payment
                const minRequired = (existingOrder.total || 0) * 0.5;
                const totalPaid = existingOrder.paid || 0;
                if (totalPaid < minRequired && !existingOrder.authorizedByAdmin) {
                    throw new Error(`Se requiere un pago mínimo del 50% ($${Math.ceil(minRequired).toLocaleString()}) para convertir en venta. Pagado: $${totalPaid.toLocaleString()}`);
                }

                // Si la conversión QUOTE→SALE trae ítems nuevos en el body, validar el
                // gate contra ESOS (no solo los viejos de la DB): agregar cristales en la
                // misma conversión no debe saltear receta/foto/altura/DP.
                let gateItems = existingOrder.items;
                if (Array.isArray(items) && items.length > 0) {
                    const bodyProductIds = items.map((it: any) => it.productId).filter(Boolean);
                    const bodyProducts = bodyProductIds.length > 0
                        ? await prisma.product.findMany({
                            where: { id: { in: bodyProductIds } },
                            select: { id: true, type: true, category: true, name: true },
                        })
                        : [];
                    const byId = new Map((bodyProducts || []).map((p: any) => [p.id, p]));
                    gateItems = items.map((it: any) => ({ product: it.productId ? byId.get(it.productId) || null : null }));
                }

                // Check: if order has crystals, frame info must be set
                const hasCrystals = gateItems?.some((item: any) =>
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
                        const hasProgressiveOrMultifocal = gateItems?.some((item: any) => {
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

                // Usar gateItems (los del body si la conversión los trae, si no los de la DB):
                // debe mirar el MISMO conjunto que hasCrystals, si no una conversión que agrega
                // cristal+armazón juntos veía el cristal (body) pero no el armazón (DB) y rechazaba.
                const hasFramesInCart = gateItems?.some((item: any) => {
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
                    data.labSentBy = userName || 'Sistema';
                    data.labSentById = userId || null;
                }
            }

            // Stock decrement: when converting to SALE, atomically decrement stock.
            if (orderType === 'SALE') {
                // Si el mismo PATCH trae ítems nuevos (el vendedor cambió el armazón antes
                // de confirmar la venta), el stock debe descontarse de ESOS ítems, no de los
                // viejos de la DB (que ya se van a reemplazar). Antes se leían los viejos →
                // se descontaba stock del armazón removido y el nuevo quedaba sin descontar.
                let stockSourceItems: any[];
                if (items && Array.isArray(items)) {
                    const bodyProductIds = items.map((it: any) => it.productId).filter(Boolean);
                    const bodyProducts = await prisma.product.findMany({
                        where: { id: { in: bodyProductIds } },
                        select: { id: true, category: true, type: true, stock: true }
                    });
                    stockSourceItems = items.map((it: any) => {
                        const p = bodyProducts.find(bp => bp.id === it.productId);
                        return { productId: it.productId, quantity: it.quantity, product: p ? { category: p.category, type: p.type, stock: p.stock } : null };
                    });
                } else {
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
                    stockSourceItems = orderForStock?.items || [];
                }
                const stockItems = stockSourceItems.filter((item: any) => {
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
                const historyContent = `🛒 ${confirmedBy} confirmó el presupuesto #${updatedOrder.id.slice(-4).toUpperCase()} como VENTA por $${(updatedOrder.total || 0).toLocaleString('es-AR')}\n\nProductos:\n• ${saleSummaries}`;
                await prisma.interaction.create({
                    data: {
                        clientId: existingOrder.client.id,
                        type: 'SALE_CONFIRMED',
                        content: historyContent,
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
        // y el número de operación previo (para registrar altas/cambios/borrados).
        let prevState: { labStatus: string | null; status: string; labOrderNumber: string | null } | null = null;
        if (data.labStatus !== undefined || data.status !== undefined || data.labOrderNumber !== undefined) {
            prevState = await prisma.order.findUnique({
                where: { id },
                select: { labStatus: true, status: true, labOrderNumber: true }
            });
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
                client: {
                    select: { id: true, name: true, phone: true }
                }
            },
        });

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

        // ── Historial: alta/cambio/borrado del N° de operación de laboratorio ──
        // Queda registrado en la ficha quién lo tocó y con qué valor, para que un
        // número borrado (aun sin querer) siempre pueda recuperarse del historial.
        if (prevState && data.labOrderNumber !== undefined) {
            const prevNum = (prevState.labOrderNumber || '').trim();
            const newNum = (data.labOrderNumber || '').trim();
            if (prevNum !== newNum) {
                const shortId = id.slice(-4).toUpperCase();
                const who = userName || 'Sistema';
                let content: string;
                if (!prevNum && newNum) {
                    content = `🔢 ${who} cargó el N° de operación del pedido #${shortId}: ${newNum}`;
                } else if (prevNum && !newNum) {
                    content = `🔢 ${who} borró el N° de operación del pedido #${shortId} (era ${prevNum})`;
                } else {
                    content = `🔢 ${who} cambió el N° de operación del pedido #${shortId}: ${prevNum} → ${newNum}`;
                }
                await prisma.interaction.create({
                    data: {
                        clientId: order.clientId,
                        type: 'SISTEMA',
                        content,
                        userId: userId || null,
                        userName: who
                    }
                }).catch(err => console.error('Error registrando cambio de N° de operación en ficha:', err));
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
        if (labStatus === 'READY' && order.client.phone) {
            // Delegate sending logic and DB interaction updates to the background service
            // Note: In Next.js App Router, we avoid awaiting background non-critical tasks 
            // if we don't want to delay the API response, but for DB consistency it's fine.
            await BotService.notifyOrderReady(order);
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
                ...(prevState && data.labOrderNumber !== undefined && (prevState.labOrderNumber || '').trim() !== (data.labOrderNumber || '').trim() ? {
                    labOrderNumber: { from: prevState.labOrderNumber || null, to: data.labOrderNumber || null }
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
                                    ${row('Cobertura', caseInfo.coverage)}
                                    ${row('Costo Adicional', `$${caseInfo.cost || 0}`, 'color: #b91c1c; font-weight: bold;')}
                                    ${row('Opción en Lab', caseInfo.orderOption || 'No requiere', 'color: #1f2937; text-transform: uppercase; font-size: 12px; font-weight: bold;')}
                                    ${caseInfo.newOrderNumber ? row('N° de operación / nuevo pedido', caseInfo.newOrderNumber, 'color: #2563eb; font-family: monospace; font-weight: bold;') : ''}
                                </table>
                                ${notesBlock}
                                <div style="margin-top: 24px; text-align: center;">
                                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app'}/admin/ventas?orderId=${orderId}" style="display: inline-block; padding: 12px 24px; background-color: #d97706; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(217, 119, 6, 0.2);">Ver pedido en CRM</a>
                                </div>
                                <p style="margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px;">Este es un mensaje automático del Sistema de Gestión de Atelier Óptica.</p>
                            </div>
                        `;
}
