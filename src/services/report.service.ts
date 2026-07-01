import { prisma } from '@/lib/db';
import { getCommissionRate, DOCTOR_COMMISSION_RATE } from '@/lib/constants';

interface BillingStat {
    account: string;
    total: number;
    count: number;
}

export class ReportService {
    static async generateReportData(from: string | null, to: string | null) {
        try {
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
            select: {
                id: true,
                createdAt: true,
                labSentAt: true,
                clientId: true,
                userId: true,
                total: true,
                subtotalWithMarkup: true,
                specialDiscount: true,
                appliedPromoName: true,
                discountCash: true,
                discountTransfer: true,
                discountCard: true,
                discount: true,
                markup: true,
                postSaleCost: true,
                client: { select: { name: true, doctor: true } },
                user: { select: { id: true, name: true } },
                items: {
                    select: {
                        quantity: true,
                        price: true,
                        eye: true,
                        productCostSnapshot: true,
                        productCategorySnapshot: true,
                        productNameSnapshot: true,
                        productBrandSnapshot: true,
                        laboratorySnapshot: true,
                        product: {
                            select: {
                                id: true,
                                name: true,
                                brand: true,
                                category: true,
                                type: true,
                                laboratory: true,
                                cost: true,
                                unitType: true,
                            }
                        }
                    }
                },
                payments: { select: { amount: true, method: true } },
                tags: { select: { name: true } },
                invoices: { select: { id: true } }
            },
            orderBy: { createdAt: 'desc' },
        });

