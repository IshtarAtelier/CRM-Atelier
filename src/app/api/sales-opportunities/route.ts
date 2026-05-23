import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const opportunities: any[] = [];

        // 1. Favoritos sin actividad (Favorite clients with no activity for 3 days)
        const favoriteClients = await prisma.client.findMany({
            where: {
                isFavorite: true,
                status: { not: 'CLIENT' },
                orders: {
                    none: {
                        orderType: 'SALE',
                        isDeleted: false
                    }
                }
            },
            select: {
                id: true,
                name: true,
                phone: true,
                status: true,
                interest: true,
                updatedAt: true,
                createdAt: true,
                interactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true }
                },
                orders: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true }
                },
                tasks: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true }
                },
                whatsappChats: {
                    orderBy: { lastMessageAt: 'desc' },
                    take: 1,
                    select: { lastMessageAt: true }
                }
            }
        });

        for (const client of favoriteClients) {
            const dates = [
                client.updatedAt,
                client.interactions[0]?.createdAt,
                client.orders[0]?.createdAt,
                client.tasks[0]?.createdAt,
                client.whatsappChats[0]?.lastMessageAt
            ].filter(Boolean) as Date[];

            const lastActivity = dates.length > 0
                ? new Date(Math.max(...dates.map(d => d.getTime())))
                : client.createdAt;

            if (lastActivity < threeDaysAgo) {
                const daysElapsed = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
                opportunities.push({
                    id: client.id,
                    type: 'STALLED_FAVORITE',
                    title: 'Favorito sin actividad',
                    clientName: client.name,
                    clientId: client.id,
                    phone: client.phone,
                    detail: `Sin actividad por ${daysElapsed} días`,
                    amount: null,
                    daysElapsed,
                    lastActivity: lastActivity.toISOString()
                });
            }
        }

        // 2. Presupuestos fríos (Pending quotes created > 3 days ago)
        const pendingQuotes = await prisma.order.findMany({
            where: {
                orderType: 'QUOTE',
                status: 'PENDING',
                isDeleted: false,
                createdAt: {
                    lt: threeDaysAgo
                },
                client: {
                    status: { not: 'CLIENT' },
                    orders: {
                        none: {
                            orderType: 'SALE',
                            isDeleted: false
                        }
                    }
                }
            },
            select: {
                id: true,
                total: true,
                createdAt: true,
                client: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                }
            }
        });

        for (const quote of pendingQuotes) {
            const daysElapsed = Math.floor((Date.now() - quote.createdAt.getTime()) / (1000 * 60 * 60 * 24));
            opportunities.push({
                id: quote.id,
                type: 'PENDING_QUOTE',
                title: 'Presupuesto frío',
                clientName: quote.client.name,
                clientId: quote.client.id,
                phone: quote.client.phone,
                detail: `Presupuesto de $${quote.total.toLocaleString('es-AR')} hace ${daysElapsed} días`,
                amount: quote.total,
                daysElapsed,
                lastActivity: quote.createdAt.toISOString()
            });
        }

        // 3. Carritos abandonados (Checkout sessions pending or abandoned > 24 hours ago)
        const abandonedCarts = await prisma.checkoutSession.findMany({
            where: {
                status: {
                    in: ['PENDING', 'ABANDONED']
                },
                createdAt: {
                    lt: oneDayAgo,
                    gt: sevenDaysAgo
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        for (const cart of abandonedCarts) {
            // Check if there is a client with this phone number who has already bought (status CLIENT or has active SALE)
            if (cart.phone) {
                const cleanedPhone = cart.phone.replace(/\D/g, '');
                if (cleanedPhone) {
                    const existingClient = await prisma.client.findFirst({
                        where: {
                            phone: { contains: cleanedPhone.slice(-8) }, // match last 8 digits for flexible matching
                            OR: [
                                { status: 'CLIENT' },
                                {
                                    orders: {
                                        some: {
                                            orderType: 'SALE',
                                            isDeleted: false
                                        }
                                    }
                                }
                            ]
                        }
                    });
                    if (existingClient) continue; // Skip since they are already a customer
                }
            }

            const daysElapsed = Math.floor((Date.now() - cart.createdAt.getTime()) / (1000 * 60 * 60 * 24));
            const hoursElapsed = Math.floor((Date.now() - cart.createdAt.getTime()) / (1000 * 60 * 60));
            const clientName = `${cart.firstName || ''} ${cart.lastName || ''}`.trim() || 'Cliente Web';
            opportunities.push({
                id: cart.id,
                type: 'ABANDONED_CART',
                title: 'Carrito abandonado',
                clientName,
                clientId: null,
                phone: cart.phone,
                detail: `Carrito de $${cart.total.toLocaleString('es-AR')} hace ${hoursElapsed >= 48 ? `${daysElapsed} días` : `${hoursElapsed} horas`}`,
                amount: cart.total,
                daysElapsed,
                lastActivity: cart.createdAt.toISOString()
            });
        }

        // Sort by days elapsed descending (most stalled/oldest first)
        opportunities.sort((a, b) => b.daysElapsed - a.daysElapsed);

        return NextResponse.json(opportunities);
    } catch (error) {
        console.error('Error fetching sales opportunities:', error);
        return NextResponse.json({
            error: 'Error al obtener oportunidades de ventas',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
