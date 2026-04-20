import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get('orderId');
        const orderNumber = searchParams.get('orderNumber');

        if (!orderId && !orderNumber) {
            return NextResponse.json({ error: 'orderId o orderNumber es requerido' }, { status: 400 });
        }

        const order = await prisma.order.findFirst({
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

        if (!order) {
            return NextResponse.json({ found: false });
        }

        return NextResponse.json({ found: true, order });
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

        // Create the Budget (Quote)
        const order = await prisma.order.create({
            data: {
                clientId,
                userId: 'SYSTEM', // Marked as bot-created
                status: 'PENDING',
                orderType: 'QUOTE',
                total: Math.round(total || 0),
                paid: 0,
                discountCash: discountCash || 0,
                items: {
                    create: items.map((it: any) => ({
                        productId: it.productId,
                        quantity: it.quantity || 1,
                        price: it.price,
                        eye: it.eye || null
                    }))
                }
            },
            include: {
                items: {
                    include: { product: true }
                }
            }
        });

        // Register interaction
        const itemNames = order.items.map(i => `${i.product?.brand || ''} ${i.product?.model || i.product?.name || ''}`).join(', ');
        await prisma.interaction.create({
            data: {
                clientId,
                type: 'BUDGET_SENT',
                content: `🤖 Presupuesto generado automáticamente vía WhatsApp por $${order.total.toLocaleString()}. Productos: ${itemNames}`
            }
        });

        return NextResponse.json(order);
    } catch (error: any) {
        console.error('[Bot Bridge Orders POST] Error:', error);
        return NextResponse.json({ error: 'Error al crear presupuesto' }, { status: 500 });
    }
}
