import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ContactService } from '@/services/contact.service';
import { ATTENTION_CUTOFF_ISO } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        const role = request.headers.get('x-user-role') || 'STAFF';
        const isStaff = role === 'STAFF';
        
        let from = fromParam && fromParam !== '' ? fromParam : null;
        let to = toParam && toParam !== '' ? toParam : null;

        const etiquetaParam = searchParams.get('etiqueta');
        const tipoParam = searchParams.get('tipo');
        const etiqueta = etiquetaParam && etiquetaParam !== '' ? etiquetaParam : null;
        const tipo = tipoParam && tipoParam !== '' ? tipoParam : null;
        const userIdParam = searchParams.get('userId');
        const userId = userIdParam && userIdParam !== '' ? userIdParam : null;

        const dateFilter: any = {};
        let hasDateFilter = false;

        if (isStaff) {
            // Force STAFF to only see the current month (no historical access via query params)
            const now = new Date();
            dateFilter.gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            hasDateFilter = true;
            from = null;
            to = null;
        } else {
            if (from && from !== 'all') {
                dateFilter.gte = new Date(`${from}T00:00:00.000Z`);
                hasDateFilter = true;
            }
            if (to && to !== 'all') {
                dateFilter.lte = new Date(`${to}T23:59:59.999Z`);
                hasDateFilter = true;
            }

            // If no parameters are provided at all (initial load), default to current month in UTC
            if (from === null && to === null) {
                const now = new Date();
                dateFilter.gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
                hasDateFilter = true;
            }
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
                        productCostSnapshot: true,
                        productCategorySnapshot: true,
                        productNameSnapshot: true,
                        laboratorySnapshot: true,
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
                        id: true,
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

        let allOrders: any[] = [];
        if (!isStaff) {
            allOrders = await prisma.order.findMany({
                where: { orderType: 'SALE', isDeleted: false },
                select: { total: true, subtotalWithMarkup: true, labSentAt: true, createdAt: true },
                orderBy: { labSentAt: 'asc' },
            });
        }

        const startOfToday = new Date();
        startOfToday.setHours(0,0,0,0);
        const startOfWeek = new Date();
        const dayOfWeek = startOfWeek.getDay();
        const diffToMonday = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startOfWeek.setDate(diffToMonday);
        startOfWeek.setHours(0,0,0,0);

        // ── Nuevos contactos subidos al sistema ──
        // Contador independiente del período/filtro del dashboard: mide el ingreso de
        // leads nuevos al CRM. El número principal (sinceCutoff) acumula desde el
        // "borrón y cuenta nueva" (mismo corte que el "sin atender", ver constants.ts).
        // Límites de tiempo en horario de Argentina (UTC-3, sin horario de verano) para
        // que "hoy" corte a la medianoche local y no a las 00:00 UTC (21:00 ART) del server.
        const ART_OFFSET_MS = 3 * 60 * 60 * 1000;
        const artNow = new Date(Date.now() - ART_OFFSET_MS);
        const artY = artNow.getUTCFullYear();
        const artM = artNow.getUTCMonth();
        const artD = artNow.getUTCDate();
        const startOfDayART = new Date(Date.UTC(artY, artM, artD) + ART_OFFSET_MS);
        const daysFromMonday = (artNow.getUTCDay() + 6) % 7; // lunes = inicio de semana
        const startOfWeekART = new Date(startOfDayART.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
        const startOfMonthART = new Date(Date.UTC(artY, artM, 1) + ART_OFFSET_MS);
        const attentionCutoff = new Date(process.env.ATTENTION_CUTOFF_DATE || ATTENTION_CUTOFF_ISO);
        const [newContactsSinceCutoff, newContactsToday, newContactsWeek, newContactsMonth] = await Promise.all([
            prisma.client.count({ where: { isDeleted: false, createdAt: { gte: attentionCutoff } } }),
            prisma.client.count({ where: { isDeleted: false, createdAt: { gte: startOfDayART } } }),
            prisma.client.count({ where: { isDeleted: false, createdAt: { gte: startOfWeekART } } }),
            prisma.client.count({ where: { isDeleted: false, createdAt: { gte: startOfMonthART } } }),
        ]);
        const newContacts = {
            sinceCutoff: newContactsSinceCutoff,
            today: newContactsToday,
            week: newContactsWeek,
            month: newContactsMonth,
            cutoffISO: attentionCutoff.toISOString(),
        };

        let todaySold = 0;
        let weekSold = 0;

        const totalSoldMonth = currentMonthOrders.reduce((acc: number, order: any) => {
            const price = order.subtotalWithMarkup || order.total || 0;
            const orderDate = new Date(order.labSentAt || order.createdAt);
            if (orderDate >= startOfToday) todaySold += price;
            if (orderDate >= startOfWeek) weekSold += price;
            return acc + price;
        }, 0);
        const totalPaidMonth = currentMonthOrders.reduce((acc: number, order: any) => acc + (order.paid || 0), 0);
        
        let globalPendingBalance = 0;
        if (!isStaff) {
            const clientBalances = await prisma.$queryRaw`
                WITH ClientSales AS (
                    SELECT "clientId", SUM(COALESCE(NULLIF("subtotalWithMarkup", 0), "total", 0)) as "totalSales"
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

            globalPendingBalance = (clientBalances as any[]).reduce((acc, row) => {
                return acc + Math.max(0, Number(row.totalSales || 0) - Number(row.totalPaid || 0));
            }, 0);
        }

        const ordersCountMonth = currentMonthOrders.length;
        const ticketPromedioMonth = ordersCountMonth > 0 ? totalSoldMonth / ordersCountMonth : 0;

        // Open Quotes (Presupuestos Activos)
        let totalQuotesValue = 0;
        if (!isStaff) {
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
            for (const q of openQuotes) {
                if (!q.clientId) {
                    totalQuotesValue += (q.subtotalWithMarkup || q.total || 0);
                } else if (!uniqueClientQuotes.has(q.clientId)) {
                    uniqueClientQuotes.set(q.clientId, true);
                    totalQuotesValue += (q.subtotalWithMarkup || q.total || 0);
                }
            }
        }

        // CONFIRMADOS: Clients with status CONFIRMED, sum only their latest QUOTE
        let confirmedCount = 0;
        let confirmedTotal = 0;
        if (isStaff) {
            confirmedCount = await prisma.client.count({
                where: { status: 'CONFIRMED' }
            });
        } else {
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
            confirmedCount = confirmedClients.length;
            confirmedTotal = confirmedClients.reduce((acc, c) => {
                const lastQuote = c.orders[0];
                if (!lastQuote) return acc;
                return acc + (lastQuote.subtotalWithMarkup || lastQuote.total || 0);
            }, 0);
        }

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
                const price = order.subtotalWithMarkup || order.total || 0;
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
            const interactionWhere: any = {
                clientId: { in: clientIdsInOrders },
                type: 'STORE_VISIT'
            };
            if (hasDateFilter && Object.keys(dateFilter).length > 0) {
                interactionWhere.createdAt = dateFilter;
            }
            const localInteractions = await prisma.interaction.findMany({
                where: interactionWhere,
                select: { clientId: true }
            });
            localClientIds = new Set(localInteractions.map(i => i.clientId));
        }

        currentMonthOrders.forEach((order: any) => {
            // Tag stats
            const source = order.client?.contactSource || 'Sin etiqueta';
            if (!tagStats[source]) tagStats[source] = { total: 0, count: 0 };
            const orderPrice = order.subtotalWithMarkup || order.total || 0;
            tagStats[source].total += orderPrice;
            tagStats[source].count += 1;

            // Location stats
            const hasVisitTag = order.client?.tags?.some((t: any) => {
                const name = t.name.toLowerCase().trim();
                return name === 'visita showroom' || name === 'visita showroom ';
            }) || false;
            const isLocal = hasVisitTag || (order.client && localClientIds.has(order.client.id));
            const locKey = isLocal ? 'En Local' : 'Online';
            locationStats[locKey].total += orderPrice;
            locationStats[locKey].count += 1;
        });

        const labs = await prisma.laboratoryConfig.findMany();
        const labMap = new Map(labs.map(l => [l.name.toUpperCase(), l]));

        // Type stats
        const typeStats: Record<string, { total: number; count: number; cost: number }> = {};
        currentMonthOrders.forEach((order: any) => {
            const has2x1Tag = order.tags?.some((t: any) => t.name.toLowerCase().includes('2x1')) || false;
            const has2x1Product = order.items.some((i: any) => i.productNameSnapshot ? i.productNameSnapshot.toLowerCase().includes('2x1') : (i.product && (i.product.name || '').toLowerCase().includes('2x1')));
            const hasFreeCrystal = order.items.some((i: any) => {
                const categoryVal = i.productCategorySnapshot || (i.product ? (i.product.category || '') : '');
                const typeVal = (i.product ? i.product.type : null) || (categoryVal.toUpperCase().includes('CRISTAL') ? 'Cristal' : 'Armazón');
                const isCrystal = categoryVal.toUpperCase().includes('CRISTAL')
                    || typeVal.includes('Cristal')
                    || typeVal.includes('Multifocal')
                    || typeVal.includes('Monofocal');
                return isCrystal && i.price === 0;
            });
            const is2x1Order = ((order as any).appliedPromoName || '').toLowerCase().includes('2x1') || has2x1Tag || has2x1Product || hasFreeCrystal;

            order.items.forEach((item: any) => {
                const product = item.product;

                const costVal = item.productCostSnapshot !== null && item.productCostSnapshot !== undefined
                    ? item.productCostSnapshot
                    : (product ? (product.cost || 0) : 0);

                const categoryVal = item.productCategorySnapshot
                    ? item.productCategorySnapshot
                    : (product ? (product.category || '') : '');

                const labName = item.laboratorySnapshot
                    ? item.laboratorySnapshot
                    : (product ? product.laboratory : null);

                const typeVal = (product ? product.type : null) 
                    || (categoryVal.toUpperCase().includes('CRISTAL') ? 'Cristal' : 'Armazón');

                const type = typeVal || "OTROS";
                if (!typeStats[type]) typeStats[type] = { total: 0, count: 0, cost: 0 };
                const orderPrice = Math.max(item.price * item.quantity, 0);
                typeStats[type].total += orderPrice;

                const isCrystalItem = categoryVal.toUpperCase().includes('CRISTAL')
                    || typeVal.includes('Cristal')
                    || typeVal.includes('Multifocal')
                    || typeVal.includes('Monofocal');

                let itemCost = costVal * item.quantity;
                if (isCrystalItem && item.eye && costVal > 0) {
                    itemCost = (costVal / 2) * item.quantity;
                }

                // If it is a 2x1 order and the crystal is free (price === 0), only charge the calibration cost
                if (isCrystalItem && is2x1Order && item.price === 0) {
                    const labConfig = labName ? labMap.get(labName.toUpperCase()) : null;
                    const calibrado = labConfig ? labConfig.calibrado : 15000;
                    const iva = labConfig ? labConfig.iva : 21;
                    const calibradoCost = calibrado * (1 + iva / 100);
                    
                    if (item.eye === 'OD' || item.eye === 'OI') {
                        itemCost = (calibradoCost / 2) * item.quantity;
                    } else {
                        itemCost = calibradoCost * item.quantity;
                    }
                }

                if (is2x1Order && isCrystalItem && item.price === 0) {
                    // Do not increment count for free promo crystals
                } else {
                    typeStats[type].count += isCrystalItem ? (item.quantity / 2) : item.quantity;
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
                select: { total: true, subtotalWithMarkup: true },
            });
            prevTotal = prevOrders.reduce((acc, o) => acc + (o.subtotalWithMarkup || o.total || 0), 0);
        }

        const trendPct = prevTotal > 0 ? (((totalSoldMonth - prevTotal) / prevTotal) * 100).toFixed(1) : null;

        // ── Conversion Funnel ──
        const funnelDateFilter: any = {};
        let hasFunnelFilter = false;
        if (isStaff) {
            const now = new Date();
            funnelDateFilter.gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            hasFunnelFilter = true;
        } else {
            if (from && from !== 'all') {
                funnelDateFilter.gte = new Date(`${from}T00:00:00.000Z`);
                hasFunnelFilter = true;
            }
            if (to && to !== 'all') {
                funnelDateFilter.lte = new Date(`${to}T23:59:59.999Z`);
                hasFunnelFilter = true;
            }
            if (from === null && to === null) {
                const now = new Date();
                funnelDateFilter.gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
                hasFunnelFilter = true;
            }
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

        const pendingBalancesList = !isStaff ? await ContactService.getOrdersWithBalance() : [];

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

        if (isStaff) {
            return NextResponse.json({
                totalSoldMonth,
                totalPaidMonth: 0,
                ordersCountMonth,
                ticketPromedioMonth,
                trendPct: null,
                funnel,
                targets,
                totalPendingBalance: 0,
                pendingBalances: [],
                totalQuotesValue: 0,
                confirmedCount,
                confirmedTotal: 0,
                suggestedFollowUps,
                monthlyBilling: [],
                tagStats: Object.entries(tagStats).map(([name, data]) => ({ name, count: data.count, total: 0 })),
                locationStats: Object.entries(locationStats).map(([name, data]) => ({ name, count: data.count, total: 0 })),
                typeStats: Object.entries(typeStats).map(([name, data]) => ({ name, count: data.count, total: 0, cost: 0 })),
                personalSoldMonth,
                personalConfirmedCount,
                todaySold,
                weekSold,
                newContacts,
            });
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
            newContacts,
        });
    } catch (error: any) {
        console.error('Error fetching dashboard data:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
