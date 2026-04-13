import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCommissionRate, DOCTOR_COMMISSION_RATE } from '@/lib/constants';

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

        // ── Fetch Fixed Costs for the period ──────────
        let fixedCostsWhere: any = {};
        if (from || to) {
            // Build month/year filter from the date range
            const fromDate = from ? new Date(from) : null;
            const toDate = to ? new Date(to) : null;

            if (fromDate && toDate) {
                // Get all months in range
                const monthYearPairs: { month: number; year: number }[] = [];
                const current = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
                const end = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
                while (current <= end) {
                    monthYearPairs.push({ month: current.getMonth() + 1, year: current.getFullYear() });
                    current.setMonth(current.getMonth() + 1);
                }
                fixedCostsWhere = {
                    OR: monthYearPairs.map(p => ({ month: p.month, year: p.year }))
                };
            } else if (fromDate) {
                fixedCostsWhere = { year: { gte: fromDate.getFullYear() } };
            }
        }

        const fixedCosts = await prisma.fixedCost.findMany({
            where: fixedCostsWhere,
            orderBy: { createdAt: 'desc' },
        });

        const totalFixedCosts = fixedCosts.reduce((sum: number, fc: any) => sum + (fc.amount || 0), 0);

        // ── Aggregate Data ──────────────────────────
        // Revenue = sum of actual payments (what entered the business)
        // Cash/Transfer: enters at discounted value → that's the revenue
        // Card: enters at full value → revenue is full, then platform fee is deducted

        let totalRevenue = 0;     // Sum of payment.amount (real money in)
        let totalCostFrames = 0;
        let totalCostLenses = 0;
        let totalCostOther = 0;
        let totalPlatformFees = 0;
        let totalDoctorFees = 0;
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
            // ── Revenue = sum of actual payments received ──
            const orderPaidReal = order.payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
            totalRevenue += orderPaidReal;

            // Pending = list price minus paid (using subtotalWithMarkup as reference for balance)
            const listPrice = (order as any).subtotalWithMarkup || order.total || 0;
            totalPending += Math.max(0, listPrice - orderPaidReal);

            // Markup profit: difference between subtotalWithMarkup and item subtotals
            if ((order as any).subtotalWithMarkup > 0) {
                const itemSubtotal = order.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
                totalMarkup += ((order as any).subtotalWithMarkup || 0) - itemSubtotal;
            }

            // Client stats (based on real paid)
            const cId = order.clientId;
            if (!clientStats[cId]) clientStats[cId] = { name: order.client.name, total: 0, orders: 0 };
            clientStats[cId].total += orderPaidReal;
            clientStats[cId].orders += 1;

            // Vendor stats (based on real paid)
            const vId = order.userId;
            const vName = (order as any).user?.name || 'Sin asignar';
            if (!vendorStats[vId]) vendorStats[vId] = { name: vName, revenue: 0, orders: 0, avgTicket: 0 };
            vendorStats[vId].revenue += orderPaidReal;
            vendorStats[vId].orders += 1;

            // Monthly stats
            const date = new Date(order.createdAt);
            const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
            if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { revenue: 0, cost: 0, profit: 0, orders: 0 };
            monthlyStats[monthKey].revenue += orderPaidReal;
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

            // ── Payment method stats & platform fees ──
            // Fees are only real for card payments; cash/transfer have 0 commission
            let orderPlatformFee = 0;
            for (const payment of order.payments) {
                const method = payment.method || 'CASH';
                if (!paymentMethodStats[method]) paymentMethodStats[method] = { total: 0, count: 0, commission: 0 };
                paymentMethodStats[method].total += payment.amount;
                paymentMethodStats[method].count += 1;

                const commissionRate = getCommissionRate(method);
                const commission = payment.amount * commissionRate;
                paymentMethodStats[method].commission += commission;
                totalPlatformFees += commission;
                orderPlatformFee += commission;
            }

            // ── Doctor fees (if this order's client has a referring doctor) ──
            const doctorName = (order.client as any).doctor;
            if (doctorName) {
                const doctorNet = orderPaidReal - orderPlatformFee;
                const doctorFee = Math.max(0, doctorNet * DOCTOR_COMMISSION_RATE);
                totalDoctorFees += doctorFee;
            }

            // Update monthly profit
            monthlyStats[monthKey].profit = monthlyStats[monthKey].revenue - monthlyStats[monthKey].cost;
        }

        const totalCosts = totalCostFrames + totalCostLenses + totalCostOther;
        // Net Profit = Real Income - Product Costs - Platform Fees - Doctor Fees - Fixed Costs
        const netProfit = totalRevenue - totalCosts - totalPlatformFees - totalDoctorFees - totalFixedCosts;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        return NextResponse.json({
            summary: {
                totalRevenue,
                totalCosts,
                totalCostFrames,
                totalCostLenses,
                totalCostOther,
                totalPlatformFees,
                totalDoctorFees,
                totalFixedCosts,
                netProfit,
                profitMargin,
                totalPaid: totalRevenue, // In this model, revenue IS what was paid
                totalPending,
                totalMarkup,
                ordersCount: orders.length,
            },
            fixedCosts,
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
