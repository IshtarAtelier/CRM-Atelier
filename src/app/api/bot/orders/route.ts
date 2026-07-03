import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatOrderItemsSummary } from '@/lib/order-utils';
import { PricingService } from '@/services/PricingService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get('orderId');
        const orderNumber = searchParams.get('orderNumber');
        const clientId = searchParams.get('clientId');

        if (!orderId && !orderNumber && !clientId) {
            return NextResponse.json({ error: 'orderId, orderNumber o clientId es requerido' }, { status: 400 });
        }

        let order = null;

        if (orderId || orderNumber) {
            order = await prisma.order.findFirst({
                where: {
                    OR: [
                        { id: orderId || undefined },
                        { labOrderNumber: orderNumber || undefined }
                    ],
                    isDeleted: false
                },
                include: {
                    client: true,
                    items: {
                        include: {
                            product: true
                        }
                    },
                    payments: true
                }
            });
        } else if (clientId) {
            // Buscar el pedido relevante del cliente: primero una venta con saldo pendiente,
            // si no la venta más reciente, y como último recurso el presupuesto más reciente
            const sales = await prisma.order.findMany({
                where: { clientId, isDeleted: false, orderType: 'SALE' },
                include: { client: true, items: { include: { product: true } }, payments: true },
                orderBy: { createdAt: 'desc' }
            });

            order = sales.find(o => PricingService.calculateOrderFinancials(o).hasBalance) || sales[0] || null;

            if (!order) {
                order = await prisma.order.findFirst({
                    where: { clientId, isDeleted: false, orderType: 'QUOTE' },
                    include: { client: true, items: { include: { product: true } }, payments: true },
                    orderBy: { createdAt: 'desc' }
                });
            }
        }

        if (!order) {
            return NextResponse.json({ found: false });
        }

        // Desglose financiero oficial: exactamente el mismo cálculo que muestran
        // las vistas de saldos del CRM (ventas, pedidos, modales de pago)
        const financials = PricingService.calculateOrderFinancials(order);

        return NextResponse.json({ found: true, order, financials });
    } catch (error: any) {
        console.error('[Bot Bridge Orders GET] Error:', error);
        return NextResponse.json({ error: 'Error al consultar pedido' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientId, items, total, discountCash } = body;

        if (!clientId || !items || items.length === 0) {
            return NextResponse.json({ error: 'clientId y items son requeridos' }, { status: 400 });
        }

        const productIds = items.map((it: any) => it.productId).filter(Boolean);
        const dbProducts = await prisma.product.findMany({
            where: { id: { in: productIds } }
        });

        // Get an existing admin user to act as the SYSTEM creator
        let systemUser = await prisma.user.findFirst({
            where: { role: 'ADMIN' },
            orderBy: { createdAt: 'asc' }
        });

        if (!systemUser) {
            systemUser = await prisma.user.findFirst();
        }

        const fallbackUserId = systemUser ? systemUser.id : 'SYSTEM';

        // DEDUPLICATION GATE: Check for duplicate order creation (double click) within last 10 seconds
        const tenSecondsAgo = new Date(Date.now() - 10000);
        const duplicateOrder = await prisma.order.findFirst({
            where: {
                clientId,
                total: Math.round(total || 0),
                createdAt: { gte: tenSecondsAgo },
                isDeleted: false
            },
            include: {
                items: {
                    include: { product: true }
                }
            }
        });
        if (duplicateOrder) {
            console.log(`[DEDUPLICATION GATE BOT] Duplicate order detected for client ${clientId}. Returning existing order: ${duplicateOrder.id}`);
            return NextResponse.json(duplicateOrder);
        }

        // Create the Budget (Quote)
        const order = await prisma.order.create({
            data: {
                clientId,
                userId: fallbackUserId, // Marked as bot-created (using a real user ID)
                status: 'PENDING',
                orderType: 'QUOTE',
                total: Math.round(total || 0),
                paid: 0,
                discountCash: discountCash || 0,
                items: {
                    create: items.map((it: any) => {
                        const dbProd = dbProducts.find(p => p.id === it.productId);
                        return {
                            productId: it.productId,
                            quantity: it.quantity || 1,
                            price: it.price,
                            eye: it.eye || null,
                            productNameSnapshot: dbProd ? (dbProd.model || dbProd.name || null) : null,
                            productBrandSnapshot: dbProd ? (dbProd.brand || null) : null,
                            productCategorySnapshot: dbProd ? (dbProd.category || null) : null,
                            productCostSnapshot: dbProd ? (dbProd.cost || 0) : null,
                            laboratorySnapshot: dbProd ? (dbProd.laboratory || null) : null,
                        };
                    })
                }
            },
            include: {
                items: {
                    include: { product: true }
                }
            }
        });

        // Register interaction
        const itemSummaries = formatOrderItemsSummary(order.items);
        await prisma.interaction.create({
            data: {
                clientId,
                type: 'BUDGET_SENT',
                content: `🤖 Presupuesto generado automáticamente vía WhatsApp por $${order.total.toLocaleString('es-AR')}\n\nProductos:\n• ${itemSummaries}`
            }
        });

        return NextResponse.json(order);
    } catch (error: any) {
        console.error('[Bot Bridge Orders POST] Error:', error);
        return NextResponse.json({ error: 'Error al crear presupuesto' }, { status: 500 });
    }
}
