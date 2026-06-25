import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ContactService } from '@/services/contact.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        const from = fromParam && fromParam !== '' ? fromParam : null;
        const to = toParam && toParam !== '' ? toParam : null;
        const etiquetaParam = searchParams.get('etiqueta');
        const tipoParam = searchParams.get('tipo');
        const etiqueta = etiquetaParam && etiquetaParam !== '' ? etiquetaParam : null;
        const tipo = tipoParam && tipoParam !== '' ? tipoParam : null;
        const userIdParam = searchParams.get('userId');
        const userId = userIdParam && userIdParam !== '' ? userIdParam : null;

        const dateFilter: any = {};
        let hasDateFilter = false;
        if (from && from !== 'all') {
            dateFilter.gte = new Date(`${from}T00:00:00.000Z`);
            hasDateFilter = true;
        }
        if (to && to !== 'all') {
            dateFilter.lte = new Date(`${to}T23:59:59.999Z`);
            hasDateFilter = true;
        }

        // If no parameters are provided at all (initial load), default to current month in UTC
        if (fromParam === null && toParam === null) {
            const now = new Date();
            dateFilter.gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            hasDateFilter = true;
        }

        const whereClause: any = { orderType: 'SALE', isDeleted: false };
        if (hasDateFilter && Object.keys(dateFilter).length > 0) {
            whereClause.OR = [
                { labSentAt: dateFilter },
                {
                    AND: [
                        { labSentAt: null },
                        { createdAt: dateFilter }
                    ]
                }
            ];
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
                        eye: true,
                        product: {
                            select: {
                                name: true,
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
                        contactSource: true,
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
            select: { total: true, subtotalWithMarkup: true, labSentAt: true, createdAt: true },
            orderBy: { labSentAt: 'asc' },
        });

        const startOfToday = new Date();
        startOfToday.setHours(0,0,0,0);
        const startOfWeek = new Date();
        const dayOfWeek = startOfWeek.getDay();
        const diffToMonday = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startOfWeek.setDate(diffToMonday);
        startOfWeek.setHours(0,0,0,0);

        let todaySold = 0;
        let weekSold = 0;

        const totalSoldMonth = currentMonthOrders.reduce((acc: number, order: any) => {
            const price = order.total || order.subtotalWithMarkup || 0;
            const orderDate = new Date(order.labSentAt || order.createdAt);
            if (orderDate >= startOfToday) todaySold += price;
            if (orderDate >= startOfWeek) weekSold += price;
            return acc + price;
        }, 0);
        const totalPaidMonth = currentMonthOrders.reduce((acc: number, order: any) => acc + (order.paid || 0), 0);
        
        const clientBalances = await prisma.$queryRaw`
            WITH ClientSales AS (
                SELECT "clientId", SUM(COALESCE("total", "subtotalWithMarkup", 0)) as "totalSales"
                FROM "Order"
                WHERE "isDeleted" = false AND "orderType" = 'SALE' AND "clientId" IS NOT NULL
                GROUP BY "clientId"
            ),
            ClientPayments AS (
                SELECT o."clientId", SUM(p."amount") as "totalPaid"
                FROM "Payment" p
                JOIN "Order" o ON p."orderId" = o."id"
                WHERE o."isDeleted" = false AND o."clientId" IS NOT NULL
                GROUP BY o."clientId"
            )
            SELECT 
                cs."clientId", 
                cs."totalSales", 
                COALESCE(cp."totalPaid", 0) as "totalPaid"
            FROM ClientSales cs
            LEFT JOIN ClientPayments cp ON cs."clientId" = cp."clientId"
        `;

        const globalPendingBalance = (clientBalances as any[]).reduce((acc, row) => {
            return acc + Math.max(0, Number(row.totalSales || 0) - Number(row.totalPaid || 0));
        }, 0);

        const ordersCountMonth = currentMonthOrders.length;
        const ticketPromedioMonth = ordersCountMonth > 0 ? totalSoldMonth / ordersCountMonth : 0;

        // Open Quotes (Presupuestos Activos)
        const quoteWhere: any = {
            orderType: 'QUOTE',
            isDeleted: false,
        };
        if (hasDateFilter && Object.keys(dateFilter).length > 0) {
            quoteWhere.createdAt = dateFilter;
        }
        const openQuotes = await prisma.order.findMany({
            where: quoteWhere,
            select: { total: true, subtotalWithMarkup: true, clientId: true },
            orderBy: { createdAt: 'desc' }
        });
        
        const uniqueClientQuotes = new Map();
        let totalQuotesValue = 0;
        for (const q of openQuotes) {
            if (!q.clientId) {
                totalQuotesValue += (q.total || q.subtotalWithMarkup || 0);
            } else if (!uniqueClientQuotes.has(q.clientId)) {
                uniqueClientQuotes.set(q.clientId, true);
                totalQuotesValue += (q.total || q.subtotalWithMarkup || 0);
            }
        }

        // CONFIRMADOS: Clients with status CONFIRMED, sum only their latest QUOTE
        const confirmedClients = await prisma.client.findMany({
            where: { status: 'CONFIRMED' },
            select: {
                id: true,
                orders: {
                    where: { orderType: 'QUOTE', isDeleted: false },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { total: true, subtotalWithMarkup: true }
                }
            }
        });
        const confirmedCount = confirmedClients.length;
        const confirmedTotal = confirmedClients.reduce((acc, c) => {
            const lastQuote = c.orders[0];
            if (!lastQuote) return acc;
            return acc + (lastQuote.total || lastQuote.subtotalWithMarkup || 0);
        }, 0);

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
                    { client: { interest: { contains: 'Multifocal', mode: 'insensitive' } } },
                    { items: { some: { product: { type: { contains: 'Multifocal', mode: 'insensitive' } } } } },
                    { items: { some: { product: { name: { contains: 'Multifocal', mode: 'insensitive' } } } } },
                    { items: { some: { product: { name: { contains: 'Varilux', mode: 'insensitive' } } } } },
                    { items: { some: { product: { brand: { contains: 'Varilux', mode: 'insensitive' } } } } },
                    { items: { some: { product: { name: { contains: 'Progresivo', mode: 'insensitive' } } } } },
                    { items: { some: { product: { name: { contains: 'Smart', mode: 'insensitive' } } } } },
                    { items: { some: { product: { name: { contains: 'Kodak', mode: 'insensitive' } } } } },
                    { items: { some: { product: { name: { contains: 'MR7', mode: 'insensitive' } } } } },
                    { items: { some: { product: { name: { contains: 'Asférico', mode: 'insensitive' } } } } },
                    { items: { some: { product: { name: { contains: 'Asferico', mode: 'insensitive' } } } } },
                    { items: { some: { product: { name: { contains: 'Policarbonato', mode: 'insensitive' } } } } },
                    { items: { some: { product: { name: { contains: 'Alto Indice', mode: 'insensitive' } } } } }
                ]
            },
            select: {
                id: true,
                total: true,
                createdAt: true,
                client: {
                    select: {
                        id: true,
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
            const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
            const key = `${monthsNames[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
            last6MonthsKeys.push(key);
            monthlyStats[key] = 0;
        }

        allOrders.forEach((order: any) => {
            const date = new Date(order.labSentAt || order.createdAt);
            const key = `${monthsNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
            if (monthlyStats[key] !== undefined) {
                const price = order.total || order.subtotalWithMarkup || 0;
                monthlyStats[key] += price;
            }
        });

        const tagStats: Record<string, { total: number; count: number }> = {};
        const locationStats: Record<string, { total: number; count: number }> = {
            'En Local': { total: 0, count: 0 },
            'Online': { total: 0, count: 0 }
        };

        // First, fetch the clients in the current month orders who have a STORE_VISIT
        const clientIdsInOrders = [...new Set(currentMonthOrders.map((o: any) => o.client?.id).filter(Boolean))];
        let localClientIds = new Set();
        if (clientIdsInOrders.length > 0) {
            const localInteractions = await prisma.interaction.findMany({
                where: {
                    clientId: { in: clientIdsInOrders },
                    type: 'STORE_VISIT'
                },
                select: { clientId: true }
            });
            localClientIds = new Set(localInteractions.map(i => i.clientId));
        }

        currentMonthOrders.forEach((order: any) => {
            // Tag stats
            const source = order.client?.contactSource || 'Sin etiqueta';
            if (!tagStats[source]) tagStats[source] = { total: 0, count: 0 };
            const orderPrice = order.total || order.subtotalWithMarkup || 0;
            tagStats[source].total += orderPrice;
            tagStats[source].count += 1;

            // Location stats
            const isLocal = order.client && localClientIds.has(order.client.id);
            const locKey = isLocal ? 'En Local' : 'Online';
            locationStats[locKey].total += orderPrice;
            locationStats[locKey].count += 1;
        });

        // Type stats
        const typeStats: Record<string, { total: number; count: number; cost: number }> = {};
        currentMonthOrders.forEach((order: any) => {
            const has2x1Tag = order.tags?.some((t: any) => t.name.toLowerCase().includes('2x1')) || false;
            const has2x1Product = order.items.some((i: any) => i.product && (i.product.name || '').toLowerCase().includes('2x1'));
            const hasFreeCrystal = order.items.some((i: any) => {
                if (!i.product) return false;
                const isCrystal = (i.product.category || '').toUpperCase().includes('CRISTAL')
                    || (i.product.type || '').includes('Cristal')
                    || (i.product.type || '').includes('Multifocal')
                    || (i.product.type || '').includes('Monofocal');
                return isCrystal && i.price === 0;
            });
            const is2x1Order = ((order as any).appliedPromoName || '').toLowerCase().includes('2x1') || has2x1Tag || has2x1Product || hasFreeCrystal;

            order.items.forEach((item: any) => {
                const product = item.product;
                if (!product) return; // Skip if product was deleted

                const type = product.type || "OTROS";
                if (!typeStats[type]) typeStats[type] = { total: 0, count: 0, cost: 0 };
                const orderPrice = Math.max(item.price * item.quantity, 0); // Using item price for type stats is usually better as it's more granular
                typeStats[type].total += orderPrice;

                const isCrystalItem = (product.category || '').toUpperCase().includes('CRISTAL')
                    || (product.type || '').includes('Cristal')
                    || (product.type || '').includes('Multifocal')
                    || (product.type || '').includes('Monofocal');

                let itemCost = (product.cost || 0) * item.quantity;
                if (isCrystalItem && item.eye && (product.cost || 0) > 0) {
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
        if (from && from !== 'all') {
            const fromDate = new Date(`${from}T00:00:00.000Z`);
            const toDate = to && to !== 'all' ? new Date(`${to}T23:59:59.999Z`) : new Date();
            const periodDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
            const prevFrom = new Date(fromDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
            const prevOrders = await prisma.order.findMany({
                where: {
                    labSentAt: { gte: prevFrom, lt: fromDate },
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
        let hasFunnelFilter = false;
        if (from && from !== 'all') {
            funnelDateFilter.gte = new Date(`${from}T00:00:00.000Z`);
            hasFunnelFilter = true;
        }
        if (to && to !== 'all') {
            funnelDateFilter.lte = new Date(`${to}T23:59:59.999Z`);
            hasFunnelFilter = true;
        }
        if (fromParam === null && toParam === null) {
            const now = new Date();
            funnelDateFilter.gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            hasFunnelFilter = true;
        }

        // Build client filter for funnel
        const clientWhere: any = {};
        if (hasFunnelFilter && Object.keys(funnelDateFilter).length > 0) {
            clientWhere.createdAt = funnelDateFilter;
        }
        if (etiqueta && etiqueta !== 'ALL') clientWhere.contactSource = etiqueta;
        if (tipo && tipo !== 'ALL') clientWhere.interest = tipo;

        // Get filtered client IDs for order counting
        const filteredClients = await prisma.client.findMany({
            where: clientWhere,
            select: { id: true },
        });
        const filteredClientIds = filteredClients.map((c: any) => c.id);

        const orderFunnelWhere: any = { isDeleted: false };
        if (hasFunnelFilter && Object.keys(funnelDateFilter).length > 0) {
            orderFunnelWhere.OR = [
                { labSentAt: funnelDateFilter },
                {
                    AND: [
                        { labSentAt: null },
                        { createdAt: funnelDateFilter }
                    ]
                }
            ];
        }
        
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
        const targetMonth = from && from !== 'all' ? new Date(`${from}T00:00:00.000Z`).getUTCMonth() + 1 : now.getUTCMonth() + 1;
        const targetYear = from && from !== 'all' ? new Date(`${from}T00:00:00.000Z`).getUTCFullYear() : now.getUTCFullYear();
        
        let targets = null;
        try {
            targets = await prisma.monthlyTarget.findUnique({
                where: { month_year: { month: targetMonth, year: targetYear } }
            });
        } catch (e) {
            console.warn('Could not fetch targets, model might not be in client yet:', e);
        }

        const pendingBalancesList = await ContactService.getOrdersWithBalance();

        let personalSoldMonth = 0;
        let personalConfirmedCount = 0;

        if (userId) {
            const personalSoldWhere: any = {
                userId,
                orderType: 'SALE',
                isDeleted: false
            };
            if (hasDateFilter && Object.keys(dateFilter).length > 0) {
                personalSoldWhere.OR = [
                    { labSentAt: dateFilter },
                    {
                        AND: [
                            { labSentAt: null },
                            { createdAt: dateFilter }
                        ]
                    }
                ];
            }
            personalSoldMonth = await prisma.order.count({
                where: personalSoldWhere
            });

            const confirmedClients = await prisma.client.findMany({
                where: { status: 'CONFIRMED' },
                select: {
                    orders: {
                        where: { orderType: 'QUOTE', isDeleted: false },
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: { userId: true }
                    }
                }
            });
            personalConfirmedCount = confirmedClients.filter(c => c.orders[0]?.userId === userId).length;
        }

        return NextResponse.json({
            totalSoldMonth,
            totalPaidMonth,
            ordersCountMonth,
            ticketPromedioMonth,
            trendPct,
            funnel,
            targets,
            totalPendingBalance: globalPendingBalance,
            pendingBalances: pendingBalancesList,
            totalQuotesValue: totalQuotesValue,
            confirmedCount,
            confirmedTotal,
            suggestedFollowUps: suggestedFollowUps,
            monthlyBilling: last6MonthsKeys.map(key => ({ name: key, total: monthlyStats[key] })),
            tagStats: Object.entries(tagStats).map(([name, data]) => ({ name, ...data })),
            locationStats: Object.entries(locationStats).map(([name, data]) => ({ name, ...data })),
            typeStats: Object.entries(typeStats).map(([name, data]) => ({ name, ...data })),
            personalSoldMonth,
            personalConfirmedCount,
            todaySold,
            weekSold,
        });
    } catch (error: any) {
        console.error('Error fetching dashboard data:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
