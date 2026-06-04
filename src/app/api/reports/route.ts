import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCommissionRate, DOCTOR_COMMISSION_RATE } from '@/lib/constants';

export const dynamic = 'force-dynamic';


export interface BillingStat {
    account: string;
    total: number;
    count: number;
}

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
                invoices: { select: { id: true } }
            },
            orderBy: { createdAt: 'desc' },
        });

        // ── Fetch Fixed Costs for the period ──────────
        let fixedCostsWhere: any = {};
        if (from || to) {
            // Build month/year filter from the date range using UTC to avoid local timezone offset shifting the month
            const fromDate = from ? new Date(from) : null;
            const toDate = to ? new Date(to) : null;

            if (fromDate && toDate) {
                // Get all months in range using UTC getters
                const monthYearPairs: { month: number; year: number }[] = [];
                const current = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1));
                const end = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), 1));
                while (current <= end) {
                    monthYearPairs.push({ month: current.getUTCMonth() + 1, year: current.getUTCFullYear() });
                    current.setUTCMonth(current.getUTCMonth() + 1);
                }
                if (monthYearPairs.length > 0) {
                    fixedCostsWhere = {
                        OR: monthYearPairs.map(p => ({ month: p.month, year: p.year }))
                    };
                }
            } else if (fromDate) {
                fixedCostsWhere = { year: { gte: fromDate.getUTCFullYear() } };
            }
        }

        const fixedCosts = await prisma.fixedCost.findMany({
            where: fixedCostsWhere,
            orderBy: { createdAt: 'desc' },
        });

        // Agrupamos para el frontend
        const totalFixedCosts = fixedCosts
            .filter((fc: any) => !fc.type || fc.type === 'FIJO' || fc.type === 'OTRO')
            .reduce((sum: number, fc: any) => sum + (fc.amount || 0), 0);
        
        const totalMarketingCosts = fixedCosts
            .filter((fc: any) => fc.type === 'MARKETING')
            .reduce((sum: number, fc: any) => sum + (fc.amount || 0), 0);

        // Los proveedores manuales no los restamos de la ganancia neta aquí porque el sistema
        // ya calcula el CMV (Costo de Mercadería Vendida) por cada producto. 
        // Si los restamos, duplicaríamos el costo.
        const totalProviderCosts = fixedCosts
            .filter((fc: any) => fc.type === 'PROVEEDOR')
            .reduce((sum: number, fc: any) => sum + (fc.amount || 0), 0);

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
        let totalSpecialDiscounts = 0;
        let totalPending = 0;
        let totalMarkup = 0;

        const clientStats: Record<string, { name: string; total: number; orders: number }> = {};
        const productStats: Record<string, { name: string; type: string; qty: number; revenue: number; cost: number }> = {};
        const monthlyStats: Record<string, { revenue: number; cost: number; profit: number; orders: number; specialDescSum?: number; platformFeeSum?: number; doctorFeeSum?: number; }> = {};
        const paymentMethodStats: Record<string, { total: number; count: number; commission: number }> = {};
        const vendorStats: Record<string, { name: string; revenue: number; orders: number; avgTicket: number }> = {};
        const labProfitStats: Record<string, { laboratory: string; revenue: number; cost: number; profit: number; ordersCount: number; clients: { name: string; date: string; product: string; revenue: number; cost: number }[] }> = {};
        const salesDetail: any[] = [];

        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        for (const order of orders) {
            // ── Revenue = sum of actual payments received ──
            const orderPaidReal = order.payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
            totalRevenue += orderPaidReal;

            // Include special discounts
            const specialDesc = order.specialDiscount || 0;
            totalSpecialDiscounts += specialDesc;

            // Pending = list price minus paid (using total as primary reference)
            const listPrice = order.total || order.subtotalWithMarkup || 0;
            totalPending += Math.max(0, listPrice - orderPaidReal);

            // Markup profit: difference between subtotalWithMarkup and item subtotals
            if (order.subtotalWithMarkup && order.subtotalWithMarkup > 0) {
                const itemSubtotal = order.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
                totalMarkup += (order.subtotalWithMarkup || 0) - itemSubtotal;
            }

            // Client stats (based on real paid)
            const cId = order.clientId;
            if (!clientStats[cId]) clientStats[cId] = { name: order.client.name, total: 0, orders: 0 };
            clientStats[cId].total += orderPaidReal;
            clientStats[cId].orders += 1;

            // Vendor stats (based on real paid)
            const vId = order.userId;
            const vName = order.user?.name || 'Sin asignar';
            if (!vendorStats[vId]) vendorStats[vId] = { name: vName, revenue: 0, orders: 0, avgTicket: 0 };
            vendorStats[vId].revenue += orderPaidReal;
            vendorStats[vId].orders += 1;

            // Monthly stats
            const date = new Date(order.labSentAt || order.createdAt);
            const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
            if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { revenue: 0, cost: 0, profit: 0, orders: 0 };
            monthlyStats[monthKey].revenue += orderPaidReal;
            monthlyStats[monthKey].orders += 1;

            // Item costs + per-order detail items
            let orderCMV = 0;
            const orderItems: any[] = [];
            const orderProductTypes = new Set<string>();

            for (const item of order.items) {
                const product = item.product;
                if (!product) continue; // Skip if product was deleted

                let itemCost = (product.cost || 0) * item.quantity;
                
                // Si el producto es por PAR (Cristales) y tiene especificado el ojo (OD/OI pero no AMBOS),
                // el costo en el inventario suele ser del par, por lo que cada línea (ojo)
                // debe sumar solo el 50% del costo para no duplicar el gasto total en reportes.
                if (product.unitType === 'PAR' && (item.eye === 'OD' || item.eye === 'OI') && (product.cost || 0) > 0) {
                    itemCost = ((product.cost || 0) / 2) * item.quantity;
                }

                // Promo 2x1: el segundo cristal multifocal bonificado tiene costo $0
                // (el laboratorio lo regala). Se detecta porque su precio de venta es $0.
                // Los armazones siempre cuentan ambos costos (la óptica los paga).
                const has2x1Tag = order.tags?.some((t: any) => t.name.toLowerCase().includes('2x1')) || false;
                const is2x1Order = (order.appliedPromoName || '').toLowerCase().includes('2x1') || has2x1Tag;
                const isCrystalItem = (product.category || '').toUpperCase().includes('CRISTAL')
                    || (product.type || '').includes('Cristal')
                    || (product.type || '').includes('Multifocal')
                    || (product.type || '').includes('Monofocal');
                if (is2x1Order && isCrystalItem && item.price === 0) {
                    itemCost = 0;
                }
                
                const itemRevenue = item.price * item.quantity;

                // Categorize costs
                const cat = (product.category || '').toUpperCase();
                if (cat.includes('FRAME') || cat.includes('SUNGLASS') || (product.type || '').includes('Armazón') || (product.type || '').includes('Lentes de Sol')) {
                    totalCostFrames += itemCost;
                    orderProductTypes.add('ARMAZÓN');
                } else if (cat.includes('CRISTAL') || (product.type || '').includes('Cristal') || (product.type || '').includes('Multifocal') || (product.type || '').includes('Monofocal')) {
                    totalCostLenses += itemCost;
                    orderProductTypes.add('CRISTAL');
                } else {
                    totalCostOther += itemCost;
                    orderProductTypes.add('OTRO');
                }

                orderCMV += itemCost;

                // Collect item detail for salesDetail
                orderItems.push({
                    name: `${product.brand || ''} ${product.name || 'Sin nombre'}`.trim(),
                    type: product.type || product.category || '',
                    eye: item.eye || null,
                    price: itemRevenue,
                    cost: itemCost,
                    lab: product.laboratory || null,
                    is2x1Free: !!(is2x1Order && isCrystalItem && item.price === 0),
                });

                // Product stats
                const pName = `${product.brand || ''} ${product.name || 'Sin nombre'}`.trim();
                const pId = product.id;
                if (!productStats[pId]) productStats[pId] = { name: pName, type: product.type || product.category || '', qty: 0, revenue: 0, cost: 0 };
                
                if (!(is2x1Order && isCrystalItem && item.price === 0)) {
                    productStats[pId].qty += item.quantity;
                }
                productStats[pId].revenue += itemRevenue;
                productStats[pId].cost += itemCost;

                // Add to monthly cost
                monthlyStats[monthKey].cost += itemCost;

                // Lab profit stats (only for LENS/CRISTAL items with a laboratory)
                const labName = product.laboratory;
                if ((cat.includes('CRISTAL') || (product.type || '').includes('Cristal') || (product.type || '').includes('Multifocal') || (product.type || '').includes('Monofocal')) && labName) {
                    if (!labProfitStats[labName]) labProfitStats[labName] = { laboratory: labName, revenue: 0, cost: 0, profit: 0, ordersCount: 0, clients: [] };
                    labProfitStats[labName].revenue += itemRevenue;
                    labProfitStats[labName].cost += itemCost;
                    labProfitStats[labName].profit += itemRevenue - itemCost;
                    labProfitStats[labName].clients.push({
                        name: order.client?.name || 'Desconocido',
                        date: order.createdAt.toISOString(),
                        product: `${product.brand || ''} ${product.name || ''}`.trim(),
                        revenue: itemRevenue,
                        cost: itemCost
                    });
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
            const doctorName = order.client?.doctor;
            let doctorFee = 0;
            if (doctorName) {
                const doctorNet = orderPaidReal - orderPlatformFee - specialDesc;
                doctorFee = Math.max(0, doctorNet * DOCTOR_COMMISSION_RATE);
                totalDoctorFees += doctorFee;
            }

            // Update monthly stats with accumulated variable costs
            if (!monthlyStats[monthKey].specialDescSum) monthlyStats[monthKey].specialDescSum = 0;
            if (!monthlyStats[monthKey].platformFeeSum) monthlyStats[monthKey].platformFeeSum = 0;
            if (!monthlyStats[monthKey].doctorFeeSum) monthlyStats[monthKey].doctorFeeSum = 0;

            monthlyStats[monthKey].specialDescSum! += specialDesc;
            monthlyStats[monthKey].platformFeeSum! += orderPlatformFee;
            monthlyStats[monthKey].doctorFeeSum! += doctorFee;

            // Update monthly profit properly
            monthlyStats[monthKey].profit = monthlyStats[monthKey].revenue 
                - monthlyStats[monthKey].cost 
                - monthlyStats[monthKey].specialDescSum! 
                - monthlyStats[monthKey].platformFeeSum! 
                - monthlyStats[monthKey].doctorFeeSum!;

            // ── Collect per-sale detail ──
            const types = Array.from(orderProductTypes);
            let orderTypeLabel = 'OTRO';
            if (types.includes('ARMAZÓN') && types.includes('CRISTAL')) orderTypeLabel = 'ARM+CRIS';
            else if (types.includes('CRISTAL')) orderTypeLabel = 'CRISTAL';
            else if (types.includes('ARMAZÓN')) orderTypeLabel = 'ARMAZÓN';

            const saleNetProfit = orderPaidReal - orderCMV - orderPlatformFee - doctorFee - specialDesc;
            salesDetail.push({
                id: order.id.slice(-6),
                fullId: order.id,
                date: order.createdAt.toISOString(),
                month: monthKey,
                clientName: order.client?.name || 'Desconocido',
                vendorName: order.user?.name || 'Sin asignar',
                orderType: orderTypeLabel,
                totalPaid: orderPaidReal,
                totalList: listPrice,
                cmv: orderCMV,
                platformFee: Math.round(orderPlatformFee * 100) / 100,
                doctorFee: Math.round(doctorFee * 100) / 100,
                specialDiscount: specialDesc,
                appliedPromo: order.appliedPromoName || null,
                discounts: {
                    cash: order.discountCash || 0,
                    transfer: order.discountTransfer || 0,
                    card: order.discountCard || 0,
                    general: order.discount || 0,
                },
                markup: order.markup || 0,
                netProfit: Math.round(saleNetProfit * 100) / 100,
                profitMargin: orderPaidReal > 0 ? Math.round((saleNetProfit / orderPaidReal) * 10000) / 100 : 0,
                hasInvoice: !!order.invoices?.length,
                paymentMethods: order.payments.map((p: any) => p.method),
                items: orderItems,
            });
        }

        const totalCosts = totalCostFrames + totalCostLenses + totalCostOther;
        // Net Profit = Real Income - Product Costs - Platform Fees - Doctor Fees - Fixed Costs - Marketing - Special Discounts
        const netProfit = totalRevenue - totalCosts - totalPlatformFees - totalDoctorFees - totalFixedCosts - totalMarketingCosts - totalSpecialDiscounts;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        // ── Fetch Invoices for billing stats ──
        const invoicesWhere: any = {
            status: 'COMPLETED'
        };
        if (from || to) {
            invoicesWhere.createdAt = dateFilter;
        }

        const invoices = await prisma.invoice.findMany({
            where: invoicesWhere
        });

        const billingStats: Record<string, BillingStat> = {
            'ISH': { account: 'Ishtar', total: 0, count: 0 },
            'YANI': { account: 'Yani', total: 0, count: 0 }
        };

        for (const inv of invoices) {
            const acc = inv.billingAccount;
            if (!billingStats[acc]) billingStats[acc] = { account: acc, total: 0, count: 0 };
            billingStats[acc].total += inv.totalAmount;
            billingStats[acc].count += 1;
        }

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
                totalMarketingCosts,
                totalProviderCosts,
                totalSpecialDiscounts,
                netProfit,
                profitMargin,
                totalPaid: totalRevenue, // In this model, revenue IS what was paid
                totalPending,
                totalMarkup,
                ordersCount: orders.length,
            },
            billingStats: Object.values(billingStats),
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
                        const labName = product.laboratory;
                        if (labName && (cat.includes('CRISTAL') || (product.type || '').includes('Cristal') || (product.type || '').includes('Multifocal') || (product.type || '').includes('Monofocal'))) {
                            if (!labOrderIds[labName]) labOrderIds[labName] = new Set();
                            labOrderIds[labName].add(order.id);
                        }
                    }
                }
                return Object.values(labProfitStats)
                    .map(ls => ({ ...ls, ordersCount: labOrderIds[ls.laboratory]?.size || 0 }))
                    .sort((a, b) => b.revenue - a.revenue);
            })(),
            salesDetail,
        });
    } catch (error: any) {
        console.error('Error generating report:', error);
        return NextResponse.json({ error: error.message || 'Error generating report' }, { status: 500 });
    }
}
