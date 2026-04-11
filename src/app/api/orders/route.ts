import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { calculateQuoteTotals, isMultifocal2x1 } from '@/lib/promo-utils';

// POST /api/orders — Create order from inline cotizador
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientId, items, discount, total, frameSource, userFrameBrand, userFrameModel, userFrameNotes, markup, discountCash, discountTransfer, discountCard, subtotalWithMarkup, prescriptionId } = body;

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

        // Calculate totals if missing or zero
        let finalSubtotalWithMarkup = subtotalWithMarkup;
        let finalTotal = total;
        let finalDiscount = discount || 0;

        if (!finalSubtotalWithMarkup || !finalTotal) {
            // To calculate totals correctly (including promos), we need the full product details
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
                allProducts
            );

            finalSubtotalWithMarkup = totals.subtotalWithMarkup;
            finalTotal = totals.totalCash;
            finalDiscount = discountCash || 0;
            
            // Auto-detect frame source if frames are in cart
            const hasFramesInCart = cartItems.some((it: any) => 
                it.product?.category === 'FRAME' || it.product?.category === 'ATELIER'
            );
            
            (body as any).effectiveFrameSource = frameSource || (hasFramesInCart ? 'OPTICA' : null);
            (body as any).calcPromoName = totals.appliedPromoName;
            (body as any).calcPromoDiscount = totals.promoFrameDiscount;
        }

        const order = await prisma.order.create({
            data: {
                clientId,
                userId,
                status: 'PENDING',
                total: Math.round(finalTotal),
                paid: 0,
                appliedPromoName: (body as any).calcPromoName || null,
                appliedPromoDiscount: (body as any).calcPromoDiscount || 0,
                discount: finalDiscount || 0,
                markup: Math.max(0, markup || 0),
                discountCash: discountCash || 0,
                discountTransfer: discountTransfer || 0,
                discountCard: discountCard || 0,
                subtotalWithMarkup: Math.round(finalSubtotalWithMarkup),
                orderType: 'QUOTE',
                labStatus: 'NONE',
                frameSource: (body as any).effectiveFrameSource || null,
                userFrameBrand: userFrameBrand || null,
                userFrameModel: userFrameModel || null,
                userFrameNotes: userFrameNotes || null,
                prescriptionId: prescriptionId || null,
                items: {
                    create: items.map((item: { productId: string; quantity: number; price: number; eye?: string; sphereVal?: number; cylinderVal?: number; axisVal?: number; additionVal?: number }) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        price: item.price,
                        eye: item.eye || null,
                        sphereVal: item.sphereVal ?? null,
                        cylinderVal: item.cylinderVal ?? null,
                        axisVal: item.axisVal ?? null,
                        additionVal: item.additionVal ?? null,
                    })),
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
                subtotalWithMarkup: true,
                frameSource: true,
                prescriptionId: true,
                items: {
                    select: {
                        id: true, price: true, quantity: true, eye: true,
                        sphereVal: true, cylinderVal: true, axisVal: true, additionVal: true,
                        product: { select: { id: true, name: true, brand: true, model: true, category: true, type: true, price: true, unitType: true } }
                    }
                },
            },
        });

        // Register quote in client history
        const itemSummaries = order.items.map((i: any) =>
            `${i.product?.brand || ''} ${i.product?.model || i.product?.name || ''} x${i.quantity}`.trim()
        );
        const historyContent = `📋 Presupuesto #${order.id.slice(-4).toUpperCase()} creado por $${(total || 0).toLocaleString('es-AR')}${discount ? ` (${discount}% desc. efvo)` : ''}${markup ? ` (+${markup}% markup)` : ''} — ${itemSummaries.join(', ')}`;
        await prisma.interaction.create({
            data: {
                clientId,
                type: 'BUDGET_SENT',
                content: historyContent,
            },
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

        // Base query conditions
        const where = { isDeleted: false };
        const select = {
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
            subtotalWithMarkup: true,
            frameSource: true,
            prescriptionId: true,
            isDeleted: true,
            client: { select: { id: true, name: true, phone: true, dni: true, email: true, status: true } },
            user: { select: { name: true } },
            items: {
                select: {
                    id: true, price: true, quantity: true, eye: true,
                    sphereVal: true, cylinderVal: true, axisVal: true, additionVal: true,
                    product: { select: { id: true, name: true, brand: true, model: true, category: true, type: true, price: true, unitType: true } }
                }
            },
            payments: { select: { id: true, amount: true, method: true, date: true, notes: true } },
            invoices: { select: { id: true, cae: true, voucherNumber: true, pointOfSale: true, totalAmount: true, status: true, billingAccount: true } },
            prescription: { select: { id: true, sphereOD: true, sphereOI: true, cylinderOD: true, cylinderOI: true, axisOD: true, axisOI: true, additionOD: true, additionOI: true, distanceOD: true, distanceOI: true, heightOD: true, heightOI: true, pd: true, addition: true } },
        };
        const orderBy: any = { createdAt: 'desc' };

        if (paginate) {
            const [orders, total] = await Promise.all([
                prisma.order.findMany({
                    where,
                    select,
                    orderBy,
                    skip,
                    take: limit,
                }),
                prisma.order.count({ where })
            ]);

            return NextResponse.json({
                orders,
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
