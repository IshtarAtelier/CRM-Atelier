import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/orders/web-pending-count
// Cantidad de ventas web pendientes de confirmación humana (badge del sidebar).
export async function GET() {
    try {
        const count = await prisma.order.count({
            where: {
                status: { in: ['WEB_PENDING', 'WEB_PAID'] },
                isDeleted: false
            }
        });
        return NextResponse.json({ count });
    } catch (error: any) {
        console.error('[WEB PENDING COUNT] Error:', error);
        return NextResponse.json({ count: 0 }, { status: 500 });
    }
}
