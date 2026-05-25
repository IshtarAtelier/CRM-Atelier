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
                status: { notIn: ['CLIENT', 'active'] },
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
                    select: { createdAt: true, total: true }
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
                },
                prescriptions: {
                    orderBy: { date: 'desc' },
                    take: 1,
                    select: {
                        sphereOD: true,
                        cylinderOD: true,
                        additionOD: true,
                        sphereOI: true,
                        cylinderOI: true,
                        additionOI: true
                    }
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
                const latestRx = client.prescriptions[0];
                const latestOrder = client.orders[0];

                const isHighValue = 
                    // Alto valor (monto >= 250.000)
                    (latestOrder && latestOrder.total >= 250000) ||
                    // Graduaciones altas (abs >= 4 esfera o abs >= 2 cilindro)
                    (latestRx && (
                        Math.abs(latestRx.sphereOD || 0) >= 4.0 ||
                        Math.abs(latestRx.sphereOI || 0) >= 4.0 ||
                        Math.abs(latestRx.cylinderOD || 0) >= 2.0 ||
                        Math.abs(latestRx.cylinderOI || 0) >= 2.0
                    )) ||
                    // Multifocales (tiene adición)
                    (latestRx && (latestRx.additionOD != null || latestRx.additionOI != null)) ||
                    // Interés en multifocales, miopía o control miópico
                    (client.interest && (
                        client.interest.toLowerCase().includes('multifocal') ||
                        client.interest.toLowerCase().includes('progresivo') ||
                        client.interest.toLowerCase().includes('bifocal') ||
                        client.interest.toLowerCase().includes('miop') ||
                        client.interest.toLowerCase().includes('myofix') ||
                        client.interest.toLowerCase().includes('myolens') ||
                        client.interest.toLowerCase().includes('myopilux')
                    ));

                if (!isHighValue) continue;

                const daysElapsed = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
                opportunities.push({
                    id: client.id,
                    type: 'STALLED_FAVORITE',
                    title: 'Favorito sin actividad',
                    clientName: client.name,
                    clientId: client.id,
                    phone: client.phone,
                    detail: `Sin actividad por ${daysElapsed} días`,
                    amount: latestOrder?.total || null,
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
                    status: { notIn: ['CLIENT', 'active'] },
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
                },
                items: {
                    select: {
                        sphereVal: true,
                        cylinderVal: true,
                        additionVal: true,
                        productNameSnapshot: true,
                        productBrandSnapshot: true,
                        productCategorySnapshot: true
                    }
                }
            }
        });

        for (const quote of pendingQuotes) {
            const hasHighValue = quote.total >= 250000;
            let hasHighGraduation = false;
            let hasSpecialLenses = false;

            for (const item of quote.items) {
                if (
                    (item.sphereVal != null && Math.abs(item.sphereVal) >= 4.0) ||
                    (item.cylinderVal != null && Math.abs(item.cylinderVal) >= 2.0)
                ) {
                    hasHighGraduation = true;
                }

                if (item.additionVal != null) {
                    hasSpecialLenses = true;
                }

                const name = `${item.productBrandSnapshot || ''} ${item.productNameSnapshot || ''} ${item.productCategorySnapshot || ''}`.toLowerCase();
                if (
                    name.includes('multifocal') ||
                    name.includes('progresivo') ||
                    name.includes('bifocal') ||
                    name.includes('myofix') ||
                    name.includes('myopilux') ||
                    name.includes('myolens') ||
                    name.includes('miopía') ||
                    name.includes('miopia') ||
                    name.includes('control miop')
                ) {
                    hasSpecialLenses = true;
                }
            }

            if (!hasHighValue && !hasHighGraduation && !hasSpecialLenses) {
                continue; // Skip if it doesn't meet the target criteria
            }

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
                                { status: { in: ['CLIENT', 'active'] } },
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

            // Exclude small/simple carts (only show high value, multifocals, myopia controls)
            const hasHighValue = cart.total >= 250000;
            let hasSpecialLenses = false;

            const cartItems = Array.isArray(cart.cartData) ? cart.cartData as any[] : [];
            for (const item of cartItems) {
                const name = `${item.brand || ''} ${item.model || ''} ${item.category || ''}`.toLowerCase();
                if (
                    name.includes('multifocal') ||
                    name.includes('progresivo') ||
                    name.includes('bifocal') ||
                    name.includes('myofix') ||
                    name.includes('myopilux') ||
                    name.includes('myolens') ||
                    name.includes('miopía') ||
                    name.includes('miopia') ||
                    name.includes('control miop')
                ) {
                    hasSpecialLenses = true;
                }
            }

            if (!hasHighValue && !hasSpecialLenses) {
                continue; // Skip if it doesn't meet the target criteria
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

        // Fetch all clients who are already customers (status CLIENT/active OR have a SALE order)
        const clientsWithSales = await prisma.client.findMany({
            where: {
                OR: [
                    { status: { in: ['CLIENT', 'active'] } },
                    {
                        orders: {
                            some: {
                                orderType: 'SALE',
                                isDeleted: false
                            }
                        }
                    }
                ]
            },
            select: {
                name: true,
                phone: true
            }
        });

        // Create sets of phone numbers (last 8 digits) and lowercase names of existing clients
        const clientPhones = new Set<string>();
        const clientNames = new Set<string>();

        for (const c of clientsWithSales) {
            clientNames.add(c.name.trim().toLowerCase());
            if (c.phone) {
                const cleaned = c.phone.replace(/\D/g, '');
                if (cleaned.length >= 8) {
                    clientPhones.add(cleaned.slice(-8));
                }
            }
        }

        // Filter out opportunities that belong to already registered customers (by exact name or last 8 digits of phone)
        const filteredOpportunities = opportunities.filter(opp => {
            // Check if there is an existing customer with the same exact name
            if (clientNames.has(opp.clientName.trim().toLowerCase())) {
                return false;
            }
            // Check if there is an existing customer with the same phone number (last 8 digits)
            if (opp.phone) {
                const cleaned = opp.phone.replace(/\D/g, '');
                if (cleaned.length >= 8) {
                    const last8 = cleaned.slice(-8);
                    if (clientPhones.has(last8)) {
                        return false;
                    }
                }
            }
            return true;
        });

        // Sort by days elapsed descending (most stalled/oldest first)
        filteredOpportunities.sort((a, b) => b.daysElapsed - a.daysElapsed);

        return NextResponse.json(filteredOpportunities);
    } catch (error) {
        console.error('Error fetching sales opportunities:', error);
        return NextResponse.json({
            error: 'Error al obtener oportunidades de ventas',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id, type } = body;

        if (!id || !type) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

        if (type === 'STALLED_FAVORITE') {
            // Create a system interaction note to update last activity
            await prisma.interaction.create({
                data: {
                    clientId: id,
                    type: 'NOTE',
                    content: 'Seguimiento finalizado (Oportunidad de Cierre)'
                }
            });
            // Also trigger client updatedAt update
            await prisma.client.update({
                where: { id },
                data: { updatedAt: new Date() }
            });
        } else if (type === 'PENDING_QUOTE') {
            // Update order status to LOST
            await prisma.order.update({
                where: { id },
                data: { status: 'LOST' }
            });
        } else if (type === 'ABANDONED_CART') {
            // Update checkout session status to FINALIZED
            await prisma.checkoutSession.update({
                where: { id },
                data: { status: 'FINALIZED' }
            });
        } else {
            return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error finalizing opportunity:', error);
        return NextResponse.json({
            error: 'Error al finalizar oportunidad',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

