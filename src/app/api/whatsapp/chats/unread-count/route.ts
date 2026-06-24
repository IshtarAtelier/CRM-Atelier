import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const unreadCount = await prisma.whatsAppChat.count({
            where: {
                unreadCount: { gt: 0 }
            }
        });
        return NextResponse.json({ count: unreadCount });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
