import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const clientCount = await prisma.client.count();
        const orderCount = await prisma.order.count();
        const firstClient = await prisma.client.findFirst({
            select: { id: true, name: true }
        });

        return NextResponse.json({
            status: 'ok',
            database: 'connected',
            clientCount,
            orderCount,
            firstClient: firstClient?.name || 'none'
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            message: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
