import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/lab-ready — Orders that are 100% in SmartLab but not yet marked as READY in CRM
export async function GET() {
    try {
        const orders = await prisma.order.findMany({
            where: {
                isDeleted: false,
                orderType: 'SALE',
                labStatus: { in: ['FINISHED', 'IN_PROGRESS', 'READY'] },
            },
            select: {
                id: true,
                labOrderNumber: true,
                labStatus: true,
                smartLabSector: true,
                smartLabProgress: true,
                smartLabLastSync: true,
                smartLabEntryDate: true,
                smartLabDays: true,
                smartLabDetails: true,
                labSentAt: true,
                createdAt: true,
                client: { select: { id: true, name: true, phone: true } },
                user: { select: { name: true } },
                items: {
                    select: {
                        productNameSnapshot: true,
                        productBrandSnapshot: true,
                        productCategorySnapshot: true,
                        product: { select: { brand: true, name: true, category: true } },
                    },
                },
            },
            orderBy: { smartLabLastSync: 'desc' },
        });

        const readyOrders = orders.filter(order => {
            if (order.labStatus === 'FINISHED' || order.labStatus === 'READY') return true;
            if (order.labStatus === 'IN_PROGRESS' && order.smartLabDetails) {
                try {
                    const details = JSON.parse(order.smartLabDetails as string);
                    if (Array.isArray(details) && details.length > 1) {
                        return details.some((d: any) => d.progress >= 100);
                    }
                } catch { }
            }
            return false;
        });

        return NextResponse.json(readyOrders);
    } catch (error: any) {
        console.error('Error fetching lab-ready orders:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
