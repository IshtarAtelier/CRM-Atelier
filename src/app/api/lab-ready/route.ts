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
                smartLabProgress: { gte: 100 },
                labStatus: { in: ['SENT', 'IN_PROGRESS'] },
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

        return NextResponse.json(orders);
    } catch (error: any) {
        console.error('Error fetching lab-ready orders:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
