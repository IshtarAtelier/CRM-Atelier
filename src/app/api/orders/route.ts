import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { calculateQuoteTotals, isMultifocal2x1 } from '@/lib/promo-utils';
import { formatOrderItemsSummary } from '@/lib/order-utils';
import { PricingService } from '@/services/PricingService';

// POST /api/orders — Create order from inline cotizador
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientId, items, discount, total, frameSource, userFrameBrand, userFrameModel, userFrameNotes, markup, discountCash, discountTransfer, discountCard, subtotalWithMarkup, prescriptionId, specialDiscount } = body;

        if (!clientId || !items || items.length === 0) {
            return NextResponse.json({ error: 'clientId and items are required' }, { status: 400 });
        }

        // Validate markup is never negative
        if (markup !== undefined && markup < 0) {
            return NextResponse.json({ error: 'El markup no puede ser negativo' }, { status: 400 });
        }

        // Get user from middleware headers
        const headersList = await headers();
        const userId = headersList.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
        }

        // Fetch all products in the cart for snapshot saving and total calculations
        const productIds = items.map((it: any) => it.productId).filter(Boolean);
        const dbProducts = await prisma.product.findMany({
            where: { id: { in: productIds } }
        });

        // Map items for calculateQuoteTotals utility
        const cartItems = items.map((it: any) => ({
            product: dbProducts.find(p => p.id === it.productId) || { price: it.price },
            quantity: it.quantity,
            customPrice: it.price
        }));

        // Fetch all products for Atelier average price calculation (only if needed by a 2x1 promo)
        const hasPromo = cartItems.some((it: any) => isMultifocal2x1(it.product));
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
            markup || 0, 
            discountCash || 0, 
            allProducts,
            specialDiscount || 0
        );

        const finalSubtotalWithMarkup = totals.subtotalWithMarkup;
        const finalTotal = totals.totalCash; // Reports use sum of payments, this is for balance display only
        const finalDiscount = discountCash || 0;
        
        // Auto-detect frame source if frames are in cart
        const hasFramesInCart = cartItems.some((it: any) => {
            const cat = (it.product?.category || '').toLowerCase();
            return cat === 'frame' || cat === 'atelier' || cat === 'armazón de receta' || cat.includes('armazon') || cat.includes('armazón');
        });
        
        const effectiveFrameSource = frameSource || (hasFramesInCart ? 'OPTICA' : null);
        const calcPromoName = totals.appliedPromoName;
        const calcPromoDiscount = totals.promoFrameDiscount;

        // DEDUPLICATION GATE: Check for duplicate order creation (double click) within last 10 seconds, locking client
        const order = await prisma.$transaction(async (tx) => {
            // Lock the client row to serialize concurrent order postings for the same client
            await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${clientId} FOR UPDATE`;

            const tenSecondsAgo = new Date(Date.now() - 10000);
            const duplicateOrder = await tx.order.findFirst({
                where: {
                    clientId,
                    total: Math.round(finalTotal),
                    createdAt: { gte: tenSecondsAgo },
                    isDeleted: false
                },
                select: {
                    id: true,
                    total: true,
                    paid: true,
                    status: true,
                    orderType: true,
                    createdAt: true,
                    labStatus: true,
                    clientId: true,
                    userId: true,
                    discount: true,
                    markup: true,
                    discountCash: true,
                    discountTransfer: true,
                    discountCard: true,
                    specialDiscount: true,
                    subtotalWithMarkup: true,
                    frameSource: true,
                    prescriptionId: true,
                    items: {
                        select: {
                            id: true, price: true, quantity: true, eye: true,
                            sphereVal: true, cylinderVal: true, axisVal: true, additionVal: true,
                            crystalColor: true, crystalColorType: true,
                            productNameSnapshot: true, productBrandSnapshot: true, productCategorySnapshot: true,
                            product: { select: { id: true, name: true, brand: true, model: true, category: true, type: true, price: true, unitType: true } }
                        }
                    },
                }
            });
            if (duplicateOrder) {
                console.log(`[DEDUPLICATION GATE] Duplicate order detected for client ${clientId}. Returning existing order: ${duplicateOrder.id}`);
                return duplicateOrder;
            }

            const createdOrder = await tx.order.create({
                data: {
                    clientId,
                    userId,
                    status: 'PENDING',
                    total: Math.round(finalTotal),
                    paid: 0,
                    appliedPromoName: calcPromoName || null,
                    appliedPromoDiscount: calcPromoDiscount || 0,
                    discount: finalDiscount || 0,
                    markup: Math.max(0, markup || 0),
                    discountCash: discountCash || 0,
                    discountTransfer: discountTransfer || 0,
                    discountCard: discountCard || 0,
                    specialDiscount: specialDiscount || 0,
                    subtotalWithMarkup: Math.round(finalSubtotalWithMarkup),
                    orderType: 'QUOTE',
                    labStatus: 'NONE',
                    frameSource: effectiveFrameSource || null,
                    userFrameBrand: userFrameBrand || null,
                    userFrameModel: userFrameModel || null,
                    userFrameNotes: userFrameNotes || null,
                    prescriptionId: prescriptionId || null,
                    items: {
                        create: items.map((item: { productId: string; quantity: number; price: number; eye?: string; sphereVal?: number; cylinderVal?: number; axisVal?: number; additionVal?: number; crystalColor?: string; crystalColorType?: string }) => {
                            const dbProd = dbProducts.find(p => p.id === item.productId);
                            return {
                                productId: item.productId,
                                quantity: item.quantity,
                                price: item.price,
                                eye: item.eye || null,
                                sphereVal: item.sphereVal ?? null,
                                cylinderVal: item.cylinderVal ?? null,
                                axisVal: item.axisVal ?? null,
                                additionVal: item.additionVal ?? null,
                                crystalColor: item.crystalColor || null,
                                crystalColorType: item.crystalColorType || null,
                                productNameSnapshot: dbProd ? (dbProd.model || dbProd.name || null) : null,
                                productBrandSnapshot: dbProd ? (dbProd.brand || null) : null,
                                productCategorySnapshot: dbProd ? (dbProd.category || null) : null,
                            };
                        }),
                    },
                },
                select: {
                    id: true,
                    total: true,
                    paid: true,
                    status: true,
                    orderType: true,
                    createdAt: true,
                    labStatus: true,
                    clientId: true,
                    userId: true,
                    discount: true,
                    markup: true,
                    discountCash: true,
                    discountTransfer: true,
                    discountCard: true,
                    specialDiscount: true,
                    subtotalWithMarkup: true,
                    frameSource: true,
                    prescriptionId: true,
                    items: {
                        select: {
                            id: true, price: true, quantity: true, eye: true,
                            sphereVal: true, cylinderVal: true, axisVal: true, additionVal: true,
                            crystalColor: true, crystalColorType: true,
                            productNameSnapshot: true, productBrandSnapshot: true, productCategorySnapshot: true,
                            product: { select: { id: true, name: true, brand: true, model: true, category: true, type: true, price: true, unitType: true } }
                        }
                    },
                }
            });

            // Register quote in client history inside transaction
            const itemSummaries = formatOrderItemsSummary(createdOrder.items);
            const historyContent = `📋 Presupuesto #${createdOrder.id.slice(-4).toUpperCase()} creado por $${(total || 0).toLocaleString('es-AR')}${discount ? ` (${discount}% desc. efvo)` : ''}${markup ? ` (+${markup}% markup)` : ''}\n\nProductos:\n• ${itemSummaries}`;
            await tx.interaction.create({
                data: {
                    clientId,
                    type: 'BUDGET_SENT',
                    content: historyContent,
                },
            });

            return createdOrder;
        });

        return NextResponse.json(order);
    } catch (error: any) {
        console.error('Error creating order:', error);
        return NextResponse.json({ error: error.message || 'Error creating order' }, { status: 500 });
    }
}

