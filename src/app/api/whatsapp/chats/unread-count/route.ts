import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const result = await prisma.whatsAppChat.aggregate({
            _sum: {
                unreadCount: true
            }
        });
        const unreadCount = result._sum.unreadCount ?? 0;
        return NextResponse.json({ count: unreadCount });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
