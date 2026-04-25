import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        const from = fromParam && fromParam !== '' ? fromParam : null;
        const to = toParam && toParam !== '' ? toParam : null;

        const dateFilter: any = {};
        if (from) dateFilter.gte = new Date(from);
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            dateFilter.lte = toDate;
        }

        // If no dates provided (and not All Time), default to current month
        if (!fromParam && !toParam) {
            const now = new Date();
            dateFilter.gte = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const whereClause: any = {
            orderType: 'SALE',
            isDeleted: false,
        };
        if (Object.keys(dateFilter).length > 0) {
            whereClause.createdAt = dateFilter;
        }

        const currentMonthOrders = await prisma.order.findMany({
            where: whereClause,
            select: {
                total: true,
                paid: true,
                subtotalWithMarkup: true, // ADDED
                createdAt: true,
                items: {
                    select: {
                        price: true,
                        quantity: true,
                        product: {
                            select: {
                                type: true,
                                cost: true,
                                category: true
                            }
                        }
                    }
                },
                tags: {
                    select: {
                        name: true
                    }
                },
                client: {
                    select: {
                        tags: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            },
        });

        const allOrders = await prisma.order.findMany({
            where: { orderType: 'SALE', isDeleted: false },
            select: { total: true, subtotalWithMarkup: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });

        const totalSoldMonth = currentMonthOrders.reduce((acc: number, order: any) => {
            const price = order.total || order.subtotalWithMarkup || 0;
            return acc + price;
        }, 0);
        const totalPaidMonth = currentMonthOrders.reduce((acc: number, order: any) => acc + (order.paid || 0), 0);
        
        // SALDO PENDIENTE GLOBAL (Cuentas a cobrar históricas)
        // Se calcula sobre todas las ventas no eliminadas de la historia
        const allPendingSales = await prisma.order.findMany({
            where: { orderType: 'SALE', isDeleted: false },
            select: { total: true, paid: true, subtotalWithMarkup: true }
        });
        const globalPendingBalance = allPendingSales.reduce((acc, o) => {
            const listPrice = o.total || o.subtotalWithMarkup || 0;
            return acc + Math.max(0, listPrice - (o.paid || 0));
        }, 0);

        const ordersCountMonth = currentMonthOrders.length;
        const ticketPromedioMonth = ordersCountMonth > 0 ? totalSoldMonth / ordersCountMonth : 0;

        // Open Quotes (Presupuestos Activos)
        const openQuotes = await prisma.order.findMany({
            where: {
                createdAt: dateFilter,
                orderType: 'QUOTE',
                isDeleted: false,
            },
            select: { total: true, subtotalWithMarkup: true }
        });
        const totalQuotesValue = openQuotes.reduce((acc, q: any) => acc + (q.total || q.subtotalWithMarkup || 0), 0);

        // Suggested Follow-ups (Multifocal quotes > 2 days old)
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 7); // Don't suggest very old ones
        
        const rawFollowUps = await prisma.order.findMany({
            where: {
                orderType: 'QUOTE',
                isDeleted: false,
                createdAt: { lte: twoDaysAgo, gte: fiveDaysAgo },
                client: {
                    orders: {
                        none: {
                            orderType: 'SALE',
                            isDeleted: false
                        }
                    }
                },
                OR: [
                    { client: { interest: { contains: 'Multifocal' } } },
                    { items: { some: { product: { type: { contains: 'Multifocal' } } } } },
                    { items: { some: { product: { category: 'LENS' } } } },
                    { items: { some: { product: { category: 'CRISTAL' } } } }
                ]
            },
            select: {
                id: true,
                total: true,
                createdAt: true,
                client: {
                    select: {
                        name: true
                    }
                },
                items: {
                    select: {
                        product: {
                            select: {
                                brand: true,
                                model: true,
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const uniqueClientNames = new Set();
        const suggestedFollowUps = [];
        for (const fu of rawFollowUps) {
            if (fu.client?.name && !uniqueClientNames.has(fu.client.name)) {
                uniqueClientNames.add(fu.client.name);
                suggestedFollowUps.push(fu);
                if (suggestedFollowUps.length === 6) break;
            }
        }

        // Monthly historical
        const monthsNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const monthlyStats: Record<string, number> = {};
        const last6MonthsKeys: string[] = [];

        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${monthsNames[d.getMonth()]} ${d.getFullYear()}`;
            last6MonthsKeys.push(key);
            monthlyStats[key] = 0;
        }

        allOrders.forEach((order: any) => {
            const date = new Date(order.createdAt);
            const key = `${monthsNames[date.getMonth()]} ${date.getFullYear()}`;
            if (monthlyStats[key] !== undefined) {
                const price = order.total || order.subtotalWithMarkup || 0;
                monthlyStats[key] += price;
            }
        });
        const tagStats: Record<string, { total: number; count: number }> = {};
        currentMonthOrders.forEach((order: any) => {
            // Combinar etiquetas de la orden y del cliente (evitando duplicados)
            const combinedTags = [
                ...order.tags.map((t: any) => t.name),
                ...(order.client?.tags.map((t: any) => t.name) || [])
            ];
            const uniqueTags = [...new Set(combinedTags)];

            uniqueTags.forEach((tagName: string) => {
                if (!tagStats[tagName]) tagStats[tagName] = { total: 0, count: 0 };
                const orderPrice = order.total || order.subtotalWithMarkup || 0;
                tagStats[tagName].total += orderPrice;
                tagStats[tagName].count += 1;
            });
        });

        // Type stats
        const typeStats: Record<string, { total: number; count: number; cost: number }> = {};
        currentMonthOrders.forEach((order: any) => {
            const has2x1Tag = order.tags?.some((t: any) => t.name.toLowerCase().includes('2x1')) || false;
            const is2x1Order = ((order as any).appliedPromoName || '').toLowerCase().includes('2x1') || has2x1Tag;

            order.items.forEach((item: any) => {
                const product = item.product;
                if (!product) return; // Skip if product was deleted

                const type = product.type || "OTROS";
                if (!typeStats[type]) typeStats[type] = { total: 0, count: 0, cost: 0 };
                const orderPrice = Math.max(item.price * item.quantity, 0); // Using item price for type stats is usually better as it's more granular
                typeStats[type].total += orderPrice;

                const isCrystalItem = (product.category || '').toUpperCase().includes('LENS')
                    || (product.category || '').toUpperCase().includes('CRISTAL')
                    || (product.type || '').includes('Cristal')
                    || (product.type || '').includes('Multifocal')
                    || (product.type || '').includes('Monofocal');

                let itemCost = (product.cost || 0) * item.quantity;
                if (product.unitType === 'PAR' && item.eye && (product.cost || 0) > 0) {
                    itemCost = ((product.cost || 0) / 2) * item.quantity;
                }

                if (is2x1Order && isCrystalItem && item.price === 0) {
                    itemCost = 0;
                } else {
                    typeStats[type].count += item.quantity;
                }

                typeStats[type].cost += itemCost;
            });
        });

        // Previous period comparison
        let prevTotal = 0;
        if (from) {
            const fromDate = new Date(from);
            const toDate = to ? new Date(to) : new Date();
            const periodDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
            const prevFrom = new Date(fromDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
            const prevOrders = await prisma.order.findMany({
                where: {
                    createdAt: { gte: prevFrom, lt: fromDate },
                    orderType: 'SALE',
                    isDeleted: false,
                },
                select: { total: true },
            });
            prevTotal = prevOrders.reduce((acc, o) => acc + o.total, 0);
        }

        const trendPct = prevTotal > 0 ? (((totalSoldMonth - prevTotal) / prevTotal) * 100).toFixed(1) : null;

        // ── Conversion Funnel ──
        const funnelDateFilter: any = {};
        if (from) funnelDateFilter.gte = new Date(from);
        if (to) {
            const toD = new Date(to);
            toD.setHours(23, 59, 59, 999);
            funnelDateFilter.lte = toD;
        }
        if (!from && !to) {
            const now = new Date();
            funnelDateFilter.gte = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        // Build client filter for funnel
        const clientWhere: any = { createdAt: funnelDateFilter };
        if (etiqueta && etiqueta !== 'ALL') clientWhere.contactSource = etiqueta;
        if (tipo && tipo !== 'ALL') clientWhere.interest = tipo;

        // Get filtered client IDs for order counting
        const filteredClients = await prisma.client.findMany({
            where: clientWhere,
            select: { id: true },
        });
        const filteredClientIds = filteredClients.map((c: any) => c.id);

        const orderFunnelWhere: any = { createdAt: funnelDateFilter, isDeleted: false };
        if (etiqueta !== null || tipo !== null) {
            orderFunnelWhere.clientId = { in: filteredClientIds };
        }

        const [contactsCreated, quotesCreated, salesCreated] = await Promise.all([
            prisma.client.count({ where: clientWhere }),
            prisma.order.count({ where: { ...orderFunnelWhere, orderType: 'QUOTE' } }),
            prisma.order.count({ where: { ...orderFunnelWhere, orderType: 'SALE' } }),
        ]);

        // Get distinct etiquetas and tipos for filter UI
        const allClients = await prisma.client.findMany({
            select: { contactSource: true, interest: true },
        });
        const etiquetas = [...new Set(allClients.map((c: any) => c.contactSource).filter(Boolean))] as string[];
        const tipos = [...new Set(allClients.map((c: any) => c.interest).filter(Boolean))] as string[];

        const funnel = {
            contacts: contactsCreated,
            quotes: quotesCreated,
            sales: salesCreated,
            quoteRate: contactsCreated > 0 ? ((quotesCreated / contactsCreated) * 100).toFixed(1) : '0',
            saleRate: contactsCreated > 0 ? ((salesCreated / contactsCreated) * 100).toFixed(1) : '0',
            etiquetas,
            tipos,
        };

        // Monthly Targets
        const targetMonth = from ? new Date(from).getMonth() + 1 : now.getMonth() + 1;
        const targetYear = from ? new Date(from).getFullYear() : now.getFullYear();
        
        let targets = null;
        try {
            targets = await prisma.monthlyTarget.findUnique({
                where: { month_year: { month: targetMonth, year: targetYear } }
            });
        } catch (e) {
            console.warn('Could not fetch targets, model might not be in client yet:', e);
        }

        return NextResponse.json({
            totalSoldMonth,
            ordersCountMonth,
            ticketPromedioMonth,
            trendPct,
            funnel,
            targets,
            totalPendingBalance: globalPendingBalance,
            totalQuotesValue: totalQuotesValue,
            suggestedFollowUps: suggestedFollowUps,
            monthlyBilling: last6MonthsKeys.map(key => ({ name: key, total: monthlyStats[key] })),
            tagStats: Object.entries(tagStats).map(([name, data]) => ({ name, ...data })),
            typeStats: Object.entries(typeStats).map(([name, data]) => ({ name, ...data })),
        });
    } catch (error: any) {
        console.error('Error fetching dashboard data:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