// GET /api/orders — List all orders (paginated or limited list)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const paginate = searchParams.get('paginate') === 'true';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const skip = (page - 1) * limit;

        const typeFilter = searchParams.get('type');
        const searchTerm = searchParams.get('search');
        const nolimit = searchParams.get('nolimit') === 'true';
        const hasBalance = searchParams.get('hasBalance') === 'true';
        const labStatus = searchParams.get('labStatus');
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        const laboratory = searchParams.get('laboratory');

        // Base query conditions
        const where: any = { isDeleted: false };
        const andConditions: any[] = [];

        if (laboratory) {
            andConditions.push({
                items: {
                    some: {
                        product: {
                            category: 'Cristal',
                            laboratory: laboratory
                        }
                    }
                }
            });
        }

        if (typeFilter) {
            andConditions.push({ orderType: typeFilter });
        }

        if (searchTerm) {
            const words = searchTerm.trim().split(/\s+/).filter(Boolean);
            if (words.length > 0) {
                andConditions.push({
                    AND: words.map(word => ({
                        OR: [
                            { client: { name: { contains: word, mode: 'insensitive' } } },
                            { labOrderNumber: { contains: word, mode: 'insensitive' } },
                            { id: { contains: word, mode: 'insensitive' } },
                        ]
                    }))
                });
            }
        }

        if (labStatus) {
            if (labStatus === 'NONE') {
                andConditions.push({
                    OR: [
                        { labStatus: null },
                        { labStatus: 'NONE' }
                    ]
                });
            } else {
                andConditions.push({ labStatus: labStatus });
            }
        }

        if (dateFrom || dateTo) {
            const dateCond: any = {};
            if (dateFrom) {
                dateCond.gte = new Date(dateFrom);
            }
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                dateCond.lte = toDate;
            }
            // Filtrar estrictamente por la fecha en que se pasó a venta / envío a fábrica (labSentAt)
            // Si es un presupuesto o venta sin procesar (labSentAt es null), usamos createdAt
            andConditions.push({
                OR: [
                    { labSentAt: dateCond },
                    {
                        AND: [
                            { labSentAt: null },
                            { createdAt: dateCond }
                        ]
                    }
                ]
            });
        }



        if (andConditions.length > 0) {
            where.AND = andConditions;
        }

        const select = {
            id: true,
            total: true,
            paid: true,
            status: true,
            orderType: true,
            createdAt: true,
            updatedAt: true,
            labStatus: true,
            clientId: true,
            userId: true,
            discount: true,
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
            frameA: true,
            frameB: true,
            frameDbl: true,
            frameEdc: true,
            prescriptionId: true,
            isDeleted: true,
            client: { select: { id: true, name: true, phone: true, dni: true, email: true, status: true } },
            user: { select: { name: true } },
            items: {
                select: {
                    id: true, price: true, quantity: true, eye: true,
                    sphereVal: true, cylinderVal: true, axisVal: true, additionVal: true,
                    pdVal: true, heightVal: true, prismVal: true,
                    crystalColor: true, crystalColorType: true,
                    productNameSnapshot: true, productBrandSnapshot: true, productCategorySnapshot: true,
                    product: { select: { id: true, name: true, brand: true, model: true, category: true, type: true, price: true, unitType: true, laboratory: true } }
                }
            },
            payments: { select: { id: true, amount: true, method: true, date: true, notes: true, receiptUrl: true } },
            invoices: { select: { id: true, cae: true, voucherNumber: true, pointOfSale: true, totalAmount: true, status: true, billingAccount: true, createdAt: true } },
            prescription: { select: { id: true, sphereOD: true, sphereOI: true, cylinderOD: true, cylinderOI: true, axisOD: true, axisOI: true, additionOD: true, additionOI: true, distanceOD: true, distanceOI: true, heightOD: true, heightOI: true, pd: true, addition: true, prescriptionType: true, notes: true, imageUrl: true, prismOD: true, prismOI: true, nearSphereOD: true, nearSphereOI: true, nearCylinderOD: true, nearAxisOD: true, nearCylinderOI: true, nearAxisOI: true } },
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
            smartLabEntryDate: true,
            smartLabDays: true,
            smartLabDetails: true,
            labFrameShape: true,
            labFrameDetails: true,
        };
        const orderBy: any = [
            { labSentAt: { sort: 'desc', nulls: 'first' } },
            { createdAt: 'desc' }
        ];

        if (hasBalance) {
            const rawIds: {id: string}[] = await prisma.$queryRaw`
                SELECT id
                FROM "Order"
                WHERE "isDeleted" = false AND COALESCE("subtotalWithMarkup", "total", 0) - COALESCE("paid", 0) > 500
            `;
            const candidateIds = rawIds.map(r => r.id);
            
            if (candidateIds.length === 0) {
                if (paginate) {
                    return NextResponse.json({ orders: [], totalRevenue: 0, pagination: { total: 0, page, limit, totalPages: 0 } });
                } else {
                    return NextResponse.json([]);
                }
            }

            where.id = { in: candidateIds };

            // When filtering by balance, we retrieve matching records, filter in-memory, and manually paginate.
            const allMatchingOrders = await prisma.order.findMany({
                where,
                select,
                orderBy,
            });

            const ordersWithBalance = allMatchingOrders.filter((o: any) => {
                const financials = PricingService.calculateOrderFinancials(o);
                return financials.hasBalance;
            });

            if (paginate) {
                const total = ordersWithBalance.length;
                const totalRevenue = ordersWithBalance.reduce((s: number, o: any) => s + (o.total || 0), 0);
                const paginated = ordersWithBalance.slice(skip, skip + limit);
                return NextResponse.json({
                    orders: paginated,
                    totalRevenue,
                    pagination: {
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit)
                    }
                });
            } else {
                return NextResponse.json(ordersWithBalance);
            }
        }

        if (paginate) {
            const [orders, total, aggregate] = await Promise.all([
                prisma.order.findMany({
                    where,
                    select,
                    orderBy,
                    skip: nolimit ? undefined : skip,
                    take: nolimit ? undefined : limit,
                }),
                prisma.order.count({ where }),
                prisma.order.aggregate({ _sum: { total: true }, where })
            ]);

            return NextResponse.json({
                orders,
                totalRevenue: aggregate._sum.total || 0,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } else {
            // Limited list for backwards compatibility
            const orders = await prisma.order.findMany({
                where,
                select,
                orderBy,
                take: 100, // Safety limit to avoid 502/timeouts
            });
            return NextResponse.json(orders);
        }
    } catch (error: any) {
        console.error('Error fetching orders:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
