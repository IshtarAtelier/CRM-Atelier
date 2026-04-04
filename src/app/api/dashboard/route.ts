import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const etiqueta = searchParams.get('etiqueta');
        const tipo = searchParams.get('tipo');

        const dateFilter: any = {};
        if (from) dateFilter.gte = new Date(from);
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            dateFilter.lte = toDate;
        }

        // If no dates, default to current month
        if (!from && !to) {
            const now = new Date();
            dateFilter.gte = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const whereClause: any = {
            createdAt: dateFilter,
            orderType: 'SALE',
            isDeleted: false,
        };

        const currentMonthOrders = await prisma.order.findMany({
            where: whereClause,
            include: {
                items: { include: { product: true } },
                tags: true,
            },
        });

        const allOrders = await prisma.order.findMany({
            where: { orderType: 'SALE', isDeleted: false },
            select: { total: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });

        const totalSoldMonth = currentMonthOrders.reduce((acc: number, order: any) => acc + order.total, 0);
        const ordersCountMonth = currentMonthOrders.length;
        const ticketPromedioMonth = ordersCountMonth > 0 ? totalSoldMonth / ordersCountMonth : 0;

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
                monthlyStats[key] += order.total;
            }
        });
        const tagStats: Record<string, { total: number; count: number }> = {};
        currentMonthOrders.forEach((order: any) => {
            order.tags.forEach((t: any) => {
                if (!tagStats[t.name]) tagStats[t.name] = { total: 0, count: 0 };
                tagStats[t.name].total += order.total;
                tagStats[t.name].count += 1;
            });
        });

        // Type stats
        const typeStats: Record<string, { total: number; count: number; cost: number }> = {};
        currentMonthOrders.forEach((order: any) => {
            order.items.forEach((item: any) => {
                const product = item.product;
                if (!product) return; // Skip if product was deleted

                const type = product.type || "OTROS";
                if (!typeStats[type]) typeStats[type] = { total: 0, count: 0, cost: 0 };
                typeStats[type].total += item.price * item.quantity;
                typeStats[type].count += item.quantity;
                typeStats[type].cost += (product.cost || 0) * item.quantity;
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

        return NextResponse.json({
            totalSoldMonth,
            ordersCountMonth,
            ticketPromedioMonth,
            trendPct,
            funnel,
            monthlyBilling: last6MonthsKeys.map(key => ({ name: key, total: monthlyStats[key] })),
            tagStats: Object.entries(tagStats).map(([name, data]) => ({ name, ...data })),
            typeStats: Object.entries(typeStats).map(([name, data]) => ({ name, ...data })),
        });
    } catch (error: any) {
        console.error('Error fetching dashboard data:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
