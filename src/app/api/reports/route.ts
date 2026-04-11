import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PLATFORM_COMMISSIONS, getCommissionRate } from '@/lib/constants';

export const dynamic = 'force-dynamic';


export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        // Build date filter
        const dateFilter: any = {};
        if (from) dateFilter.gte = new Date(from);
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            dateFilter.lte = toDate;
        }

        const whereClause: any = {
            orderType: 'SALE',
            isDeleted: false,
        };
        if (from || to) {
            whereClause.createdAt = dateFilter;
        }

        // Fetch all sales with items, products, and payments
        const orders = await prisma.order.findMany({
            where: whereClause,
            include: {
                client: true,
                user: { select: { id: true, name: true } },
                items: {
                    include: { product: true }
                },
                payments: true,
                tags: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        // ── Aggregate Data ──────────────────────────

        let totalRevenue = 0;
        let totalCostFrames = 0;
        let totalCostLenses = 0;
        let totalCostOther = 0;
        let totalPlatformFees = 0;
        let totalPaid = 0;
        let totalPending = 0;
        let totalMarkup = 0;

        const clientStats: Record<string, { name: string; total: number; orders: number }> = {};
        const productStats: Record<string, { name: string; type: string; qty: number; revenue: number; cost: number }> = {};
        const monthlyStats: Record<string, { revenue: number; cost: number; profit: number; orders: number }> = {};
        const paymentMethodStats: Record<string, { total: number; count: number; commission: number }> = {};
        const vendorStats: Record<string, { name: string; revenue: number; orders: number; avgTicket: number }> = {};
        const labProfitStats: Record<string, { laboratory: string; revenue: number; cost: number; profit: number; ordersCount: number }> = {};

        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        for (const order of orders) {
            totalRevenue += order.total || 0;
            totalPaid += order.paid || 0;
            totalPending += Math.max(0, (order.total || 0) - (order.paid || 0));

            // Markup profit: difference between subtotalWithMarkup and item subtotals
            if ((order as any).subtotalWithMarkup > 0) {
                const itemSubtotal = order.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
                totalMarkup += ((order as any).subtotalWithMarkup || 0) - itemSubtotal;
            }

            // Client stats
            const cId = order.clientId;
            if (!clientStats[cId]) clientStats[cId] = { name: order.client.name, total: 0, orders: 0 };
            clientStats[cId].total += order.total || 0;
            clientStats[cId].orders += 1;

            // Vendor stats
            const vId = order.userId;
            const vName = (order as any).user?.name || 'Sin asignar';
            if (!vendorStats[vId]) vendorStats[vId] = { name: vName, revenue: 0, orders: 0, avgTicket: 0 };
            vendorStats[vId].revenue += order.total || 0;
            vendorStats[vId].orders += 1;

            // Monthly stats
            const date = new Date(order.createdAt);
            const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
            if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { revenue: 0, cost: 0, profit: 0, orders: 0 };
            monthlyStats[monthKey].revenue += order.total || 0;
            monthlyStats[monthKey].orders += 1;

            // Item costs
            for (const item of order.items) {
                const product = item.product;
                if (!product) continue; // Skip if product was deleted

                let itemCost = (product.cost || 0) * item.quantity;
                
                // Si el producto es por PAR (Cristales) y tiene especificado el ojo (OD/OI),
                // el costo en el inventario suele ser del par, por lo que cada línea (ojo)
                // debe sumar solo el 50% del costo para no duplicar el gasto total en reportes.
                if (product.unitType === 'PAR' && item.eye && (product.cost || 0) > 0) {
                    itemCost = ((product.cost || 0) / 2) * item.quantity;
                }
                
                const itemRevenue = item.price * item.quantity;

                // Categorize costs
                const cat = (product.category || '').toUpperCase();
                if (cat.includes('FRAME') || cat.includes('SUNGLASS') || (product.type || '').includes('Armazón') || (product.type || '').includes('Lentes de Sol')) {
                    totalCostFrames += itemCost;
                } else if (cat.includes('LENS') || (product.type || '').includes('Cristal') || (product.type || '').includes('Multifocal') || (product.type || '').includes('Monofocal')) {
                    totalCostLenses += itemCost;
                } else {
                    totalCostOther += itemCost;
                }

                // Product stats
                const pName = `${product.brand || ''} ${product.model || product.name || 'Sin nombre'}`.trim();
                const pId = product.id;
                if (!productStats[pId]) productStats[pId] = { name: pName, type: product.type || product.category || '', qty: 0, revenue: 0, cost: 0 };
                productStats[pId].qty += item.quantity;
                productStats[pId].revenue += itemRevenue;
                productStats[pId].cost += itemCost;

                // Add to monthly cost
                monthlyStats[monthKey].cost += itemCost;

                // Lab profit stats (only for LENS items with a laboratory)
                const labName = (product as any).laboratory;
                if ((cat.includes('LENS') || (product.type || '').includes('Cristal') || (product.type || '').includes('Multifocal') || (product.type || '').includes('Monofocal')) && labName) {
                    if (!labProfitStats[labName]) labProfitStats[labName] = { laboratory: labName, revenue: 0, cost: 0, profit: 0, ordersCount: 0 };
                    labProfitStats[labName].revenue += itemRevenue;
                    labProfitStats[labName].cost += itemCost;
                    labProfitStats[labName].profit += itemRevenue - itemCost;
                }
            }

            // Payment method stats & platform fees
            for (const payment of order.payments) {
                const method = payment.method || 'CASH';
                if (!paymentMethodStats[method]) paymentMethodStats[method] = { total: 0, count: 0, commission: 0 };
                paymentMethodStats[method].total += payment.amount;
                paymentMethodStats[method].count += 1;

                const commissionRate = getCommissionRate(method);
                const commission = payment.amount * commissionRate;
                paymentMethodStats[method].commission += commission;
                totalPlatformFees += commission;
            }

            // Update monthly profit
            monthlyStats[monthKey].profit = monthlyStats[monthKey].revenue - monthlyStats[monthKey].cost;
        }

        const totalCosts = totalCostFrames + totalCostLenses + totalCostOther;
        const netProfit = totalRevenue - totalCosts - totalPlatformFees;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        return NextResponse.json({
            summary: {
                totalRevenue,
                totalCosts,
                totalCostFrames,
                totalCostLenses,
                totalCostOther,
                totalPlatformFees,
                netProfit,
                profitMargin,
                totalPaid,
                totalPending,
                totalMarkup,
                ordersCount: orders.length,
            },
            topClients: Object.values(clientStats)
                .sort((a, b) => b.total - a.total)
                .slice(0, 10),
            topProducts: Object.values(productStats)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 15),
            vendorStats: Object.values(vendorStats)
                .map(v => ({ ...v, avgTicket: v.orders > 0 ? Math.round(v.revenue / v.orders) : 0 }))
                .sort((a, b) => b.revenue - a.revenue),
            monthlyStats: Object.entries(monthlyStats)
                .map(([month, data]) => ({ month, ...data })),
            paymentMethods: Object.entries(paymentMethodStats)
                .map(([method, data]) => ({ method, ...data }))
                .sort((a, b) => b.total - a.total),
            labStats: (() => {
                // Count unique orders per lab
                const labOrderIds: Record<string, Set<string>> = {};
                for (const order of orders) {
                    for (const item of order.items) {
                        const product = item.product;
                        if (!product) continue;

                        const cat = (product.category || '').toUpperCase();
                        const labName = (product as any).laboratory;
                        if (labName && (cat.includes('LENS') || (product.type || '').includes('Cristal') || (product.type || '').includes('Multifocal') || (product.type || '').includes('Monofocal'))) {
                            if (!labOrderIds[labName]) labOrderIds[labName] = new Set();
                            labOrderIds[labName].add(order.id);
                        }
                    }
                }
                return Object.values(labProfitStats)
                    .map(ls => ({ ...ls, ordersCount: labOrderIds[ls.laboratory]?.size || 0 }))
                    .sort((a, b) => b.revenue - a.revenue);
            })(),
        });
    } catch (error: any) {
        console.error('Error generating report:', error);
        return NextResponse.json({ error: error.message || 'Error generating report' }, { status: 500 });
    }
}
