import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const allOrders = await prisma.order.findMany({
            include: { payments: true }
        });
        
        let updated = 0;
        for (const order of allOrders) {
            const sumPaid = order.payments.reduce((acc: any, p: any) => acc + p.amount, 0);
            // Only update if it doesn't match
            if (order.paid !== sumPaid) {
                await prisma.order.update({
                    where: { id: order.id },
                    data: { paid: sumPaid }
                });
                updated++;
            }
        }
        
        return NextResponse.json({ success: true, updated });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
