import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';

// POST /api/orders — Create order from inline cotizador
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientId, items, discount, total, frameSource, userFrameBrand, userFrameModel, userFrameNotes, markup, discountCash, discountTransfer, discountCard, subtotalWithMarkup } = body;

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

        const order = await prisma.order.create({
            data: {
                clientId,
                userId,
                status: 'PENDING',
                total: total || 0,
                paid: 0,
                discount: discount || 0,
                markup: Math.max(0, markup || 0),
                discountCash: discountCash || 0,
                discountTransfer: discountTransfer || 0,
                discountCard: discountCard || 0,
                subtotalWithMarkup: subtotalWithMarkup || 0,
                orderType: 'QUOTE',
                labStatus: 'NONE',
                frameSource: frameSource || null,
                userFrameBrand: userFrameBrand || null,
                userFrameModel: userFrameModel || null,
                userFrameNotes: userFrameNotes || null,
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
            include: {
                items: {
                    include: { product: true },
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

// GET /api/orders — List all orders
export async function GET() {
    try {
        const orders = await prisma.order.findMany({
            where: { isDeleted: false },
            include: {
                client: true,
                user: { select: { name: true } },
                items: { include: { product: true } },
                payments: true,
                invoices: true,
                prescription: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(orders);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
