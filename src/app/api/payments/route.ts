import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const method = searchParams.get('method');
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        // Build where clause
        const whereClause: any = {};
        if (method) {
            // Support comma-separated methods for group filtering
            const methods = method.split(',').map(m => m.trim()).filter(Boolean);
            if (methods.length === 1) {
                whereClause.method = methods[0];
            } else if (methods.length > 1) {
                whereClause.method = { in: methods };
            }
        }

        const dateFilter: any = {};
        if (from) dateFilter.gte = new Date(from);
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            dateFilter.lte = toDate;
        }
        if (from || to) {
            whereClause.date = dateFilter;
        }

        // Only include payments from non-deleted orders (ventas y presupuestos)
        whereClause.order = {
            isDeleted: false
        };

        // Fetch payments with order + client info
        const payments = await (prisma.payment as any).findMany({
            where: whereClause,
            include: {
                order: {
                    include: {
                        client: {
                            select: { id: true, name: true, phone: true }
                        }
                    }
                }
            },
            orderBy: { date: 'desc' },
        });

        // Aggregate by method
        const methodSummary: Record<string, { total: number; count: number }> = {};
        let grandTotal = 0;

        for (const payment of payments) {
            const m = payment.method;
            if (!methodSummary[m]) methodSummary[m] = { total: 0, count: 0 };
            methodSummary[m].total += payment.amount;
            methodSummary[m].count += 1;
            grandTotal += payment.amount;
        }

        // Format payments for response
        const formattedPayments = payments.map((p: any) => ({
            id: p.id,
            date: p.date,
            amount: p.amount,
            method: p.method,
            notes: p.notes,
            receiptUrl: p.receiptUrl,
            clientName: p.order?.client?.name || 'Sin cliente',
            clientPhone: p.order?.client?.phone || '',
            orderId: p.orderId,
            orderTotal: p.order?.total || 0,
        }));

        return NextResponse.json({
            payments: formattedPayments,
            summary: {
                grandTotal,
                totalCount: payments.length,
                averagePayment: payments.length > 0 ? grandTotal / payments.length : 0,
            },
            methodBreakdown: Object.entries(methodSummary)
                .map(([method, data]) => ({ method, ...data }))
                .sort((a, b) => b.total - a.total),
        });
    } catch (error: any) {
        console.error('Error fetching payments:', error);
        return NextResponse.json({ error: error.message || 'Error fetching payments' }, { status: 500 });
    }
}
