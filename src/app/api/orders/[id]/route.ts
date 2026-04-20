import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { ContactService } from '@/services/contact.service';
import { prisma } from '@/lib/db';
import { calculateQuoteTotals } from '@/lib/promo-utils';
import { z } from 'zod';

const OrderItemSchema = z.object({
    productId: z.string(),
    quantity: z.number().min(1),
    price: z.number(),
    eye: z.string().nullable().optional(),
    sphereVal: z.number().nullable().optional(),
    cylinderVal: z.number().nullable().optional(),
    axisVal: z.number().nullable().optional(),
    additionVal: z.number().nullable().optional(),
});

const OrderUpdateSchema = z.object({
    orderType: z.enum(['QUOTE', 'SALE']).optional(),
    total: z.number().optional(),
    markup: z.number().min(0).optional(),
    discountCash: z.number().optional(),
    discountTransfer: z.number().optional(),
    discountCard: z.number().optional(),
    subtotalWithMarkup: z.number().optional(),
    prescriptionId: z.string().nullable().optional(),
    frameSource: z.enum(['OPTICA', 'USUARIO']).nullable().optional(),
    userFrameBrand: z.string().nullable().optional(),
    userFrameModel: z.string().nullable().optional(),
    userFrameNotes: z.string().nullable().optional(),
    items: z.array(OrderItemSchema).optional(),
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
    // Promo
    appliedPromoName: z.string().nullable().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const order = await prisma.order.findUnique({
            where: { id },
            select: {
                id: true,
                clientId: true,
                status: true,
                orderType: true,
                total: true,
                paid: true,
                markup: true,
                discountCash: true,
                discountTransfer: true,
                discountCard: true,
                subtotalWithMarkup: true,
                frameSource: true,
                userFrameBrand: true,
                userFrameModel: true,
                userFrameNotes: true,
                prescriptionId: true,
                labStatus: true,
                createdAt: true,
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

        return NextResponse.json(response);
    } catch (error: any) {
        console.error('Error fetching order:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const reason = searchParams.get('reason') || 'Sin motivo especificado';
        // Read role from secure middleware header
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';

        // Only ADMIN can delete orders
        if (role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Solo el administrador puede eliminar operaciones. Solicitá la eliminación desde el panel de ventas.' },
                { status: 403 }
            );
        }

        const order = await ContactService.deleteOrder(id, reason);
        return NextResponse.json(order);
    } catch (error) {
        console.error('Error deleting order:', error);
        return NextResponse.json({ error: 'Error al eliminar el pedido' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        
        // Validation Layer (Bouncer)
        const validation = OrderUpdateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ 
                error: 'Datos inválidos', 
                details: validation.error.format() 
            }, { status: 400 });
        }

        // ── Guard: prevent editing items/pricing on SALE orders ──
        // Lab status, notes, and frame measurements can still be updated on sales.
        if (body.items) {
            const existing = await prisma.order.findUnique({
                where: { id },
                select: { orderType: true }
            });
            if (existing?.orderType === 'SALE') {
                return NextResponse.json(
                    { error: 'No se pueden modificar los ítems de una venta confirmada. Solicitá reapertura al administrador.' },
                    { status: 403 }
                );
            }
        }

        const { 
            labStatus, labNotes, orderType, labOrderNumber, 
            frameSource, userFrameBrand, userFrameModel, userFrameNotes, 
            labColor, labTreatment, labDiameter, labPdOd, labPdOi, 
            frameA, frameB, frameDbl, frameEdc, smartLabScreenshot,
            labPrismOD, labPrismOI, labBaseCurve, labFrameType, labBevelPosition,
            prescriptionId, items, total, markup, 
            discountCash, discountTransfer, discountCard, subtotalWithMarkup
        } = body;

        const data: any = {};
        
        // Use existing values if not provided in body (need to fetch order first if totals are missing)
        let finalMarkup = markup;
        let finalDiscountCash = discountCash;

        if (items || markup !== undefined || discountCash !== undefined) {
            const currentOrder = await prisma.order.findUnique({
                where: { id },
                select: {
                    id: true, total: true, markup: true, discountCash: true, orderType: true,
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
                    allProducts
                );

                data.subtotalWithMarkup = totals.subtotalWithMarkup;
                data.total = totals.totalCash;
                data.appliedPromoName = totals.appliedPromoName;
                data.appliedPromoDiscount = totals.promoFrameDiscount;
            }
        }

        // Override with explicit body values if they were provided and we want to trust them
        if (total !== undefined) data.total = Math.round(total);
        if (subtotalWithMarkup !== undefined) data.subtotalWithMarkup = Math.round(subtotalWithMarkup);
        
        if (markup !== undefined) data.markup = Math.max(0, markup);
        if (discountCash !== undefined) data.discountCash = discountCash;
        if (discountTransfer !== undefined) data.discountTransfer = discountTransfer;
        if (discountCard !== undefined) data.discountCard = discountCard;

        if (items && Array.isArray(items)) {
            data.items = {
                deleteMany: {},
                create: items.map((item: any) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                    eye: item.eye || null,
                    sphereVal: item.sphereVal ?? null,
                    cylinderVal: item.cylinderVal ?? null,
                    axisVal: item.axisVal ?? null,
                    additionVal: item.additionVal ?? null,
                })),
            };
        }

        // ── FACTORY GATE: Validate requirements before sending to lab ──
        // This applies when labStatus is being set to SENT or higher (any advancement from NONE)
        const LAB_SENT_STATUSES = ['SENT', 'IN_PROGRESS', 'READY', 'DELIVERED'];
        if (labStatus && LAB_SENT_STATUSES.includes(labStatus)) {
            // Fetch the full order with items, prescription, and payments
            const orderForValidation = await prisma.order.findUnique({
                where: { id },
                select: {
                    id: true,
                    total: true,
                    paid: true,
                    labStatus: true,
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
                    }
                }
            });

            if (orderForValidation) {
                // Only validate when advancing FROM NONE (first time sending)
                const currentLabStatus = orderForValidation.labStatus || 'NONE';
                const isFirstSend = currentLabStatus === 'NONE';

                if (isFirstSend) {
                    const errors: string[] = [];

                    // 1. Crystal validations
                    const hasCrystals = orderForValidation.items.some((item: any) =>
                        item.product?.category === 'LENS' || 
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

                    // 2. Payment validation: total paid must be >= 40% of order total
                    const totalPaid = orderForValidation.paid || 0;
                    const minRequired = (orderForValidation.total || 0) * 0.4;
                    if (totalPaid < minRequired) {
                        errors.push(`El pago ($${Math.round(totalPaid).toLocaleString()}) no cubre el 40% mínimo ($${Math.ceil(minRequired).toLocaleString()}) para enviar a fábrica.`);
                    }

                    // 3. All payments must have method specified
                    const paymentsWithoutMethod = (orderForValidation.payments || []).filter(
                        (p: any) => !p.method || p.method.trim() === ''
                    );
                    if (paymentsWithoutMethod.length > 0) {
                        errors.push(`Hay ${paymentsWithoutMethod.length} pago(s) sin método de pago especificado.`);
                    }

                    if (errors.length > 0) {
                        return NextResponse.json({
                            error: `No se puede enviar a fábrica:\n${errors.join('\n')}`
                        }, { status: 400 });
                    }
                }
            }
        }

        if (labStatus) {
            data.labStatus = labStatus;
            if (labStatus === 'SENT') {
                data.labSentAt = new Date();
            }
        }

        if (labNotes !== undefined) data.labNotes = labNotes;
        if (labOrderNumber !== undefined) {
            data.labOrderNumber = labOrderNumber;
            // Auto-set status to SENT (Procesado) when operation number is loaded
            if (labOrderNumber && labOrderNumber.trim() !== '' && !labStatus) {
                const currentOrder = await prisma.order.findUnique({
                    where: { id },
                    select: { labStatus: true }
                });
                // Only auto-advance if still in NONE (Pendiente)
                if (!currentOrder?.labStatus || currentOrder.labStatus === 'NONE') {
                    data.labStatus = 'SENT';
                    data.labSentAt = new Date();
                }
            }
        }
        if (prescriptionId !== undefined) data.prescriptionId = prescriptionId;

        // Frame data updates
        if (frameSource !== undefined) data.frameSource = frameSource;
        if (userFrameBrand !== undefined) data.userFrameBrand = userFrameBrand;
        if (userFrameModel !== undefined) data.userFrameModel = userFrameModel;
        if (userFrameNotes !== undefined) data.userFrameNotes = userFrameNotes;

        // SmartLab lab fields
        if (labColor !== undefined) data.labColor = labColor;
        if (labTreatment !== undefined) data.labTreatment = labTreatment;
        if (labDiameter !== undefined) data.labDiameter = labDiameter;
        if (labPdOd !== undefined) data.labPdOd = labPdOd;
        if (labPdOi !== undefined) data.labPdOi = labPdOi;

        // Frame measurement fields (for SmartLab) - Temporarily disabled to avoid DB error until migration
        // if (frameA !== undefined) data.frameA = frameA;
        // if (frameB !== undefined) data.frameB = frameB;
        // if (frameDbl !== undefined) data.frameDbl = frameDbl;
        // if (frameEdc !== undefined) data.frameEdc = frameEdc;
        if (smartLabScreenshot !== undefined) data.smartLabScreenshot = smartLabScreenshot;

        // High-precision lab fields
        if (labPrismOD !== undefined) data.labPrismOD = labPrismOD;
        if (labPrismOI !== undefined) data.labPrismOI = labPrismOI;
        if (labBaseCurve !== undefined) data.labBaseCurve = labBaseCurve;
        if (labFrameType !== undefined) data.labFrameType = labFrameType;
        if (labBevelPosition !== undefined) data.labBevelPosition = labBevelPosition;

        if (orderType) {
            // Prevent reverting a SALE back to QUOTE
            if (orderType === 'QUOTE') {
                const current = await prisma.order.findUnique({ 
                    where: { id },
                    select: { orderType: true }
                });
                if (current?.orderType === 'SALE') {
                    return NextResponse.json(
                        { error: 'No se puede revertir una venta a presupuesto' },
                        { status: 400 }
                    );
                }
            }
            // Validation: when converting QUOTE → SALE
            if (orderType === 'SALE') {
                const existingOrder = await prisma.order.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        total: true,
                        paid: true,
                        orderType: true,
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
                        payments: true
                    },
                });

                if (!existingOrder) {
                    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
                }

                // Check: client must have name and phone at minimum
                const client = existingOrder.client;
                if (!client?.name || !client?.phone || !client?.dni || !client?.address) {
                    return NextResponse.json({
                        error: 'La ficha del contacto debe estar completa (nombre, teléfono, DNI y dirección obligatorios)'
                    }, { status: 400 });
                }

                // Check: 40% minimum payment
                const minRequired = (existingOrder.total || 0) * 0.4;
                const totalPaid = existingOrder.paid || 0;
                if (totalPaid < minRequired) {
                    return NextResponse.json({
                        error: `Se requiere un pago mínimo del 40% ($${Math.ceil(minRequired).toLocaleString()}) para convertir en venta. Pagado: $${totalPaid.toLocaleString()}`
                    }, { status: 400 });
                }

                // Check: if order has crystals, frame info must be set
                const hasCrystals = existingOrder.items?.some((item: any) =>
                    item.product?.type === 'Cristal' || item.product?.category === 'LENS' || (item.product?.name || '').includes('Cristal')
                );

                const effectiveRxId = prescriptionId || existingOrder.prescriptionId;

                if (hasCrystals && !effectiveRxId) {
                    return NextResponse.json({
                        error: 'Si el pedido incluye cristales, debe tener una receta seleccionada'
                    }, { status: 400 });
                }

                const hasFramesInCart = existingOrder.items?.some((item: any) =>
                    item.product?.category === 'FRAME' || item.product?.category === 'ATELIER'
                );

                const effectiveFrameSource = frameSource || existingOrder.frameSource || (hasFramesInCart ? 'OPTICA' : null);
                if (hasCrystals && !effectiveFrameSource) {
                    return NextResponse.json({
                        error: 'Si el pedido incluye cristales, debe seleccionar un armazón (de la óptica o del usuario)'
                    }, { status: 400 });
                }
                if (hasCrystals && effectiveFrameSource === 'USUARIO') {
                    const effBrand = userFrameBrand || existingOrder.userFrameBrand;
                    const effModel = userFrameModel || existingOrder.userFrameModel;
                    if (!effBrand && !effModel) {
                        return NextResponse.json({
                            error: 'Debe completar al menos la marca o modelo del armazón del usuario'
                        }, { status: 400 });
                    }
                }

                // Check: stock availability for non-crystal products
                const stockItems = (existingOrder.items || []).filter((item: any) => {
                    const cat = item.product?.category;
                    const type = item.product?.type;
                    const isCrystal = cat === 'LENS' || (type || '').includes('Cristal');
                    return !isCrystal;
                });
                const insufficientStock: string[] = [];
                for (const item of stockItems) {
                    const product = item.product;
                    if (product && product.stock < item.quantity) {
                        const name = `${product.brand || ''} ${product.model || product.name || ''}`.trim();
                        insufficientStock.push(`${name}: stock ${product.stock}, necesitás ${item.quantity}`);
                    } else if (!product) {
                        // If product is missing, we treat it as an error or just skip? 
                        // Usually it shouldn't happen during conversion if it was valid before.
                    }
                }
                if (insufficientStock.length > 0) {
                    return NextResponse.json({
                        error: `Stock insuficiente:\n${insufficientStock.join('\n')}`
                    }, { status: 400 });
                }
            }

            data.orderType = orderType;
            // When converting to SALE, automatically send to lab
            if (orderType === 'SALE' && !labStatus) {
                data.labStatus = 'SENT';
                data.labSentAt = new Date();
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
                    return !(cat === 'LENS' || (type || '').includes('Cristal'));
                });

                const stockUpdates = stockItems
                    .filter((item: any) => item.productId)
                    .map((item: any) =>
                    prisma.product.update({
                        where: { id: item.productId },
                        data: { stock: { decrement: item.quantity } },
                    })
                );

                const [updatedOrder] = await prisma.$transaction([
                    prisma.order.update({
                        where: { id },
                        data,
                        select: {
                            id: true,
                            items: {
                                select: {
                                    id: true, price: true, quantity: true, eye: true,
                                    sphereVal: true, cylinderVal: true, axisVal: true, additionVal: true, pdVal: true, heightVal: true, prismVal: true,
                                    product: { select: { id: true, name: true, brand: true, model: true, category: true, type: true, price: true, stock: true } }
                                }
                            },
                            payments: true,
                            prescription: true,
                        },
                    }),
                    ...stockUpdates,
                ]);

                // Populate per-eye prescription values on crystal OrderItems
                if (updatedOrder.prescription) {
                    const rx = updatedOrder.prescription;
                    const crystalItemUpdates = updatedOrder.items
                        .filter((item: any) => {
                            const cat = item.product?.category;
                            const type = item.product?.type;
                            return cat === 'LENS' || (type || '').includes('Cristal');
                        })
                        .map((item: any) => {
                            const isOD = item.eye === 'OD';
                            const isOI = item.eye === 'OI';
                            if (!isOD && !isOI) return null;
                            return prisma.orderItem.update({
                                where: { id: item.id },
                                data: {
                                    sphereVal: isOD ? rx.sphereOD : rx.sphereOI,
                                    cylinderVal: isOD ? rx.cylinderOD : rx.cylinderOI,
                                    axisVal: isOD ? rx.axisOD : rx.axisOI,
                                    additionVal: isOD ? (rx.additionOD ?? rx.addition) : (rx.additionOI ?? rx.addition),
                                },
                            });
                        })
                        .filter(Boolean);
                    if (crystalItemUpdates.length > 0) {
                        await prisma.$transaction(crystalItemUpdates as any[]);
                    }
                }

                return NextResponse.json(updatedOrder);
            }
        }

        const order = await prisma.order.update({
            where: { id },
            data,
            select: {
                id: true,
                clientId: true,
                items: {
                    select: {
                        id: true, price: true, quantity: true, eye: true,
                        sphereVal: true, cylinderVal: true, axisVal: true, additionVal: true,
                        product: { select: { id: true, name: true, brand: true, model: true, category: true, type: true, price: true, stock: true } }
                    }
                },
                payments: true,
                client: {
                    select: { name: true }
                }
            },
        });

        // ── Auto-Task: Request Review when DELIVERED ──
        if (labStatus === 'DELIVERED') {
            const taskDescription = `Solicitar comentario a ${order.client.name}`;
            
            // Avoid duplicate pending tasks
            const existingTask = await prisma.clientTask.findFirst({
                where: {
                    clientId: order.clientId,
                    description: taskDescription,
                    status: 'PENDING'
                }
            });

            if (!existingTask) {
                await ContactService.addTask(order.clientId, taskDescription);
            }
        }

        // ── Auto-Notify: WhatsApp pickup when READY ──
        if (labStatus === 'READY' && order.client.phone) {
            try {
                const total = order.total || 0;
                const paid = (order.payments || []).reduce((acc: number, p: any) => acc + p.amount, 0);
                const saldo = total - paid;
                
                let message = `¡Hola ${order.client.name}! 👋 Tus anteojos ya están listos para retirar en Atelier Óptica (Tejeda 4380).`;
                
                if (saldo > 0) {
                    message += ` El saldo pendiente es de $${Math.round(saldo).toLocaleString()}. ¡Te esperamos!`;
                } else {
                    message += ` ¡Te esperamos pronto para la entrega!`;
                }

                // Send via internal WA server proxy
                const WA_SERVER = 'http://localhost:3100';
                await fetch(`${WA_SERVER}/api/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        chatId: `${order.client.phone.replace(/\D/g, '')}@c.us`, 
                        message 
                    }),
                });

                // Log interaction
                await prisma.interaction.create({
                    data: {
                        clientId: order.clientId,
                        type: 'NOTE',
                        content: `🤖 Notificación automática enviada: Listo para retirar. Saldo informado: $${saldo.toLocaleString()}`
                    }
                });
            } catch (e: any) {
                console.error('[Auto-Notify READY] Error:', e.message);
            }
        }

        return NextResponse.json(order);
    } catch (error: any) {
        console.error('Error updating order:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
