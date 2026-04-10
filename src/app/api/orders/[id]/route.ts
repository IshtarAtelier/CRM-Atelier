import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { ContactService } from '@/services/contact.service';
import { prisma } from '@/lib/db';
import { calculateQuoteTotals } from '@/lib/promo-utils';
import { z } from 'zod';

const OrderUpdateSchema = z.object({
    orderType: z.enum(['QUOTE', 'SALE']).optional(),
    total: z.number().optional(),
    markup: z.number().min(0).optional(),
    discountCash: z.number().optional(),
    prescriptionId: z.string().nullable().optional(),
    frameSource: z.enum(['OPTICA', 'USUARIO']).nullable().optional(),
    items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().min(1),
        price: z.number(),
    })).optional(),
});

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
        let finalItems = items;

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
                const hasPromo = cartItems.some(it => it.product?.is2x1);
                let allProducts: any[] = [];
                if (hasPromo) {
                    allProducts = await prisma.product.findMany({
                        where: { 
                            OR: [
                                { brand: { contains: 'Atelier', mode: 'insensitive' } },
                                { name: { contains: 'Atelier', mode: 'insensitive' } },
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

        if (labStatus) {
            data.labStatus = labStatus;
            if (labStatus === 'SENT') {
                data.labSentAt = new Date();
            }
        }

        if (labNotes !== undefined) data.labNotes = labNotes;
        if (labOrderNumber !== undefined) data.labOrderNumber = labOrderNumber;
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
                    item.product?.type === 'Cristal' || item.product?.category === 'LENS'
                );

                if (hasCrystals && !existingOrder.prescriptionId) {
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
                items: {
                    select: {
                        id: true, price: true, quantity: true, eye: true,
                        sphereVal: true, cylinderVal: true, axisVal: true, additionVal: true,
                        product: { select: { id: true, name: true, brand: true, model: true, category: true, type: true, price: true, stock: true } }
                    }
                },
                payments: true,
            },
        });
        return NextResponse.json(order);
    } catch (error: any) {
        console.error('Error updating order:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