        // Fetch Fixed Costs for the period
        let fixedCostsWhere: any = {};
        if (from || to) {
            const fromDate = from ? new Date(from) : null;
            const toDate = to ? new Date(to) : null;

            if (fromDate && toDate) {
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

        const labs = await prisma.laboratoryConfig.findMany();
        const labMap = new Map(labs.map(l => [l.name.toUpperCase(), l]));

        const totalFixedCosts = fixedCosts
            .filter((fc: any) => !fc.type || fc.type === 'FIJO' || fc.type === 'OTRO')
            .reduce((sum: number, fc: any) => sum + (fc.amount || 0), 0);
        
        const totalMarketingCosts = fixedCosts
            .filter((fc: any) => fc.type === 'MARKETING')
            .reduce((sum: number, fc: any) => sum + (fc.amount || 0), 0);

        const totalProviderCosts = fixedCosts
            .filter((fc: any) => fc.type === 'PROVEEDOR')
            .reduce((sum: number, fc: any) => sum + (fc.amount || 0), 0);

        let totalRevenue = 0;
        let totalCostFrames = 0;
        let totalCostLenses = 0;
        let totalCostOther = 0;
        let totalPostSaleCosts = 0;
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
            const orderPaidReal = order.payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
            totalRevenue += orderPaidReal;

            const specialDesc = order.specialDiscount || 0;
            totalSpecialDiscounts += specialDesc;

            const listPrice = order.subtotalWithMarkup || order.total || 0;
            totalPending += Math.max(0, listPrice - orderPaidReal);

            if (order.subtotalWithMarkup && order.subtotalWithMarkup > 0) {
                const itemSubtotal = order.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
                totalMarkup += (order.subtotalWithMarkup || 0) - itemSubtotal;
            }

            const cId = order.clientId;
            if (!clientStats[cId]) clientStats[cId] = { name: order.client.name, total: 0, orders: 0 };
            clientStats[cId].total += orderPaidReal;
            clientStats[cId].orders += 1;

            const vId = order.userId;
            const vName = order.user?.name || 'Sin asignar';
            if (!vendorStats[vId]) vendorStats[vId] = { name: vName, revenue: 0, orders: 0, avgTicket: 0 };
            vendorStats[vId].revenue += orderPaidReal;
            vendorStats[vId].orders += 1;

            const pSaleCost = order.postSaleCost || 0;
            totalPostSaleCosts += pSaleCost;

            const date = new Date(order.labSentAt || order.createdAt);
            const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
            if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { revenue: 0, cost: 0, profit: 0, orders: 0 };
            monthlyStats[monthKey].revenue += orderPaidReal;
            monthlyStats[monthKey].orders += 1;
            monthlyStats[monthKey].cost += pSaleCost;

            let orderCMV = pSaleCost;
            const orderItems: any[] = [];
            const orderProductTypes = new Set<string>();

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
            const is2x1Order = (order.appliedPromoName || '').toLowerCase().includes('2x1') || has2x1Tag || has2x1Product || hasFreeCrystal;

            for (const item of order.items) {
                const product = item.product;
                
                const costVal = item.productCostSnapshot !== null && item.productCostSnapshot !== undefined
                    ? item.productCostSnapshot
                    : (product ? (product.cost || 0) : 0);

                const categoryVal = item.productCategorySnapshot
                    ? item.productCategorySnapshot
                    : (product ? (product.category || '') : '');

                const nameVal = item.productNameSnapshot
                    ? item.productNameSnapshot
                    : (product ? (product.name || '') : '');

                const brandVal = item.productBrandSnapshot
                    ? item.productBrandSnapshot
                    : (product ? (product.brand || '') : '');

                const labName = item.laboratorySnapshot
                    ? item.laboratorySnapshot
                    : (product ? product.laboratory : null);

                const typeVal = (product ? product.type : null) 
                    || (categoryVal.toUpperCase().includes('CRISTAL') ? 'Cristal' : 'Armazón');

                const isCrystalItem = categoryVal.toUpperCase().includes('CRISTAL')
                    || typeVal.includes('Cristal')
                    || typeVal.includes('Multifocal')
                    || typeVal.includes('Monofocal');

                let itemCost = costVal * item.quantity;
                
                if (isCrystalItem && (item.eye === 'OD' || item.eye === 'OI') && costVal > 0) {
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
                
                const itemRevenue = item.price * item.quantity;

                const cat = categoryVal.toUpperCase();
                if (cat.includes('FRAME') || cat.includes('SUNGLASS') || typeVal.includes('Armazón') || typeVal.includes('Lentes de Sol')) {
                    totalCostFrames += itemCost;
                    orderProductTypes.add('ARMAZÓN');
                } else if (cat.includes('CRISTAL') || typeVal.includes('Cristal') || typeVal.includes('Multifocal') || typeVal.includes('Monofocal')) {
                    totalCostLenses += itemCost;
                    orderProductTypes.add('CRISTAL');
                } else {
                    totalCostOther += itemCost;
                    orderProductTypes.add('OTRO');
                }

                orderCMV += itemCost;

                orderItems.push({
                    name: `${brandVal} ${nameVal}`.trim() || 'Producto',
                    type: typeVal || categoryVal || '',
                    eye: item.eye || null,
                    price: itemRevenue,
                    cost: itemCost,
                    lab: labName || null,
                    is2x1Free: !!(is2x1Order && isCrystalItem && item.price === 0),
                });

                const pName = `${brandVal} ${nameVal}`.trim() || 'Producto';
                const pId = item.productId || 'dynamic-crystal';
                if (!productStats[pId]) productStats[pId] = { name: pName, type: typeVal || categoryVal || '', qty: 0, revenue: 0, cost: 0 };
                
                if (!(is2x1Order && isCrystalItem && item.price === 0)) {
                    productStats[pId].qty += isCrystalItem ? (item.quantity / 2) : item.quantity;
                }
                productStats[pId].revenue += itemRevenue;
                productStats[pId].cost += itemCost;

                monthlyStats[monthKey].cost += itemCost;

                if (isCrystalItem && labName) {
                    const labKey = labName.toUpperCase();
                    if (!labProfitStats[labKey]) labProfitStats[labKey] = { laboratory: labName, revenue: 0, cost: 0, profit: 0, ordersCount: 0, clients: [] };
                    labProfitStats[labKey].revenue += itemRevenue;
                    labProfitStats[labKey].cost += itemCost;
                    labProfitStats[labKey].profit += itemRevenue - itemCost;
                    labProfitStats[labKey].clients.push({
                        name: order.client?.name || 'Desconocido',
                        date: order.createdAt.toISOString(),
                        product: pName,
                        revenue: itemRevenue,
                        cost: itemCost
                    });
                }
            }

            let orderPlatformFee = 0;
            for (const payment of order.payments) {
                const method = (payment.method || 'CASH').trim().toUpperCase();
                if (!paymentMethodStats[method]) paymentMethodStats[method] = { total: 0, count: 0, commission: 0 };
                paymentMethodStats[method].total += payment.amount;
                paymentMethodStats[method].count += 1;

                const commissionRate = getCommissionRate(method);
                const commission = payment.amount * commissionRate;
                paymentMethodStats[method].commission += commission;
                totalPlatformFees += commission;
                orderPlatformFee += commission;
            }

            const doctorName = order.client?.doctor;
            let doctorFee = 0;
            if (doctorName) {
                const doctorNet = orderPaidReal - orderPlatformFee - specialDesc;
                doctorFee = Math.max(0, doctorNet * DOCTOR_COMMISSION_RATE);
                totalDoctorFees += doctorFee;
            }

            if (!monthlyStats[monthKey].specialDescSum) monthlyStats[monthKey].specialDescSum = 0;
            if (!monthlyStats[monthKey].platformFeeSum) monthlyStats[monthKey].platformFeeSum = 0;
            if (!monthlyStats[monthKey].doctorFeeSum) monthlyStats[monthKey].doctorFeeSum = 0;

            monthlyStats[monthKey].specialDescSum! += specialDesc;
            monthlyStats[monthKey].platformFeeSum! += orderPlatformFee;
            monthlyStats[monthKey].doctorFeeSum! += doctorFee;

            monthlyStats[monthKey].profit = monthlyStats[monthKey].revenue 
                - monthlyStats[monthKey].cost 
                - monthlyStats[monthKey].specialDescSum! 
                - monthlyStats[monthKey].platformFeeSum! 
                - monthlyStats[monthKey].doctorFeeSum!;

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

        const totalCosts = totalCostFrames + totalCostLenses + totalCostOther + totalPostSaleCosts;
        const netProfit = totalRevenue - totalCosts - totalPlatformFees - totalDoctorFees - totalFixedCosts - totalMarketingCosts - totalSpecialDiscounts;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        const invoicesWhere: any = { status: 'COMPLETED' };
        if (from || to) invoicesWhere.createdAt = dateFilter;

        const invoices = await prisma.invoice.findMany({ where: invoicesWhere });

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

        const labStats = Object.values(labProfitStats)
            .map(ls => ({ ...ls, ordersCount: labOrderIds[ls.laboratory]?.size || 0 }))
            .sort((a, b) => b.revenue - a.revenue);

        return {
            summary: {
                totalRevenue, totalCosts, totalCostFrames, totalCostLenses, totalCostOther, totalPostSaleCosts,
                totalPlatformFees, totalDoctorFees, totalFixedCosts, totalMarketingCosts, totalProviderCosts, totalSpecialDiscounts,
                netProfit, profitMargin, totalPaid: totalRevenue, totalPending, totalMarkup, ordersCount: orders.length,
            },
            billingStats: Object.values(billingStats),
            fixedCosts,
            topClients: Object.values(clientStats).sort((a, b) => b.total - a.total).slice(0, 10),
            topProducts: Object.values(productStats).sort((a, b) => b.revenue - a.revenue).slice(0, 15),
            vendorStats: Object.values(vendorStats).map(v => ({ ...v, avgTicket: v.orders > 0 ? Math.round(v.revenue / v.orders) : 0 })).sort((a, b) => b.revenue - a.revenue),
            monthlyStats: Object.entries(monthlyStats).map(([month, data]) => ({ month, ...data })),
            paymentMethods: Object.entries(paymentMethodStats).map(([method, data]) => ({ method, ...data })).sort((a, b) => b.total - a.total),
            labStats,
            salesDetail,
        };
        } catch (error) {
            console.error('Error in generateReportData:', error);
            throw error;
        }
    }
}